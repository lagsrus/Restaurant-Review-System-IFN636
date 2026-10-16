const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const OwnerClaim = require('../models/OwnerClaim');

chai.use(chaiHttp);

describe('RRP-28 / FR-14: View pending ownership claims', function () {
    const sandbox = sinon.createSandbox();
    const userId = '507f1f77bcf86cd799439011';
    const testSecret = 'isolated-claim-route-test-secret';
    let originalSecret;
    let query;
    let token;
    let userQuery;

    beforeEach(function () {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = testSecret;
        token = jwt.sign({ id: userId }, testSecret, { expiresIn: '5m' });
        userQuery = {
            select: sandbox.stub().resolves({ _id: userId, role: 'admin' })
        };
        sandbox.stub(User, 'findById').returns(userQuery);
        query = {
            select: sandbox.stub().returnsThis(),
            populate: sandbox.stub().returnsThis(),
            sort: sandbox.stub().returnsThis(),
            lean: sandbox.stub().resolves([])
        };
        sandbox.stub(OwnerClaim, 'find').returns(query);
        sandbox.stub(console, 'error');
    });

    afterEach(function () {
        sandbox.restore();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    function requestWithToken(value = token) {
        return chai.request(app).get('/api/admin/claims')
            .set('Authorization', `Bearer ${value}`);
    }

    it('200: admin receives pending claims with applicant and restaurant details', async function () {
        const claims = [{
            _id: '507f1f77bcf86cd799439012',
            restaurantId: { _id: '507f1f77bcf86cd799439013', name: 'Test Kitchen' },
            userId: { _id: userId, name: 'Test Owner', email: 'owner@example.test' },
            message: 'I own this restaurant.',
            status: 'pending',
            createdAt: '2026-10-16T00:00:00.000Z'
        }];
        query.lean.resolves(claims);

        const res = await requestWithToken();

        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, claims);
        sinon.assert.calledOnceWithExactly(OwnerClaim.find, { status: 'pending' });
        sinon.assert.calledOnceWithExactly(query.select, 'restaurantId userId message status createdAt');
        sinon.assert.calledWithExactly(query.populate, 'restaurantId', 'name');
        sinon.assert.calledWithExactly(query.populate, 'userId', 'name email');
        sinon.assert.calledOnceWithExactly(query.sort, { createdAt: 1, _id: 1 });
    });

    it('200: admin receives an empty array when there are no pending claims', async function () {
        const res = await requestWithToken();
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, []);
    });

    it('401: a request without a token cannot query claims', async function () {
        const res = await chai.request(app).get('/api/admin/claims');
        assert.strictEqual(res.status, 401);
        sinon.assert.notCalled(User.findById);
        sinon.assert.notCalled(OwnerClaim.find);
    });

    it('401: an invalid token cannot query claims', async function () {
        const res = await requestWithToken('invalid-token');
        assert.strictEqual(res.status, 401);
        sinon.assert.notCalled(OwnerClaim.find);
    });

    it('401: an expired token cannot query claims', async function () {
        const expired = jwt.sign({ id: userId }, testSecret, { expiresIn: -1 });
        const res = await requestWithToken(expired);
        assert.strictEqual(res.status, 401);
        sinon.assert.notCalled(OwnerClaim.find);
    });

    it('401: a token for a removed user cannot query claims', async function () {
        userQuery.select.resolves(null);
        const res = await requestWithToken();
        assert.strictEqual(res.status, 401);
        sinon.assert.notCalled(OwnerClaim.find);
    });

    for (const role of ['customer', 'owner']) {
        it(`403: ${role} cannot query claims even with a valid token`, async function () {
            userQuery.select.resolves({ _id: userId, role });
            const res = await requestWithToken();
            assert.strictEqual(res.status, 403);
            sinon.assert.notCalled(OwnerClaim.find);
        });
    }

    it('500: a database failure returns a safe error rather than an empty list', async function () {
        query.lean.rejects(new Error('Internal database connection details'));
        const res = await requestWithToken();
        assert.strictEqual(res.status, 500);
        assert.deepStrictEqual(res.body, { message: 'Could not load ownership claims.' });
    });
});
