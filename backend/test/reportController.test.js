const assert = require('assert');
const sinon = require('sinon');

const Review = require('../models/Review');
const Report = require('../models/Report');
const { createReport } = require('../controllers/reportController');

describe('RRP-22 / FR-10: Review reporting', function () {
    const sandbox = sinon.createSandbox();

    const reviewId = '507f1f77bcf86cd799439011';
    const reporterId = '507f1f77bcf86cd799439022';

    function makeRequest(id = reviewId, body = {
        reason: 'spam',
        note: '  Promotional content  '
    }) {
        return {
            params: { reviewId: id },
            body,
            user: { _id: reporterId }
        };
    }

    function makeResponse() {
        return {
            statusCode: 200,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.body = data;
                return this;
            }
        };
    }

    beforeEach(function () {
        sandbox.stub(Review, 'findById').resolves({
            _id: reviewId,
            status: 'published'
        });

        sandbox.stub(Report, 'create').resolves({
            _id: '507f1f77bcf86cd799439033',
            reviewId,
            reporterId,
            reason: 'spam',
            note: 'Promotional content',
            status: 'open'
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('201: creates a report linked to the review and reporter', async function () {
        const res = makeResponse();

        await createReport(makeRequest(), res);

        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.body.report.status, 'open');

        assert(Report.create.calledOnceWithExactly({
            reviewId,
            reporterId,
            reason: 'spam',
            note: 'Promotional content'
        }));
    });

    it('400: rejects an invalid review ID', async function () {
        const res = makeResponse();

        await createReport(makeRequest('invalid'), res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(Review.findById.called, false);
        assert.strictEqual(Report.create.called, false);
    });

    it('400: rejects an invalid report reason', async function () {
        const res = makeResponse();

        await createReport(makeRequest(reviewId, {
            reason: 'incorrect',
            note: ''
        }), res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(Report.create.called, false);
    });

    it('400: rejects a non-text note', async function () {
        const res = makeResponse();

        await createReport(makeRequest(reviewId, {
            reason: 'spam',
            note: 123
        }), res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(Report.create.called, false);
    });

    it('404: rejects a missing review', async function () {
        Review.findById.resolves(null);
        const res = makeResponse();

        await createReport(makeRequest(), res);

        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(Report.create.called, false);
    });

    it('404: rejects a hidden review', async function () {
        Review.findById.resolves({
            _id: reviewId,
            status: 'hidden'
        });

        const res = makeResponse();

        await createReport(makeRequest(), res);

        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(Report.create.called, false);
    });

    it('409: rejects duplicate reporting', async function () {
        const error = new Error('Duplicate key');
        error.code = 11000;
        Report.create.rejects(error);

        const res = makeResponse();

        await createReport(makeRequest(), res);

        assert.strictEqual(res.statusCode, 409);
        assert.strictEqual(
            res.body.message,
            'You have already reported this review'
        );
    });

    it('500: handles database errors', async function () {
        Report.create.rejects(new Error('Database failure'));
        sandbox.stub(console, 'error');

        const res = makeResponse();

        await createReport(makeRequest(), res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.message, 'Server error');
    });
});