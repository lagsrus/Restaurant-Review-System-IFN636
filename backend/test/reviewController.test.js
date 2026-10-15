const assert = require('assert');
const sinon = require('sinon');

const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const { createReview, getMyReviews, editReview, deleteReview } = require('../controllers/reviewController');

describe('RRP-18 / FR-07: Create four-dimension review', function () {
    const sandbox = sinon.createSandbox();

    const restaurantId = '507f1f77bcf86cd799439011';
    const userId = '507f191e810c19729de860ea';

    function makeRequest() {
        return {
            params: { restaurantId },
            user: { _id: userId },
            body: {
                ratings: {
                    food: 2,
                    service: 3,
                    ambience: 4,
                    value: 4
                },
                comment: '  Test review  '
            }
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
        sandbox.stub(Restaurant, 'findById')
            .resolves({ _id: restaurantId });

        sandbox.stub(Review, 'findOne').resolves(null);

        sandbox.stub(Review, 'create').callsFake(async data => ({
            _id: '507f1f77bcf86cd799439012',
            ...data
        }));

        sandbox.stub(Review, 'find').resolves([{
            ratings: {
                food: 2,
                service: 3,
                ambience: 4,
                value: 4
            }
        }]);

        sandbox.stub(Restaurant, 'findByIdAndUpdate').resolves({});
    });


    afterEach(function () {
        sandbox.restore();
    });



    it('201: creates a linked review and updates restaurant ratings', async function () {
        const res = makeResponse();

        await createReview(makeRequest(), res);

        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.body.score, 3.3);
        assert.strictEqual(res.body.restaurantId, restaurantId);
        assert.strictEqual(res.body.userId, userId);
        assert.strictEqual(res.body.comment, 'Test review');
        assert.strictEqual(Review.create.calledOnce, true);

        assert.strictEqual(Restaurant.findByIdAndUpdate.calledOnce, true);

        const summary = Restaurant.findByIdAndUpdate.firstCall.args[1].$set.ratingSummary;

        assert.strictEqual(summary.avgRating, 3.3);
        assert.strictEqual(summary.reviewCount, 1);
        assert.strictEqual(summary.dimensions.food, 2);
        assert.strictEqual(summary.dimensions.service, 3);
        assert.strictEqual(summary.dimensions.ambience, 4);
        assert.strictEqual(summary.dimensions.value, 4);
        assert.strictEqual(summary.distribution[3], 1);
    });


    it('400: rejects an invalid restaurant ID', async function () {
        const req = makeRequest();
        req.params.restaurantId = 'invalid';
        const res = makeResponse();

        await createReview(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(Restaurant.findById.called, false);
        assert.strictEqual(Review.create.called, false);
    });

    it('400: rejects missing, out-of-range and decimal ratings', async function () {
        const invalidRatings = [
            null,
            { food: 6, service: 3, ambience: 4, value: 4 },
            { food: 2.5, service: 3, ambience: 4, value: 4 },
            { food: 2, service: 3, ambience: 4 }
        ];

        for (const ratings of invalidRatings) {
            const req = makeRequest();
            req.body.ratings = ratings;
            const res = makeResponse();

            await createReview(req, res);

            assert.strictEqual(res.statusCode, 400);
        }

        assert.strictEqual(Review.create.called, false);
    });

    it('400: rejects a missing comment under the current API contract', async function () {
        const req = makeRequest();
        delete req.body.comment;
        const res = makeResponse();

        await createReview(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(Review.create.called, false);
    });

    it('404: rejects a restaurant that does not exist', async function () {
        Restaurant.findById.resolves(null);
        const res = makeResponse();

        await createReview(makeRequest(), res);

        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(Review.create.called, false);
    });

    it('409: prevents a second review for the same restaurant', async function () {
        Review.findOne.resolves({ _id: 'existing-review' });
        const res = makeResponse();

        await createReview(makeRequest(), res);

        assert.strictEqual(res.statusCode, 409);
        assert.strictEqual(Review.create.called, false);
    });

    it('409: handles a database duplicate-key error', async function () {
        const error = new Error('Duplicate key');
        error.code = 11000;
        Review.create.rejects(error);
        const res = makeResponse();

        await createReview(makeRequest(), res);

        assert.strictEqual(res.statusCode, 409);
    });

    it('500: handles an unexpected database error', async function () {
        Restaurant.findById.rejects(new Error('Database failure'));
        sandbox.stub(console, 'error');
        const res = makeResponse();

        await createReview(makeRequest(), res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.message, 'Server error');
    });


it('500: rolls back the review if the rating update fails', async function () {
    Restaurant.findByIdAndUpdate.rejects(
        new Error('Rating update failed')
    );

        const deleteStub = sandbox.stub(Review, 'deleteOne')
            .resolves({ deletedCount: 1 });

        sandbox.stub(console, 'error');

        const res = makeResponse();

        await createReview(makeRequest(), res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.message, 'Server error');

        assert.strictEqual(Review.create.calledOnce, true);
        assert.strictEqual(Restaurant.findByIdAndUpdate.calledOnce, true);

        assert.strictEqual(
            deleteStub.calledOnceWithExactly({
                _id: '507f1f77bcf86cd799439012'
            }),
            true
        );
    });

    it('200: returns only the logged-in customer reviews', async function () {
        const review = {
            _id: '507f1f77bcf86cd799439012',
            userId,
            restaurantId
        };

        const sortStub = sinon.stub().resolves([review]);
        Review.find.returns({ sort: sortStub });

        const res = makeResponse();

        await getMyReviews(makeRequest(), res);

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, [review]);
        assert.deepStrictEqual(Review.find.firstCall.args[0], {
            userId
        });
        assert.strictEqual(sortStub.calledOnceWithExactly({
            createdAt: -1
        }), true);
    });
it('200: customer can edit their own review', async function () {
    const review = {
        _id: '507f1f77bcf86cd799439012',
        restaurantId,
        userId,
        ratings: { food: 2, service: 3, ambience: 4, value: 4 },
        score: 3.3,
        comment: 'Original review',
        edited: false,
        save: sinon.stub().resolves()
    };

    sandbox.stub(Review, 'findById').resolves(review);

    const req = makeRequest();
    req.params.reviewId = review._id;
    req.body.ratings = { food: 5, service: 5, ambience: 5, value: 5 };
    req.body.comment = 'Updated review';

    const res = makeResponse();

    await editReview(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.score, 5);
    assert.strictEqual(res.body.comment, 'Updated review');
    assert.strictEqual(res.body.edited, true);
    assert.strictEqual(review.save.calledOnce, true);
    assert.strictEqual(Restaurant.findByIdAndUpdate.calledOnce, true);
    });

    it('403: customer cannot edit another customers review', async function () {
        const review = {
            userId: '507f191e810c19729de860eb',
            save: sinon.stub()
        };

        sandbox.stub(Review, 'findById').resolves(review);

        const req = makeRequest();
        req.params.reviewId = '507f1f77bcf86cd799439012';

        const res = makeResponse();

        await editReview(req, res);

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(review.save.called, false);
        assert.strictEqual(Restaurant.findByIdAndUpdate.called, false);
    });

it('200: customer can delete their own review', async function () {
    const reviewId = '507f1f77bcf86cd799439012';

    const review = {
        _id: reviewId,
        restaurantId,
        userId,
        toObject: () => ({ _id: reviewId, restaurantId, userId })
    };

    sandbox.stub(Review, 'findById').resolves(review);
    const deleteStub = sandbox.stub(Review, 'deleteOne')
        .resolves({ deletedCount: 1 });

    const req = makeRequest();
    req.params.reviewId = reviewId;
    const res = makeResponse();

    await deleteReview(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, 'Review deleted successfully');
    assert.strictEqual(deleteStub.calledOnce, true);
    assert.deepStrictEqual(deleteStub.firstCall.args[0], {
        _id: reviewId,
        userId
    });
    assert.strictEqual(Restaurant.findByIdAndUpdate.calledOnce, true);
});

it('403: customer cannot delete another customers review', async function () {
    const reviewId = '507f1f77bcf86cd799439012';

    sandbox.stub(Review, 'findById').resolves({
        userId: '507f191e810c19729de860eb'
    });

    const deleteStub = sandbox.stub(Review, 'deleteOne');

    const req = makeRequest();
    req.params.reviewId = reviewId;
    const res = makeResponse();

    await deleteReview(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(deleteStub.called, false);
    assert.strictEqual(Restaurant.findByIdAndUpdate.called, false);
});

});
