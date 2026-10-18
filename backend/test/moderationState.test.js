const { expect } = require('chai');
const sinon = require('sinon');
const Report = require('../models/Report');
const Review = require('../models/Review');
const observer = require('../services/reviewObserver');
const { ModerationContext } = require('../services/reviewModeration');
const {
    ModerationError, ModerationState, OpenModerationState,
    PendingDeleteModerationState, ResolvedModerationState
} = require('../services/moderationState');

describe('RRP-30 / FR-16: State and Abstraction', function () {
    const sandbox = sinon.createSandbox();
    const reportId = '507f1f77bcf86cd799439011';
    const reviewId = '507f1f77bcf86cd799439012';
    const restaurantId = '507f1f77bcf86cd799439013';
    const adminId = '507f1f77bcf86cd799439014';
    let report;

    beforeEach(function () {
        report = { _id: reportId, reviewId, status: 'open', decision: null };
        sandbox.stub(Report, 'updateOne').resolves({ matchedCount: 1 });
        sandbox.stub(Report, 'findOneAndUpdate').callsFake(async (filter, update) => ({
            ...report, ...update.$set
        }));
        sandbox.stub(Review, 'findById').resolves({ _id: reviewId, restaurantId, status: 'published' });
        sandbox.stub(Review, 'updateOne').resolves({ matchedCount: 1 });
        sandbox.stub(Review, 'deleteOne').resolves({ deletedCount: 1 });
        sandbox.stub(observer, 'notifyReviewChanged').resolves();
        sandbox.stub(console, 'error');
    });
    afterEach(function () { sandbox.restore(); });

    async function expectFailure(operation, status, message) {
        let failure;
        try { await operation; } catch (error) { failure = error; }
        expect(failure).to.be.instanceOf(ModerationError);
        expect(failure.status).to.equal(status);
        expect(failure.message).to.include(message);
    }

    it('the base method reports a missing concrete implementation', async function () {
        let failure;
        try { await new ModerationState().handle({}, 'dismiss'); } catch (error) { failure = error; }
        expect(failure).to.be.instanceOf(Error);
        expect(failure.message).to.include('must implement handle');
    });

    for (const action of ['dismiss', 'hide', 'delete']) {
        it(`an open report can ${action}, then rejects another decision`, async function () {
            const context = new ModerationContext(report, adminId);
            expect(context.state).to.be.instanceOf(OpenModerationState);
            expect(context.state).to.be.instanceOf(ModerationState);
            const result = await context.handle(action);
            expect(result.status).to.equal(action === 'dismiss' ? 'dismissed' : 'actioned');
            expect(result.decision).to.equal(action);
            expect(result.resolvedBy).to.equal(adminId);
            expect(result.resolvedAt).to.be.instanceOf(Date);
            expect(context.state).to.be.instanceOf(ResolvedModerationState);

            await expectFailure(context.handle(action), 409, 'already been resolved');
            sinon.assert.calledOnce(Report.findOneAndUpdate);
            if (action === 'dismiss') {
                sinon.assert.notCalled(Review.updateOne);
                sinon.assert.notCalled(observer.notifyReviewChanged);
            }
        });
    }

    for (const status of ['dismissed', 'actioned']) {
        for (const action of ['dismiss', 'hide', 'delete']) {
            it(`a saved ${status} report rejects ${action} without writes`, async function () {
                report.status = status;
                const context = new ModerationContext(report, adminId);
                await expectFailure(context.handle(action), 409, 'already been resolved');
                sinon.assert.notCalled(Review.findById);
                sinon.assert.notCalled(Report.updateOne);
                sinon.assert.notCalled(Report.findOneAndUpdate);
            });
        }
    }

    it('invalid actions leave an open report and its review untouched', async function () {
        const context = new ModerationContext(report, adminId);
        await expectFailure(context.handle('restore'), 400, 'Provide only action');
        expect(context.state).to.be.instanceOf(OpenModerationState);
        sinon.assert.notCalled(Review.findById);
        sinon.assert.notCalled(Report.findOneAndUpdate);
    });

    it('a rating failure leaves the report open and allows the same delete to be retried', async function () {
        const context = new ModerationContext(report, adminId);
        observer.notifyReviewChanged.onFirstCall().rejects(new Error('Private database detail'));
        await expectFailure(context.handle('delete'), 500, 'retry the same action');
        expect(context.state).to.be.instanceOf(OpenModerationState);
        sinon.assert.notCalled(Report.updateOne);
        sinon.assert.notCalled(Review.deleteOne);
        await context.handle('delete');
        expect(context.state).to.be.instanceOf(ResolvedModerationState);
        sinon.assert.calledOnce(Review.deleteOne);
    });

    it('a failed pending-decision write does not change the state or delete the review', async function () {
        Report.updateOne.rejects(new Error('Database unavailable'));
        const context = new ModerationContext(report, adminId);
        await expectFailure(context.handle('delete'), 500, 'retry the same action');
        expect(context.state).to.be.instanceOf(OpenModerationState);
        expect(report.decision).to.equal(null);
        sinon.assert.notCalled(Review.deleteOne);
        sinon.assert.notCalled(Report.findOneAndUpdate);
    });

    it('a conflicting pending-decision write does not change the state or delete the review', async function () {
        Report.updateOne.resolves({ matchedCount: 0 });
        const context = new ModerationContext(report, adminId);
        await expectFailure(context.handle('delete'), 409, 'changed during processing');
        expect(context.state).to.be.instanceOf(OpenModerationState);
        sinon.assert.notCalled(Review.deleteOne);
    });

    it('a deletion failure enters pending-delete and blocks dismiss/hide until deletion succeeds', async function () {
        Review.deleteOne.onFirstCall().rejects(new Error('Delete failed'));
        const context = new ModerationContext(report, adminId);
        await expectFailure(context.handle('delete'), 500, 'retry the same action');
        expect(context.state).to.be.instanceOf(PendingDeleteModerationState);
        expect(report.decision).to.equal('delete');
        await expectFailure(context.handle('dismiss'), 409, 'Deletion is pending');
        await expectFailure(context.handle('hide'), 409, 'Deletion is pending');
        sinon.assert.calledOnce(Review.findById);
        const result = await context.handle('delete');
        expect(result.decision).to.equal('delete');
        expect(context.state).to.be.instanceOf(ResolvedModerationState);
    });

    it('a new request resumes a pending deletion when the review still exists', async function () {
        report.decision = 'delete';
        const context = new ModerationContext(report, adminId);
        expect(context.state).to.be.instanceOf(PendingDeleteModerationState);
        await context.handle('delete');
        sinon.assert.callOrder(Review.updateOne, observer.notifyReviewChanged,
            Report.updateOne, Review.deleteOne, Report.findOneAndUpdate);
        expect(context.state).to.be.instanceOf(ResolvedModerationState);
    });

    it('a new request closes a pending deletion after the review was already removed', async function () {
        Report.findOneAndUpdate.onFirstCall().rejects(new Error('Closure failed'));
        const firstRequest = new ModerationContext(report, adminId);
        await expectFailure(firstRequest.handle('delete'), 500, 'retry Delete review');
        expect(firstRequest.state).to.be.instanceOf(PendingDeleteModerationState);

        // Simulate loading the saved pending decision in a later request.
        const retry = new ModerationContext({ ...report }, adminId);
        Review.findById.resolves(null);
        const result = await retry.handle('delete');
        expect(result.status).to.equal('actioned');
        expect(retry.state).to.be.instanceOf(ResolvedModerationState);
        sinon.assert.calledOnce(Review.deleteOne);
        sinon.assert.calledOnce(observer.notifyReviewChanged);
    });

    it('a failed dismissal stays open and can be retried', async function () {
        Report.findOneAndUpdate.onFirstCall().rejects(new Error('Closure failed'));
        const context = new ModerationContext(report, adminId);
        await expectFailure(context.handle('dismiss'), 500, 'Could not close the report');
        expect(context.state).to.be.instanceOf(OpenModerationState);
        const result = await context.handle('dismiss');
        expect(result.status).to.equal('dismissed');
        expect(context.state).to.be.instanceOf(ResolvedModerationState);
        sinon.assert.notCalled(Review.findById);
    });
});
