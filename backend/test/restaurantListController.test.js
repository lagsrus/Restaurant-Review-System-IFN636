const assert = require('assert');
const sinon = require('sinon');

const Restaurant = require('../models/Restaurant');
const { getRestaurants } = require('../controllers/restaurantListController');

describe('RRP-32 / FR-03: Restaurant list', function () {
    const sandbox = sinon.createSandbox();

    let limitStub;
    let skipStub;
    let sortStub;

    function makeRequest(query = {}) {
        return { query };
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

    // Build a fake restaurant document in the shape the controller reads.
    function makeRestaurant(name) {
        return {
            _id: '507f1f77bcf86cd7994390' + name.length,
            name: name,
            cuisine: 'Thai',
            priceLevel: 2,
            location: { suburb: 'West End' },
            imageUrls: ['https://example.com/' + name + '.jpg'],
            ratingSummary: { avgRating: 4.2, reviewCount: 3 }
        };
    }

    beforeEach(function () {
        const restaurants = [makeRestaurant('Alpha'), makeRestaurant('Beta')];

        // Stub the find chain: find().sort().skip().limit()
        limitStub = sandbox.stub().resolves(restaurants);
        skipStub = sandbox.stub().returns({ limit: limitStub });
        sortStub = sandbox.stub().returns({ skip: skipStub });
        sandbox.stub(Restaurant, 'find').returns({ sort: sortStub });

        sandbox.stub(Restaurant, 'countDocuments').resolves(20);
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('200: returns a page of restaurants in the envelope', async function () {
        const res = makeResponse();

        await getRestaurants(makeRequest(), res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.page, 1);
        assert.strictEqual(res.body.limit, 12);
        assert.strictEqual(res.body.total, 20);
        assert.strictEqual(res.body.totalPages, 2);
        assert.strictEqual(res.body.data.length, 2);
    });

    it('200: each item has only the card fields', async function () {
        const res = makeResponse();

        await getRestaurants(makeRequest(), res);

        const first = res.body.data[0];
        assert.strictEqual(first.name, 'Alpha');
        assert.strictEqual(first.cuisine, 'Thai');
        assert.strictEqual(first.suburb, 'West End');
        assert.strictEqual(first.priceLevel, 2);
        assert.strictEqual(first.avgRating, 4.2);
        assert.strictEqual(first.reviewCount, 3);
        assert.strictEqual(first.image, 'https://example.com/Alpha.jpg');
    });

    it('200: uses the page and limit to skip the right number of records', async function () {
        const res = makeResponse();

        await getRestaurants(makeRequest({ page: '2', limit: '5' }), res);

        assert.strictEqual(res.body.page, 2);
        assert.strictEqual(res.body.limit, 5);
        assert(skipStub.calledOnceWithExactly(5));
        assert(limitStub.calledOnceWithExactly(5));
    });

    it('200: caps the limit at the maximum of 50', async function () {
        const res = makeResponse();

        await getRestaurants(makeRequest({ limit: '200' }), res);

        assert.strictEqual(res.body.limit, 50);
    });

    it('200: a page past the end returns an empty data array', async function () {
        limitStub.resolves([]);

        const res = makeResponse();

        await getRestaurants(makeRequest({ page: '99' }), res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.data.length, 0);
    });

    it('500: handles a database error', async function () {
        Restaurant.countDocuments.rejects(new Error('Database failure'));
        sandbox.stub(console, 'error');

        const res = makeResponse();

        await getRestaurants(makeRequest(), res);

        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.message, 'Server error');
    });
});
