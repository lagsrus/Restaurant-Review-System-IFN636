const assert = require('assert');
const sinon = require('sinon');

const Restaurant = require('../models/Restaurant');
const Review = require('../models/Review');
const { getRestaurantDetails } = require('../controllers/restaurantDetailsController');

describe('RRP-21 / FR-06: Restaurant details', function () {
    const sandbox = sinon.createSandbox();
    const restaurantId = '507f1f77bcf86cd799439011';

    let sortReviews;
    let selectReviews;

    function makeRequest(id = restaurantId) {
        return { params: { restaurantId: id } };
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
        sandbox.stub(Restaurant, 'findById').resolves({
            _id: restaurantId,
            name: 'Brisbane Test Kitchen',
            cuisine: 'Italian',
            location: {
                address: '123 Test Street',
                suburb: 'Brisbane',
                mapsUrl: 'https://maps.google.com'
            },
            menuUrl: 'https://example.com/menu',
            ratingSummary: {
                avgRating: 4,
                reviewCount: 1
            }
        });

        const reviews = [{
            _id: '507f1f77bcf86cd799439022',
            restaurantId,
            ratings: {
                food: 5,
                service: 4,
                ambience: 4,
                value: 3
            },
            score: 4,
            comment: 'Good food and service',
            edited: false,
            ownerReply: {
                text: 'Thank you for visiting'
            }
        }];

        sortReviews = sandbox.stub().resolves(reviews);
        selectReviews = sandbox.stub().returns({
            sort: sortReviews
        });

        sandbox.stub(Review, 'find').returns({
            select: selectReviews
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('200: returns restaurant information and reviews', async function () {
        const res = makeResponse();

        await getRestaurantDetails(makeRequest(), res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.restaurant.name, 'Brisbane Test Kitchen');
        assert.strictEqual(res.body.restaurant.cuisine, 'Italian');
        assert.strictEqual(res.body.reviews.length, 1);
        assert.strictEqual(res.body.reviews[0].score, 4);
    });

    it('200: requests only published reviews for this restaurant', async function () {
        const res = makeResponse();

        await getRestaurantDetails(makeRequest(), res);

        assert(Review.find.calledOnceWithExactly({
            restaurantId,
            status: 'published'
        }));

        assert(selectReviews.calledOnce);
        assert(selectReviews.firstCall.args[0].includes('ownerReply'));
        assert(sortReviews.calledOnceWithExactly({ createdAt: -1 }));
        assert.strictEqual(
            res.body.reviews[0].ownerReply.text,
            'Thank you for visiting'
        );
    });

    it('200: handles a restaurant with no reviews', async function () {
        sortReviews.resolves([]);

        const res = makeResponse();

        await getRestaurantDetails(makeRequest(), res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.reviews.length, 0);
    });

    it('400: rejects an invalid restaurant ID', async function () {
        const res = makeResponse();

        await getRestaurantDetails(makeRequest('invalid'), res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(Restaurant.findById.called, false);
        assert.strictEqual(Review.find.called, false);
    });

    it('404: handles a missing restaurant', async function () {
        Restaurant.findById.resolves(null);

        const res = makeResponse();

        await getRestaurantDetails(makeRequest(), res);

        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(Review.find.called, false);
    });

    it('500: handles a restaurant database error', async function () {
        Restaurant.findById.rejects(new Error('Database failure'));
        sandbox.stub(console, 'error');

        const res = makeResponse();

        await getRestaurantDetails(makeRequest(), res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.message, 'Server error');
    });

    it('500: handles a review database error', async function () {
        sortReviews.rejects(new Error('Review database failure'));
        sandbox.stub(console, 'error');

        const res = makeResponse();

        await getRestaurantDetails(makeRequest(), res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.message, 'Server error');
    });
});