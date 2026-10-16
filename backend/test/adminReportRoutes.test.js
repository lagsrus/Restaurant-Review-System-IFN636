const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Report = require('../models/Report');
const Review = require('../models/Review');
const observer = require('../services/reviewObserver');
chai.use(chaiHttp);

describe('RRP-30 / FR-16 / NFR-02: Admin report moderation', function () {
    const sandbox = sinon.createSandbox();
    const reportId = '507f1f77bcf86cd799439011';
    const reviewId = '507f1f77bcf86cd799439012';
    const restaurantId = '507f1f77bcf86cd799439013';
    const adminId = '507f1f77bcf86cd799439014';
    let secret, token, userQuery, queue;

    beforeEach(function () {
        secret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = 'isolated-moderation-unit-tests';
        token = jwt.sign({ id: adminId }, process.env.JWT_SECRET, { expiresIn: '5m' });
        userQuery = { select: sandbox.stub().resolves({ _id: adminId, role: 'admin' }) };
        sandbox.stub(User, 'findById').returns(userQuery);
        queue = {
            select: sandbox.stub().returnsThis(), populate: sandbox.stub().returnsThis(),
            sort: sandbox.stub().returnsThis(), lean: sandbox.stub().resolves([])
        };
        sandbox.stub(Report, 'find').returns(queue);
        sandbox.stub(Report, 'findById').resolves({ _id: reportId, reviewId, status: 'open' });
        sandbox.stub(Report, 'updateOne').resolves({ matchedCount: 1 });
        sandbox.stub(Report, 'findOneAndUpdate').resolves({ _id: reportId, status: 'actioned' });
        sandbox.stub(Review, 'findById').resolves({ _id: reviewId, restaurantId, status: 'published' });
        sandbox.stub(Review, 'updateOne').resolves({ matchedCount: 1, modifiedCount: 1 });
        sandbox.stub(Review, 'deleteOne').resolves({ deletedCount: 1 });
        sandbox.stub(observer, 'notifyReviewChanged').resolves();
        sandbox.stub(console, 'error');
    });
    afterEach(function () {
        sandbox.restore();
        if (secret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = secret;
    });
    function request(method, path = '', body, auth = token) {
        const req = chai.request(app)[method](`/api/admin/reports${path}`);
        if (auth) req.set('Authorization', `Bearer ${auth}`);
        return body === undefined ? req : req.send(body);
    }
    const decide = (action, id = reportId) => request('patch', `/${id}`, { action });

    it('lists open reports with related details, oldest first', async function () {
        const reports = [{ _id: reportId, reason: 'spam', reviewId: { comment: 'Reported content' } }];
        queue.lean.resolves(reports);
        const res = await request('get');
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, reports);
        sinon.assert.calledWithExactly(Report.find, { status: 'open' });
        sinon.assert.calledWithExactly(queue.sort, { createdAt: 1, _id: 1 });
    });
    it('returns an empty queue when there are no open reports', async function () {
        const res = await request('get');
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, []);
    });
    it('returns a safe 500 for a queue failure, not a successful empty list', async function () {
        queue.lean.rejects(new Error('Private database details'));
        const res = await request('get');
        assert.strictEqual(res.status, 500);
        assert.deepStrictEqual(res.body, { message: 'Could not load reports.' });
    });
    for (const method of ['get', 'patch']) {
        const path = method === 'get' ? '' : `/${reportId}`;
        const body = method === 'get' ? undefined : { action: 'delete' };
        for (const role of ['customer', 'owner']) {
            it(`403: ${role} cannot ${method} reports`, async function () {
                userQuery.select.resolves({ _id: adminId, role });
                assert.strictEqual((await request(method, path, body)).status, 403);
                sinon.assert.notCalled(Report.find);
                sinon.assert.notCalled(Report.findById);
            });
        }
        it(`401: guest cannot ${method} reports`, async function () {
            assert.strictEqual((await request(method, path, body, null)).status, 401);
            sinon.assert.notCalled(Report.findById);
            sinon.assert.notCalled(Report.find);
        });
        it(`401: invalid token cannot ${method} reports`, async function () {
            assert.strictEqual((await request(method, path, body, 'invalid')).status, 401);
            sinon.assert.notCalled(Report.findById);
            sinon.assert.notCalled(Report.find);
        });
    }
    it('401: expired token cannot moderate', async function () {
        const expired = jwt.sign({ id: adminId }, process.env.JWT_SECRET, { expiresIn: -1 });
        assert.strictEqual((await request('patch', `/${reportId}`, { action: 'hide' }, expired)).status, 401);
        sinon.assert.notCalled(Report.findById);
    });
    it('401: removed user cannot moderate', async function () {
        userQuery.select.resolves(null);
        assert.strictEqual((await decide('hide')).status, 401);
        sinon.assert.notCalled(Report.findById);
    });
    for (const body of [{}, [], { action: 'restore' }, { action: ['hide'] }, { action: null },
        { action: 'hide', resolvedBy: 'someone-else' }, { action: 'hide', decision: 'hide' }]) {
        it(`400: rejects ${JSON.stringify(body)} without reading or writing reports`, async function () {
            const res = await request('patch', `/${reportId}`, body);
            assert.strictEqual(res.status, 400);
            assert.deepStrictEqual(Object.keys(res.body), ['message']);
            sinon.assert.notCalled(Report.findById);
            sinon.assert.notCalled(Review.updateOne);
            sinon.assert.notCalled(Report.findOneAndUpdate);
        });
    }
    for (const id of ['not-an-id', 'abcdefghijkl']) {
        it(`400: rejects malformed ID ${id}`, async function () {
            assert.strictEqual((await decide('hide', id)).status, 400);
            sinon.assert.notCalled(Report.findById);
        });
    }
    it('400: malformed JSON returns a message without a stack trace', async function () {
        const res = await chai.request(app).patch(`/api/admin/reports/${reportId}`)
            .set('Authorization', `Bearer ${token}`).set('Content-Type', 'application/json').send('{broken');
        assert.strictEqual(res.status, 400);
        assert.deepStrictEqual(res.body, { message: 'Request body must be valid JSON.' });
        sinon.assert.notCalled(Report.findById);
    });
    it('dismiss changes only the selected report and records the admin and time', async function () {
        const before = Date.now();
        assert.strictEqual((await decide('dismiss')).status, 200);
        const [filter, update] = Report.findOneAndUpdate.firstCall.args;
        assert.deepStrictEqual(filter, { _id: reportId, status: 'open' });
        assert.strictEqual(update.$set.status, 'dismissed');
        assert.strictEqual(update.$set.resolvedBy, adminId);
        assert.ok(update.$set.resolvedAt.getTime() >= before);
        assert.strictEqual(update.$set.decision, 'dismiss');
        sinon.assert.notCalled(Review.findById);
        sinon.assert.notCalled(observer.notifyReviewChanged);
    });
    it('hide excludes the review, notifies ratings, then closes the report', async function () {
        assert.strictEqual((await decide('hide')).status, 200);
        sinon.assert.calledWithExactly(Review.updateOne, { _id: reviewId }, { $set: { status: 'hidden' } });
        sinon.assert.calledWithExactly(observer.notifyReviewChanged, restaurantId);
        sinon.assert.callOrder(Review.updateOne, observer.notifyReviewChanged, Report.findOneAndUpdate);
        assert.strictEqual(Report.findOneAndUpdate.firstCall.args[1].$set.status, 'actioned');
        assert.strictEqual(Report.findOneAndUpdate.firstCall.args[1].$set.decision, 'hide');
        sinon.assert.notCalled(Review.deleteOne);
    });
    it('delete preserves the review until rating update succeeds, then deletes and resolves', async function () {
        assert.strictEqual((await decide('delete')).status, 200);
        sinon.assert.callOrder(Review.updateOne, observer.notifyReviewChanged, Report.updateOne, Review.deleteOne, Report.findOneAndUpdate);
        assert.strictEqual(Report.findOneAndUpdate.firstCall.args[1].$set.decision, 'delete');
        sinon.assert.calledWithExactly(Review.deleteOne, { _id: reviewId });
    });
    it('404: report does not exist', async function () {
        Report.findById.resolves(null);
        assert.strictEqual((await decide('hide')).status, 404);
        sinon.assert.notCalled(Review.updateOne);
    });
    it('409: already resolved reports cannot be processed again', async function () {
        Report.findById.resolves({ status: 'actioned' });
        assert.strictEqual((await decide('delete')).status, 409);
        sinon.assert.notCalled(Review.findById);
        sinon.assert.notCalled(Report.findOneAndUpdate);
    });
    it('409: missing review can only be dismissed', async function () {
        Review.findById.resolves(null);
        assert.strictEqual((await decide('hide')).status, 409);
        assert.strictEqual((await decide('delete')).status, 409);
        sinon.assert.notCalled(Report.findOneAndUpdate);
        assert.strictEqual((await decide('dismiss')).status, 200);
    });
    it('409: a disappearing review does not resolve the report', async function () {
        Review.updateOne.resolves({ matchedCount: 0 });
        assert.strictEqual((await decide('hide')).status, 409);
        sinon.assert.notCalled(observer.notifyReviewChanged);
        sinon.assert.notCalled(Report.findOneAndUpdate);
    });
    it('500: failed ratings preserve the review and open report for retry', async function () {
        observer.notifyReviewChanged.rejects(new Error('Private connection details'));
        const res = await decide('delete');
        assert.strictEqual(res.status, 500);
        assert.ok(res.body.message.includes('retry the same action'));
        assert.ok(!JSON.stringify(res.body).includes('Private'));
        sinon.assert.notCalled(Review.deleteOne);
        sinon.assert.notCalled(Report.findOneAndUpdate);
        observer.notifyReviewChanged.resolves();
        Review.findById.resolves({ _id: reviewId, restaurantId, status: 'hidden' });
        assert.strictEqual((await decide('delete')).status, 200);
    });
    it('500: failed deletion does not close the report', async function () {
        Review.deleteOne.rejects(new Error('Private error'));
        assert.strictEqual((await decide('delete')).status, 500);
        sinon.assert.notCalled(Report.findOneAndUpdate);
    });
    it('500: failed closure after deletion explains how to close the remaining report', async function () {
        Report.findOneAndUpdate.rejects(new Error('Private error'));
        const res = await decide('delete');
        assert.strictEqual(res.status, 500);
        assert.ok(res.body.message.includes('review was deleted'));
        assert.ok(res.body.message.includes('retry Delete review'));
    });
    it('409: a report resolved concurrently is not overwritten', async function () {
        Report.findOneAndUpdate.resolves(null);
        assert.strictEqual((await decide('dismiss')).status, 409);
    });
    it('500: initial database failure returns only a safe message', async function () {
        Report.findById.rejects(new Error('Private database address'));
        const res = await decide('hide');
        assert.strictEqual(res.status, 500);
        assert.deepStrictEqual(Object.keys(res.body), ['message']);
        assert.ok(!res.body.message.includes('Private'));
    });
    it('history lists resolved reports with decisions and admin names, newest first', async function () {
        const entries = [{ _id: reportId, decision: 'delete', resolvedBy: { name: 'Admin' }, reviewId: null }];
        queue.lean.resolves(entries);
        const res = await request('get', '/history');
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, entries);
        sinon.assert.calledWithExactly(Report.find, { status: { $in: ['dismissed', 'actioned'] } });
        sinon.assert.calledWithExactly(queue.populate, 'resolvedBy', 'name');
        sinon.assert.calledWithExactly(queue.sort, { resolvedAt: -1, _id: -1 });
    });
    for (const role of ['customer', 'owner', null]) {
        it(`history is denied for ${role || 'guest'}`, async function () {
            userQuery.select.resolves({ _id: adminId, role });
            const res = await request('get', '/history', undefined, role ? token : null);
            assert.strictEqual(res.status, role ? 403 : 401);
            sinon.assert.notCalled(Report.find);
        });
    }
    it('history errors return safe JSON', async function () {
        queue.lean.rejects(new Error('Private address'));
        const res = await request('get', '/history');
        assert.strictEqual(res.status, 500);
        assert.deepStrictEqual(res.body, { message: 'Could not load report history.' });
    });
    it('pending delete cannot be relabelled dismiss or hide', async function () {
        Report.findById.resolves({ _id: reportId, reviewId, status: 'open', decision: 'delete' });
        assert.strictEqual((await decide('dismiss')).status, 409);
        assert.strictEqual((await decide('hide')).status, 409);
        sinon.assert.notCalled(Review.findById);
    });
    it('pending delete can finish its audit after the review is already removed', async function () {
        Report.findById.resolves({ _id: reportId, reviewId, status: 'open', decision: 'delete' });
        Review.findById.resolves(null);
        assert.strictEqual((await decide('delete')).status, 200);
        assert.strictEqual(Report.findOneAndUpdate.firstCall.args[1].$set.decision, 'delete');
        sinon.assert.notCalled(observer.notifyReviewChanged);
    });
    it('delete never removes review if saving the pending decision fails', async function () {
        Report.updateOne.rejects(new Error('Database unavailable'));
        assert.strictEqual((await decide('delete')).status, 500);
        sinon.assert.notCalled(Review.deleteOne);
        sinon.assert.notCalled(Report.findOneAndUpdate);
    });
    it('model permits only the three decisions or an empty legacy value', function () {
        for (const decision of [null, 'dismiss', 'hide', 'delete']) {
            assert.strictEqual(new Report({ reviewId, reporterId: adminId, reason: 'spam', decision }).validateSync(), undefined);
        }
        assert.ok(new Report({ reviewId, reporterId: adminId, reason: 'spam', decision: 'restore' }).validateSync());
    });
});
