class ModerationError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Common interface: every concrete state handles the same request shape.
class ModerationState {
    async handle(context, action) {
        throw new Error('Each moderation state must implement handle(context, action).');
    }
}

class OpenModerationState extends ModerationState {
    async handle(context, action) {
        if (!['dismiss', 'hide', 'delete'].includes(action)) {
            throw new ModerationError(400, 'Provide only action: dismiss, hide or delete.');
        }
        if (action === 'dismiss') return context.closeReport(action);

        const review = await context.hideReview(false);
        if (action === 'delete') {
            await context.recordPendingDelete();
            await context.removeReview(review);
        }
        return context.closeReport(action);
    }
}

class PendingDeleteModerationState extends ModerationState {
    async handle(context, action) {
        if (action !== 'delete') {
            throw new ModerationError(409, 'Deletion is pending. Retry Delete review to complete this report.');
        }

        // A previous attempt may have removed the review but failed to close
        // the report. In that case, only the remaining closure is needed.
        const review = await context.hideReview(true);
        if (review) {
            await context.recordPendingDelete();
            await context.removeReview(review);
        }
        return context.closeReport(action);
    }
}

class ResolvedModerationState extends ModerationState {
    async handle(context, action) {
        throw new ModerationError(409, 'This report has already been resolved. Refresh the reports.');
    }
}

function stateForReport(report) {
    if (report.status !== 'open') return new ResolvedModerationState();
    if (report.decision === 'delete') return new PendingDeleteModerationState();
    return new OpenModerationState();
}

module.exports = {
    ModerationError,
    ModerationState,
    OpenModerationState,
    PendingDeleteModerationState,
    ResolvedModerationState,
    stateForReport
};
