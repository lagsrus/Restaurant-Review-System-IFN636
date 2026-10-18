const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

const app = require('../server');
const Restaurant = require('../models/Restaurant');
const Review = require('../models/Review');
const User = require('../models/User');

chai.use(chaiHttp);

describe('FR-13: Public owner replies to restaurant reviews', function () {
    const sandbox = sinon.createSandbox();
    const ownerId = '507f191e810c19729de860ea';
    const restaurantId = '507f1f77bcf86cd799439011';
    const reviewId = '507f1f77bcf86cd799439012';
    const secret = 'isolated-owner-reply-test-secret';
    let originalSecret;
    let userQuery;
    let review;
    let restaurant;

    beforeEach(function () {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        userQuery = {
            select: sandbox.stub().resolves({ _id: ownerId, role: 'owner' })
        };
        review = {
            _id: reviewId,
            restaurantId,
            status: 'published',
            ownerReply: { text: '', ownerId: null, repliedAt: null }
        };
        restaurant = { _id: restaurantId, ownerId };
        sandbox.stub(User, 'findById').returns(userQuery);
        sandbox.stub(Review, 'findById').resolves(review);
        sandbox.stub(Review, 'findOneAndUpdate').resolves({
            ...review,
            ownerReply: { text: 'Thanks for visiting.', ownerId, repliedAt: new Date() }
        });
        sandbox.stub(Restaurant, 'findById').resolves(restaurant);
        sandbox.stub(console, 'error');
    });

    afterEach(function () {
        sandbox.restore();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    function request(body, role = 'owner', requestOwnerId = ownerId, id = reviewId) {
        const token = jwt.sign({ id: requestOwnerId }, secret, { expiresIn: '5m' });
        userQuery.select.resolves({ _id: requestOwnerId, role });
        return chai.request(app)
            .post(`/api/reviews/${id}/reply`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    it('201: the assigned owner posts a trimmed public reply', async function () {
        const res = await request({ text: '  Thanks for visiting.  ' });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.ownerReply.text, 'Thanks for visiting.');
        sinon.assert.calledOnceWithExactly(Review.findById, reviewId);
        sinon.assert.calledOnceWithExactly(Restaurant.findById, restaurantId);
        sinon.assert.calledOnceWithExactly(
            Review.findOneAndUpdate,
            {
                _id: reviewId,
                status: 'published',
                $or: [
                    { 'ownerReply.text': { $exists: false } },
                    { 'ownerReply.text': '' }
                ]
            },
            {
                $set: {
                    'ownerReply.text': 'Thanks for visiting.',
                    'ownerReply.ownerId': ownerId,
                    'ownerReply.repliedAt': sinon.match.date
                }
            },
            { new: true, runValidators: true }
        );
    });

    it('401: unauthenticated callers cannot post a reply', async function () {
        const res = await chai.request(app)
            .post(`/api/reviews/${reviewId}/reply`)
            .send({ text: 'Thanks' });

        assert.strictEqual(res.status, 401);
        sinon.assert.notCalled(Review.findById);
    });

    for (const role of ['customer', 'admin']) {
        it(`403: ${role} callers cannot post owner replies`, async function () {
            const res = await request({ text: 'Thanks' }, role).ok(response => response.status === 403);

            assert.strictEqual(res.status, 403);
            sinon.assert.notCalled(Review.findById);
            sinon.assert.notCalled(Review.findOneAndUpdate);
        });
    }

    it('400: rejects an invalid review ID before database access', async function () {
        const res = await request({ text: 'Thanks' }, 'owner', ownerId, 'invalid')
            .ok(response => response.status === 400);

        assert.strictEqual(res.status, 400);
        sinon.assert.notCalled(Review.findById);
    });

    it('400: rejects blank, non-text, oversized, or extra reply data', async function () {
        for (const body of [
            { text: '   ' },
            { text: 42 },
            { text: 'x'.repeat(2001) },
            { text: 'Thanks', ownerId }
        ]) {
            const res = await request(body).ok(response => response.status === 400);
            assert.strictEqual(res.status, 400);
        }
        sinon.assert.notCalled(Review.findById);
        sinon.assert.notCalled(Review.findOneAndUpdate);
    });

    it('404: rejects missing or unpublished reviews', async function () {
        Review.findById.resolves(null);
        let res = await request({ text: 'Thanks' }).ok(response => response.status === 404);
        assert.strictEqual(res.status, 404);
        sinon.assert.notCalled(Restaurant.findById);

        Review.findById.resolves({ ...review, status: 'hidden' });
        res = await request({ text: 'Thanks' }).ok(response => response.status === 404);
        assert.strictEqual(res.status, 404);
        sinon.assert.notCalled(Review.findOneAndUpdate);
    });

    it('404: rejects a review whose restaurant no longer exists', async function () {
        Restaurant.findById.resolves(null);
        const res = await request({ text: 'Thanks' }).ok(response => response.status === 404);

        assert.strictEqual(res.status, 404);
        sinon.assert.notCalled(Review.findOneAndUpdate);
    });

    it('403: an owner cannot reply to another owner’s restaurant', async function () {
        Restaurant.findById.resolves({
            _id: restaurantId,
            ownerId: '507f191e810c19729de860eb'
        });
        const res = await request({ text: 'Thanks' }).ok(response => response.status === 403);

        assert.strictEqual(res.status, 403);
        sinon.assert.notCalled(Review.findOneAndUpdate);
    });

    it('409: does not overwrite an existing owner reply', async function () {
        review.ownerReply.text = 'Existing public reply';
        const res = await request({ text: 'Replacement' }).ok(response => response.status === 409);

        assert.strictEqual(res.status, 409);
        sinon.assert.notCalled(Review.findOneAndUpdate);
    });

    it('409: reports a concurrent reply instead of overwriting it', async function () {
        Review.findOneAndUpdate.resolves(null);
        Review.findById.onSecondCall().resolves({
            ...review,
            ownerReply: { text: 'Concurrent reply', ownerId, repliedAt: new Date() }
        });
        const res = await request({ text: 'Thanks' }).ok(response => response.status === 409);

        assert.strictEqual(res.status, 409);
        sinon.assert.calledOnce(Review.findOneAndUpdate);
    });

    it('500: reports unexpected persistence errors', async function () {
        Review.findOneAndUpdate.rejects(new Error('private database error'));
        const res = await request({ text: 'Thanks' }).ok(response => response.status === 500);

        assert.strictEqual(res.status, 500);
        assert.deepStrictEqual(res.body, { message: 'Could not post the owner reply.' });
        sinon.assert.calledOnce(console.error);
    });
});
