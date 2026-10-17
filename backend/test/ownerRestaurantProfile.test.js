const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

const app = require('../server');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

chai.use(chaiHttp);

describe('FR-12: Owner restaurant profile management', function () {
    const sandbox = sinon.createSandbox();
    const ownerId = '507f191e810c19729de860ea';
    const otherOwnerId = '507f191e810c19729de860eb';
    const restaurantId = '507f1f77bcf86cd799439011';
    const secret = 'isolated-owner-profile-test-secret';
    let originalSecret;
    let userQuery;
    let restaurant;

    beforeEach(function () {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        userQuery = {
            select: sandbox.stub().resolves({ _id: ownerId, role: 'owner' })
        };
        restaurant = { _id: restaurantId, ownerId };
        sandbox.stub(User, 'findById').returns(userQuery);
        sandbox.stub(Restaurant, 'findById').resolves(restaurant);
        sandbox.stub(Restaurant, 'findOneAndUpdate').resolves({
            ...restaurant,
            name: 'Updated Kitchen'
        });
        sandbox.stub(console, 'error');
    });

    afterEach(function () {
        sandbox.restore();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    function request(body, role = 'owner', requestOwnerId = ownerId, id = restaurantId) {
        const token = jwt.sign({ id: requestOwnerId }, secret, { expiresIn: '5m' });
        userQuery.select.resolves({ _id: requestOwnerId, role });
        return chai.request(app)
            .patch(`/api/restaurants/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    it('200: an approved owner updates profile fields only on their restaurant', async function () {
        const body = {
            name: ' Updated Kitchen ',
            menuUrl: 'https://example.test/menu',
            imageUrls: ['https://example.test/photo.jpg']
        };
        const res = await request(body);

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.name, 'Updated Kitchen');
        sinon.assert.calledOnceWithExactly(Restaurant.findById, restaurantId);
        sinon.assert.calledOnceWithExactly(
            Restaurant.findOneAndUpdate,
            { _id: restaurantId, ownerId },
            { $set: {
                name: 'Updated Kitchen',
                menuUrl: 'https://example.test/menu',
                imageUrls: ['https://example.test/photo.jpg']
            } },
            { new: true, runValidators: true }
        );
    });

    it('200: a partial location update leaves omitted location fields untouched', async function () {
        const res = await request({ location: { suburb: 'New suburb' } });

        assert.strictEqual(res.status, 200);
        sinon.assert.calledOnceWithExactly(
            Restaurant.findOneAndUpdate,
            { _id: restaurantId, ownerId },
            { $set: { 'location.suburb': 'New suburb' } },
            { new: true, runValidators: true }
        );
    });

    it('401: unauthenticated requests cannot update a restaurant', async function () {
        const res = await chai.request(app)
            .patch(`/api/restaurants/${restaurantId}`)
            .send({ name: 'Changed' });

        assert.strictEqual(res.status, 401);
        sinon.assert.notCalled(Restaurant.findOneAndUpdate);
    });

    for (const role of ['customer', 'admin']) {
        it(`403: ${role} accounts cannot use the owner update endpoint`, async function () {
            const res = await request({ name: 'Changed' }, role).ok(response => response.status === 403);

            assert.strictEqual(res.status, 403);
            sinon.assert.notCalled(Restaurant.findById);
            sinon.assert.notCalled(Restaurant.findOneAndUpdate);
        });
    }

    it('403: an owner cannot update a restaurant assigned to someone else', async function () {
        restaurant.ownerId = otherOwnerId;
        const res = await request({ name: 'Changed' }).ok(response => response.status === 403);

        assert.strictEqual(res.status, 403);
        sinon.assert.notCalled(Restaurant.findOneAndUpdate);
    });

    it('400: rejects an invalid restaurant ID before database access', async function () {
        const res = await request({ name: 'Changed' }, 'owner', ownerId, 'not-an-id')
            .ok(response => response.status === 400);

        assert.strictEqual(res.status, 400);
        sinon.assert.notCalled(Restaurant.findById);
        sinon.assert.notCalled(Restaurant.findOneAndUpdate);
    });

    it('404: rejects a restaurant that does not exist', async function () {
        Restaurant.findById.resolves(null);
        const res = await request({ name: 'Changed' }).ok(response => response.status === 404);

        assert.strictEqual(res.status, 404);
        sinon.assert.notCalled(Restaurant.findOneAndUpdate);
    });

    it('400: rejects invalid profile data and protected fields', async function () {
        for (const body of [
            { menuUrl: 'javascript:alert(1)' },
            { imageUrls: Array(11).fill('https://example.test/photo.jpg') },
            { ownerId },
            { ratingSummary: { avgRating: 5 } },
            {}
        ]) {
            const res = await request(body).ok(response => response.status === 400);
            assert.strictEqual(res.status, 400);
        }
        sinon.assert.notCalled(Restaurant.findOneAndUpdate);
    });

    it('403: does not write if ownership changes during the update', async function () {
        Restaurant.findOneAndUpdate.resolves(null);
        Restaurant.findById.onSecondCall().resolves({ ...restaurant, ownerId: otherOwnerId });
        const res = await request({ name: 'Changed' }).ok(response => response.status === 403);

        assert.strictEqual(res.status, 403);
        sinon.assert.calledOnce(Restaurant.findOneAndUpdate);
    });

    it('404: reports a restaurant deleted during the update', async function () {
        Restaurant.findOneAndUpdate.resolves(null);
        Restaurant.findById.onSecondCall().resolves(null);
        const res = await request({ name: 'Changed' }).ok(response => response.status === 404);

        assert.strictEqual(res.status, 404);
    });
});
