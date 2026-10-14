const assert = require('assert');
const sinon = require('sinon');

const Restaurant = require('../models/Restaurant');
const { getRatingBreakdown } = require('../controllers/ratingController');

describe('RRP-20 / FR-09: Rating breakdown', function () {
    const sandbox = sinon.createSandbox();
    const restaurantId = '507f1f77bcf86cd799439011';

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
            ratingSummary: {
                avgRating: 4,
                reviewCount: 2,
                dimensions: {
                    food: 4.5,
                    service: 4,
                    ambience: 3.5,
                    value: 4
                },
                distribution: {
                    1: 0, 2: 0, 3: 0, 4: 2, 5: 0
                }
            }
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('200: returns the rating breakdown', async function () {
        const res = makeResponse();

        await getRatingBreakdown(makeRequest(), res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.avgRating, 4);
        assert.strictEqual(res.body.reviewCount, 2);
        assert.strictEqual(res.body.dimensions.food, 4.5);
        assert.strictEqual(res.body.distribution[4], 2);
        assert.strictEqual(res.body.strongest, 'food');
        assert.strictEqual(res.body.weakest, 'ambience');
    });

    it('200: handles a restaurant with no reviews', async function () {
        Restaurant.findById.resolves({
            _id: restaurantId,
            name: 'New Restaurant',
            ratingSummary: {
                avgRating: 0,
                reviewCount: 0,
                dimensions: {
                    food: 0, service: 0, ambience: 0, value: 0
                },
                distribution: {
                    1: 0, 2: 0, 3: 0, 4: 0, 5: 0
                }
            }
        });

        const res = makeResponse();

        await getRatingBreakdown(makeRequest(), res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.reviewCount, 0);
        assert.strictEqual(res.body.strongest, null);
        assert.strictEqual(res.body.weakest, null);
    });

    it('200: handles equally rated dimensions', async function () {
        const restaurant = await Restaurant.findById(restaurantId);

        restaurant.ratingSummary.dimensions = {
            food: 4, service: 4, ambience: 4, value: 4
        };

        const res = makeResponse();

        await getRatingBreakdown(makeRequest(), res);

        assert.strictEqual(res.body.strongest, null);
        assert.strictEqual(res.body.weakest, null);
    });

    it('400: rejects an invalid restaurant ID', async function () {
        const res = makeResponse();

        await getRatingBreakdown(makeRequest('invalid'), res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(Restaurant.findById.called, false);
    });

    it('404: handles a missing restaurant', async function () {
        Restaurant.findById.resolves(null);

        const res = makeResponse();

        await getRatingBreakdown(makeRequest(), res);

        assert.strictEqual(res.statusCode, 404);
    });

    it('500: handles a database error', async function () {
        Restaurant.findById.rejects(new Error('Database failure'));
        sandbox.stub(console, 'error');

        const res = makeResponse();

        await getRatingBreakdown(makeRequest(), res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.message, 'Server error');
    });
});