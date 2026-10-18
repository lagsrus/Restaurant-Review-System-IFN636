const Report = require('../models/Report');
const Review = require('../models/Review');
const reviewObserver = require('./reviewObserver');
const {
    ModerationError,
    PendingDeleteModerationState,
    ResolvedModerationState,
    stateForReport
} = require('./moderationState');

// The context provides database operations; the current state decides which
// operations are allowed. Each request starts from the persisted report state.
class ModerationContext {
    constructor(report, adminId) {
        this.report = report;
        this.adminId = adminId;
        this.state = stateForReport(report);
        this.reviewDeleted = false;
    }

    async handle(action) {
        try {
            return await this.state.handle(this, action);
        } catch (error) {
            if (error instanceof ModerationError) throw error;
            console.error('Moderation failed:', error);
            if (this.reviewDeleted) {
                throw new ModerationError(500,
                    'The review was deleted and ratings updated, but the report could not be closed. Refresh and retry Delete review to finish recording the decision.');
            }
            throw new ModerationError(500, action === 'dismiss'
                ? 'Could not close the report. Refresh and try again.'
                : 'Moderation could not finish. The review may already be hidden and ratings may need updating. Refresh and retry the same action.');
        }
    }

    async hideReview(allowMissing) {
        const review = await Review.findById(this.report.reviewId);
        if (!review && !allowMissing) {
            throw new ModerationError(409,
                'The review is no longer available. Refresh and dismiss this report to close it.');
        }
        if (!review) return null;

        // Exclude the review before recalculating. Keep the record until the
        // observer succeeds so a failed rating update can be retried.
        const updated = await Review.updateOne({ _id: review._id }, { $set: { status: 'hidden' } });
        if (updated.matchedCount !== 1) {
            throw new ModerationError(409, 'The review changed or was removed. Refresh the reports.');
        }
        await reviewObserver.notifyReviewChanged(review.restaurantId);
        return review;
    }

    async recordPendingDelete() {
        const recorded = await Report.updateOne({ _id: this.report._id, status: 'open' }, { $set: {
            decision: 'delete', resolvedBy: this.adminId, resolvedAt: new Date()
        } }, { runValidators: true });
        if (recorded.matchedCount !== 1) {
            throw new ModerationError(409, 'The report changed during processing. Refresh the reports.');
        }
        // Change the in-memory state only after the pending decision is saved.
        this.report.decision = 'delete';
        this.state = new PendingDeleteModerationState();
    }

    async removeReview(review) {
        await Review.deleteOne({ _id: review._id });
        this.reviewDeleted = true;
    }

    async closeReport(action) {
        const resolved = await Report.findOneAndUpdate(
            { _id: this.report._id, status: 'open' },
            { $set: {
                status: action === 'dismiss' ? 'dismissed' : 'actioned',
                decision: action,
                resolvedBy: this.adminId,
                resolvedAt: new Date()
            } },
            { new: true, runValidators: true }
        );
        if (!resolved) {
            throw new ModerationError(409, 'The report changed during processing. Refresh the reports.');
        }
        this.report = resolved;
        this.state = new ResolvedModerationState();
        return resolved;
    }
}

// RRP-30 / FR-16: keep the controller's existing entry point and error type.
async function moderateReport(reportId, action, adminId) {
    const report = await Report.findById(reportId);
    if (!report) throw new ModerationError(404, 'Report not found.');
    return new ModerationContext(report, adminId).handle(action);
}

module.exports = { moderateReport, ModerationError, ModerationContext };
