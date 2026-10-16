const assert = require('assert');
const sinon = require('sinon');
const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');

const app = require('../server');
const User = require('../models/User');
const Task = require('../models/Task');
const Restaurant = require('../models/Restaurant');
const Review = require('../models/Review');

chai.use(chaiHttp);

describe('FR-01 role-protected routes', function () {
    const sandbox = sinon.createSandbox();
    const ownerId = '507f191e810c19729de860ea';
    const restaurantId = '507f1f77bcf86cd799439011';
    const reviewId = '507f1f77bcf86cd799439012';

    beforeEach(function () {
        sandbox.stub(jwt, 'verify').returns({ id: ownerId });
        sandbox.stub(User, 'findById').returns({
            select: sandbox.stub().resolves({
                _id: ownerId,
                role: 'owner'
            })
        });
        sandbox.stub(Task, 'findById');
        sandbox.stub(Restaurant, 'findById').resolves(null);
        sandbox.stub(Review, 'find');
        sandbox.stub(Review, 'findById');
        sandbox.stub(Review, 'create');
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('allows guests to browse restaurant details without authentication', async function () {
        Restaurant.findById.resolves({
            _id: restaurantId,
            name: 'Public Restaurant'
        });
        const reviewQuery = {
            select: sandbox.stub().returnsThis(),
            sort: sandbox.stub().resolves([])
        };
        Review.find.returns(reviewQuery);

        const response = await chai.request(app)
            .get(`/api/restaurants/${restaurantId}/details`);

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.restaurant.name, 'Public Restaurant');
        assert.strictEqual(jwt.verify.called, false);
    });

    it('prevents owners from creating customer reviews', async function () {
        const response = await chai.request(app)
            .post(`/api/restaurants/${restaurantId}/reviews`)
            .set('Authorization', 'Bearer owner-token')
            .send({
                ratings: { food: 4, service: 4, ambience: 4, value: 4 },
                comment: 'Test'
            })
            .ok(result => result.status === 403);

        assert.strictEqual(response.status, 403);
        assert.strictEqual(Review.create.called, false);
    });

    it('prevents owners from editing or deleting customer reviews', async function () {
        const editResponse = await chai.request(app)
            .put(`/api/reviews/${reviewId}`)
            .set('Authorization', 'Bearer owner-token')
            .send({
                ratings: { food: 4, service: 4, ambience: 4, value: 4 },
                comment: 'Unauthorized'
            })
            .ok(result => result.status === 403);

        const deleteResponse = await chai.request(app)
            .delete(`/api/reviews/${reviewId}`)
            .set('Authorization', 'Bearer owner-token')
            .ok(result => result.status === 403);

        const legacyEditResponse = await chai.request(app)
            .put(`/api/tasks/${reviewId}`)
            .set('Authorization', 'Bearer owner-token')
            .send({ title: 'Unauthorized' })
            .ok(result => result.status === 403);

        const legacyDeleteResponse = await chai.request(app)
            .delete(`/api/tasks/${reviewId}`)
            .set('Authorization', 'Bearer owner-token')
            .ok(result => result.status === 403);

        assert.strictEqual(editResponse.status, 403);
        assert.strictEqual(deleteResponse.status, 403);
        assert.strictEqual(legacyEditResponse.status, 403);
        assert.strictEqual(legacyDeleteResponse.status, 403);
        assert.strictEqual(Review.findById.called, false);
        assert.strictEqual(Task.findById.called, false);
    });
});
