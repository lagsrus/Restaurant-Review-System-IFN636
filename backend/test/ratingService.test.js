const assert = require('assert');
const sinon = require('sinon');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const { updateRestaurantRating } = require('../services/ratingService');

describe('NFR-05: Restaurant rating integrity', function () {
    const restaurantId = '507f1f77bcf86cd799439011';
    let findReviews;
    let saveSummary;

    beforeEach(function () {
        findReviews = sinon.stub(Review, 'find');
        saveSummary = sinon.stub(Restaurant, 'findByIdAndUpdate')
            .resolves({});
    });

    afterEach(function () {
        sinon.restore();
    });

    it('resets ratings when no published reviews remain', async function () {
        findReviews.resolves([]);

        const summary = await updateRestaurantRating(restaurantId);

        assert.deepStrictEqual(findReviews.firstCall.args[0], {
            restaurantId,
            status: 'published'
        });
        assert.strictEqual(summary.reviewCount, 0);
        assert.strictEqual(summary.avgRating, 0);
        assert.strictEqual(summary.dimensions.food, 0);
        assert.strictEqual(summary.distribution[5], 0);
        assert.strictEqual(saveSummary.calledOnce, true);
    });

    it('calculates averages and distribution for multiple reviews', async function () {
        findReviews.resolves([
            {
                ratings: {
                    food: 4, service: 5, ambience: 3, value: 4
                }
            },
            {
                ratings: {
                    food: 2, service: 3, ambience: 3, value: 2
                }
            }
        ]);

        const summary = await updateRestaurantRating(restaurantId);

        assert.strictEqual(summary.reviewCount, 2);
        assert.strictEqual(summary.avgRating, 3.3);
        assert.strictEqual(summary.dimensions.food, 3);
        assert.strictEqual(summary.dimensions.service, 4);
        assert.strictEqual(summary.dimensions.ambience, 3);
        assert.strictEqual(summary.dimensions.value, 3);
        assert.strictEqual(summary.distribution[3], 1);
        assert.strictEqual(summary.distribution[4], 1);
        assert.strictEqual(saveSummary.calledOnce, true);
    });
});
