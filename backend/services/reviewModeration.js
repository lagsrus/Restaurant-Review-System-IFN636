const Report = require('../models/Report');
const Review = require('../models/Review');
const reviewObserver = require('./reviewObserver');

class ModerationError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// RRP-30 / FR-16: sequential; preserves the observer contract.
// Only the selected report is resolved.
async function moderateReport(reportId, action, adminId) {
    const report = await Report.findById(reportId);
    if (!report) throw new ModerationError(404, 'Report not found.');
    if (report.status !== 'open') {
        throw new ModerationError(409, 'This report has already been resolved. Refresh the reports.');
    }
    if (report.decision === 'delete' && action !== 'delete') {
        throw new ModerationError(409, 'Deletion is pending. Retry Delete review to complete this report.');
    }

    let reviewDeleted = false;
    try {
        if (action !== 'dismiss') {
            const review = await Review.findById(report.reviewId);
            if (!review && !(action === 'delete' && report.decision === 'delete')) {
                throw new ModerationError(409,
                    'The review is no longer available. Refresh and dismiss this report to close it.');
            }

            // Exclude the review before recalculating. Keep the record until the
            // observer succeeds so a failed rating update can be retried.
            if (review) {
                const updated = await Review.updateOne({ _id: review._id }, { $set: { status: 'hidden' } });
                if (updated.matchedCount !== 1) {
                    throw new ModerationError(409, 'The review changed or was removed. Refresh the reports.');
                }
                await reviewObserver.notifyReviewChanged(review.restaurantId);
                if (action === 'delete') {
                    // Persist the delete decision before removing the review. An open
                    // report with this decision is pending, not a completed action.
                    // It can be resumed even if deletion succeeded but closure failed.
                    const recorded = await Report.updateOne({ _id: reportId, status: 'open' }, { $set: {
                        decision: 'delete', resolvedBy: adminId, resolvedAt: new Date()
                    } }, { runValidators: true });
                    if (recorded.matchedCount !== 1) {
                        throw new ModerationError(409, 'The report changed during processing. Refresh the reports.');
                    }
                    await Review.deleteOne({ _id: review._id });
                    reviewDeleted = true;
                }
            }
        }

        const resolved = await Report.findOneAndUpdate(
            { _id: reportId, status: 'open' },
            { $set: {
                status: action === 'dismiss' ? 'dismissed' : 'actioned',
                decision: action,
                resolvedBy: adminId,
                resolvedAt: new Date()
            } },
            { new: true, runValidators: true }
        );
        if (!resolved) {
            throw new ModerationError(409, 'The report changed during processing. Refresh the reports.');
        }
        return resolved;
    } catch (error) {
        if (error instanceof ModerationError) throw error;
        console.error('Moderation failed:', error);
        if (reviewDeleted) {
            throw new ModerationError(500,
                'The review was deleted and ratings updated, but the report could not be closed. Refresh and retry Delete review to finish recording the decision.');
        }
        throw new ModerationError(500, action === 'dismiss'
            ? 'Could not close the report. Refresh and try again.'
            : 'Moderation could not finish. The review may already be hidden and ratings may need updating. Refresh and retry the same action.');
    }
}

module.exports = { moderateReport, ModerationError };
