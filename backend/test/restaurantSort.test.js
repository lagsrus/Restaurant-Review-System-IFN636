const assert = require('assert');
const sinon = require('sinon');

const Restaurant = require('../models/Restaurant');
const {
    RatingSort,
    ReviewCountSort,
    NameSort,
    selectSortStrategy,
    SortError
} = require('../services/restaurantSort');
const { getRestaurants } = require('../controllers/restaurantListController');

describe('RRP-34 / FR-05: Restaurant sort', function () {
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

    describe('the strategies', function () {
        it('RatingSort sorts by rating, then reviews, then name', function () {
            assert.deepStrictEqual(new RatingSort().getSortSpec(), {
                'ratingSummary.avgRating': -1,
                'ratingSummary.reviewCount': -1,
                name: 1
            });
        });

        it('ReviewCountSort sorts by review count, then name', function () {
            assert.deepStrictEqual(new ReviewCountSort().getSortSpec(), {
                'ratingSummary.reviewCount': -1,
                name: 1
            });
        });

        it('NameSort sorts by name', function () {
            assert.deepStrictEqual(new NameSort().getSortSpec(), { name: 1 });
        });
    });

    describe('selectSortStrategy', function () {
        it('defaults to rating when no sort is given', function () {
            assert.ok(selectSortStrategy(undefined) instanceof RatingSort);
            assert.ok(selectSortStrategy('') instanceof RatingSort);
        });

        it('returns the matching strategy for a known value', function () {
            assert.ok(selectSortStrategy('reviews') instanceof ReviewCountSort);
            assert.ok(selectSortStrategy('name') instanceof NameSort);
            assert.ok(selectSortStrategy('rating') instanceof RatingSort);
        });

        it('throws on an unknown sort value', function () {
            assert.throws(() => selectSortStrategy('cheapest'), SortError);
        });
    });

    describe('getRestaurants with sort', function () {
        it('200: passes the chosen sort to the query', async function () {
            const limitStub = sandbox.stub().resolves([]);
            const skipStub = sandbox.stub().returns({ limit: limitStub });
            const sortStub = sandbox.stub().returns({ skip: skipStub });
            sandbox.stub(Restaurant, 'find').returns({ sort: sortStub });
            sandbox.stub(Restaurant, 'countDocuments').resolves(0);

            const res = makeResponse();
            await getRestaurants({ query: { sort: 'reviews' } }, res);

            assert.strictEqual(res.statusCode, 200);
            assert(sortStub.calledOnceWithExactly({
                'ratingSummary.reviewCount': -1,
                name: 1
            }));
        });

        it('400: rejects an unknown sort value', async function () {
            const find = sandbox.stub(Restaurant, 'find');

            const res = makeResponse();
            await getRestaurants({ query: { sort: 'cheapest' } }, res);

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.message, 'Sort must be one of rating, reviews or name.');
            assert.strictEqual(find.called, false);
        });
    });
});
