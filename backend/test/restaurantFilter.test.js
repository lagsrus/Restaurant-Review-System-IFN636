const assert = require('assert');
const sinon = require('sinon');

const Restaurant = require('../models/Restaurant');
const { buildRestaurantFilter, RestaurantQueryError } = require('../services/restaurantQuery');
const { getRestaurants, getRestaurantMeta } = require('../controllers/restaurantListController');

describe('RRP-33 / FR-04: Restaurant search and filter', function () {
    const sandbox = sinon.createSandbox();

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

    afterEach(function () {
        sandbox.restore();
    });

    describe('buildRestaurantFilter', function () {
        it('returns an empty filter when there are no query values', function () {
            assert.deepStrictEqual(buildRestaurantFilter({}), {});
        });

        it('matches the name partially and case insensitively for search', function () {
            const filter = buildRestaurantFilter({ search: 'thai' });
            assert.strictEqual(filter.name.$regex, 'thai');
            assert.strictEqual(filter.name.$options, 'i');
        });

        it('filters by cuisine, suburb, price level and minimum rating together', function () {
            const filter = buildRestaurantFilter({
                cuisine: 'Thai',
                suburb: 'West End',
                priceLevel: '2',
                minRating: '4'
            });

            assert.strictEqual(filter.cuisine.$regex, '^Thai$');
            assert.strictEqual(filter['location.suburb'].$regex, '^West End$');
            assert.strictEqual(filter.priceLevel, 2);
            assert.deepStrictEqual(filter['ratingSummary.avgRating'], { $gte: 4 });
        });

        it('throws on a price level outside 1 to 3', function () {
            assert.throws(() => buildRestaurantFilter({ priceLevel: '5' }), RestaurantQueryError);
        });

        it('throws on a minimum rating outside 0 to 5', function () {
            assert.throws(() => buildRestaurantFilter({ minRating: '9' }), RestaurantQueryError);
        });
    });

    describe('getRestaurants with an invalid filter', function () {
        it('400: rejects a bad price level and does not query the database', async function () {
            const find = sandbox.stub(Restaurant, 'find');
            const countDocuments = sandbox.stub(Restaurant, 'countDocuments');

            const res = makeResponse();
            await getRestaurants({ query: { priceLevel: '7' } }, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.message, 'Price level must be a whole number from 1 to 3.');
            assert.strictEqual(find.called, false);
            assert.strictEqual(countDocuments.called, false);
        });
    });

    describe('getRestaurantMeta', function () {
        it('200: returns cleaned and sorted cuisines and suburbs', async function () {
            sandbox.stub(Restaurant, 'distinct').callsFake(field => {
                if (field === 'cuisine') {
                    return Promise.resolve(['Thai', '', 'Italian']);
                }
                return Promise.resolve(['West End', 'Brisbane', '']);
            });

            const res = makeResponse();
            await getRestaurantMeta({}, res);

            assert.strictEqual(res.statusCode, 200);
            assert.deepStrictEqual(res.body.cuisines, ['Italian', 'Thai']);
            assert.deepStrictEqual(res.body.suburbs, ['Brisbane', 'West End']);
        });

        it('500: handles a database error', async function () {
            sandbox.stub(Restaurant, 'distinct').rejects(new Error('Database failure'));
            sandbox.stub(console, 'error');

            const res = makeResponse();
            await getRestaurantMeta({}, res);

            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(res.body.message, 'Server error');
        });
    });
});
