const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

const app = require('../server');
const OwnerClaim = require('../models/OwnerClaim');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

chai.use(chaiHttp);

describe('FR-11: Owner restaurant claims', function () {
    const sandbox = sinon.createSandbox();
    const ownerId = '507f191e810c19729de860ea';
    const restaurantId = '507f1f77bcf86cd799439011';
    const secret = 'isolated-owner-claim-test-secret';
    let originalSecret;
    let userQuery;
    let restaurant;

    beforeEach(function () {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        userQuery = {
            select: sandbox.stub().resolves({ _id: ownerId, role: 'owner' })
        };
        restaurant = { _id: restaurantId, ownerId: null };
        sandbox.stub(User, 'findById').returns(userQuery);
        sandbox.stub(Restaurant, 'findById').resolves(restaurant);
        sandbox.stub(OwnerClaim, 'create').callsFake(async claim => ({
            _id: '507f1f77bcf86cd799439012',
            ...claim
        }));
        sandbox.stub(console, 'error');
    });

    afterEach(function () {
        sandbox.restore();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    function request(body = {}, accessRole = 'owner') {
        const token = jwt.sign({ id: ownerId }, secret, { expiresIn: '5m' });
        const call = chai.request(app)
            .post(`/api/restaurants/${restaurantId}/claims`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
        if (accessRole !== 'owner') {
            userQuery.select.resolves({ _id: ownerId, role: accessRole });
        }
        return call;
    }

    it('201: owner submits a pending claim with an optional trimmed message', async function () {
        const res = await request({
            message: '  I operate this restaurant.  ',
            userId: 'forged-user',
            status: 'approved',
            decidedBy: 'forged-admin'
        });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.message, 'Claim submitted for administrator review.');
        assert.strictEqual(res.body.claim.status, 'pending');
        sinon.assert.calledOnceWithExactly(OwnerClaim.create, {
            restaurantId,
            userId: ownerId,
            message: 'I operate this restaurant.',
            status: 'pending'
        });
    });

    it('201: owner may submit without a message', async function () {
        const res = await request();
        assert.strictEqual(res.status, 201);
        sinon.assert.calledOnceWithExactly(OwnerClaim.create, {
            restaurantId,
            userId: ownerId,
            message: '',
            status: 'pending'
        });
    });

    it('401: unauthenticated requests cannot submit a claim', async function () {
        const res = await chai.request(app)
            .post(`/api/restaurants/${restaurantId}/claims`)
            .send({});

        assert.strictEqual(res.status, 401);
        sinon.assert.notCalled(Restaurant.findById);
        sinon.assert.notCalled(OwnerClaim.create);
    });

    for (const role of ['customer', 'admin']) {
        it(`403: ${role} cannot submit an owner claim`, async function () {
            const res = await request({}, role).ok(response => response.status === 403);
            assert.strictEqual(res.status, 403);
            sinon.assert.notCalled(Restaurant.findById);
            sinon.assert.notCalled(OwnerClaim.create);
        });
    }

    it('400: rejects invalid restaurant IDs before database access', async function () {
        const res = await chai.request(app)
            .post('/api/restaurants/not-an-id/claims')
            .set('Authorization', `Bearer ${jwt.sign({ id: ownerId }, secret)}`)
            .send({});

        assert.strictEqual(res.status, 400);
        sinon.assert.notCalled(Restaurant.findById);
        sinon.assert.notCalled(OwnerClaim.create);
    });

    it('400: rejects non-text or oversized messages', async function () {
        for (const message of [4, 'x'.repeat(501)]) {
            const res = await request({ message }).ok(response => response.status === 400);
            assert.strictEqual(res.status, 400);
        }
        sinon.assert.notCalled(OwnerClaim.create);
    });

    it('404: rejects a restaurant that does not exist', async function () {
        Restaurant.findById.resolves(null);
        const res = await request().ok(response => response.status === 404);
        assert.strictEqual(res.status, 404);
        sinon.assert.notCalled(OwnerClaim.create);
    });

    it('409: rejects a restaurant that already has an owner', async function () {
        restaurant.ownerId = '507f191e810c19729de860eb';
        const res = await request().ok(response => response.status === 409);
        assert.strictEqual(res.status, 409);
        sinon.assert.notCalled(OwnerClaim.create);
    });

    it('409: reports an existing claim without exposing duplicate-key errors', async function () {
        OwnerClaim.create.rejects({ code: 11000 });
        const res = await request().ok(response => response.status === 409);

        assert.strictEqual(res.status, 409);
        assert.strictEqual(res.body.message, 'You have already submitted a claim for this restaurant.');
    });

    it('500: reports an unexpected persistence failure safely', async function () {
        OwnerClaim.create.rejects(new Error('private database error'));
        const res = await request().ok(response => response.status === 500);

        assert.strictEqual(res.status, 500);
        assert.deepStrictEqual(res.body, { message: 'Could not submit the ownership claim.' });
        sinon.assert.calledOnce(console.error);
    });
});
