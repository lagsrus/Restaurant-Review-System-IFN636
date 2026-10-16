const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../server');
const OwnerClaim = require('../models/OwnerClaim');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

chai.use(chaiHttp);

describe('RRP-28 / FR-14 / NFR-02: Decide ownership claims', function () {
    const sandbox = sinon.createSandbox();
    const claimId = '507f1f77bcf86cd799439012';
    const adminId = '507f1f77bcf86cd799439011';
    const ownerId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439014');
    const restaurantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');
    const secret = 'isolated-claim-decision-test-secret';
    let originalSecret, token, authQuery, claimQuery, restaurantQuery, applicantQuery;
    let claim, restaurant, session, transaction;

    beforeEach(function () {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        token = jwt.sign({ id: adminId }, secret, { expiresIn: '5m' });
        authQuery = { select: sandbox.stub().resolves({ _id: adminId, role: 'admin' }) };
        sandbox.stub(User, 'findById').returns(authQuery);
        claim = {
            _id: claimId, restaurantId, userId: ownerId, status: 'pending',
            decidedBy: null, decidedAt: null, save: sandbox.stub().resolves()
        };
        restaurant = { _id: restaurantId, ownerId: null, save: sandbox.stub().resolves() };
        claimQuery = { session: sandbox.stub().resolves(claim) };
        restaurantQuery = { session: sandbox.stub().resolves(restaurant) };
        applicantQuery = { session: sandbox.stub().resolves({ _id: ownerId, role: 'owner' }) };
        sandbox.stub(OwnerClaim, 'findById').returns(claimQuery);
        sandbox.stub(Restaurant, 'findById').returns(restaurantQuery);
        sandbox.stub(User, 'findOne').returns(applicantQuery);
        session = {};
        // Exercise the callback, not a real database transaction. These tests do
        // not prove MongoDB rollback/concurrency; those require integration tests.
        transaction = sandbox.stub(mongoose.connection, 'transaction')
            .callsFake(async callback => callback(session));
        sandbox.stub(console, 'error');
    });

    afterEach(function () {
        sandbox.restore();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    function request(body = { decision: 'approved' }, id = claimId, accessToken = token) {
        const call = chai.request(app).patch(`/api/admin/claims/${id}`);
        if (accessToken) call.set('Authorization', `Bearer ${accessToken}`);
        return call.send(body);
    }

    for (const body of ['{"decision":', '{"decision":"approved",}', 'null']) {
        it(`400: malformed JSON returns a safe message without database work (${body})`, async function () {
            const res = await chai.request(app).patch(`/api/admin/claims/${claimId}`)
                .set('Authorization', `Bearer ${token}`)
                .set('Content-Type', 'application/json').send(body);
            assert.strictEqual(res.status, 400);
            assert.match(res.headers['content-type'], /application\/json/);
            assert.deepStrictEqual(res.body, { message: 'Request body must be valid JSON.' });
            sinon.assert.notCalled(User.findById);
            sinon.assert.notCalled(transaction);
            sinon.assert.notCalled(claim.save);
            sinon.assert.notCalled(restaurant.save);
        });
    }

    it('200: approval assigns the applicant and records the authenticated admin and time', async function () {
        const before = Date.now();
        const res = await request({ decision: 'approved', decidedBy: 'forged-admin', decidedAt: '2000-01-01' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(restaurant.ownerId, ownerId);
        assert.strictEqual(claim.status, 'approved');
        assert.strictEqual(res.body.decidedBy, adminId);
        assert.ok(new Date(res.body.decidedAt).getTime() >= before);
        sinon.assert.calledOnceWithExactly(claimQuery.session, session);
        sinon.assert.calledOnceWithExactly(restaurantQuery.session, session);
        sinon.assert.calledOnceWithExactly(applicantQuery.session, session);
        sinon.assert.calledOnceWithExactly(User.findOne, { _id: ownerId, role: 'owner' });
        sinon.assert.calledOnceWithExactly(restaurant.save, { session });
        sinon.assert.calledOnceWithExactly(claim.save, { session });
    });

    it('200: rejection records the decision without reading or changing restaurant ownership', async function () {
        const res = await request({ decision: 'rejected' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'rejected');
        assert.strictEqual(res.body.decidedBy, adminId);
        assert.ok(res.body.decidedAt);
        sinon.assert.notCalled(Restaurant.findById);
        sinon.assert.notCalled(restaurant.save);
        sinon.assert.calledOnceWithExactly(claim.save, { session });
    });

    for (const decision of [undefined, null, '', 'approve', 'pending', {}, ['approved']]) {
        it(`400: rejects invalid decision ${JSON.stringify(decision)} before database work`, async function () {
            const res = await request({ decision });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.message, 'Decision must be approved or rejected.');
            sinon.assert.notCalled(transaction);
            sinon.assert.notCalled(claim.save);
        });
    }

    for (const id of ['not-an-id', 'abcdefghijkl', 'z'.repeat(24)]) {
        it(`400: rejects malformed ID ${id} before database work`, async function () {
            const res = await request({ decision: 'approved' }, id);
            assert.strictEqual(res.status, 400);
            sinon.assert.notCalled(transaction);
        });
    }

    for (const access of ['missing', 'invalid', 'expired', 'removed', 'customer', 'owner']) {
        it(`${access}: blocks the request before any claim query or transaction`, async function () {
            let accessToken = token;
            let expected = 401;
            if (access === 'missing') accessToken = null;
            if (access === 'invalid') accessToken = 'invalid';
            if (access === 'expired') accessToken = jwt.sign({ id: adminId }, secret, { expiresIn: -1 });
            if (access === 'removed') authQuery.select.resolves(null);
            if (['customer', 'owner'].includes(access)) {
                authQuery.select.resolves({ _id: adminId, role: access });
                expected = 403;
            }
            const res = await request({ decision: 'approved' }, claimId, accessToken);
            assert.strictEqual(res.status, expected);
            sinon.assert.notCalled(transaction);
            sinon.assert.notCalled(OwnerClaim.findById);
        });
    }

    it('404: a well-formed but missing claim does not write anything', async function () {
        claimQuery.session.resolves(null);
        const res = await request();
        assert.strictEqual(res.status, 404);
        sinon.assert.notCalled(restaurant.save);
        sinon.assert.notCalled(claim.save);
    });

    for (const status of ['approved', 'rejected']) {
        it(`409: cannot overwrite an already ${status} claim`, async function () {
            claim.status = status;
            const res = await request();
            assert.strictEqual(res.status, 409);
            sinon.assert.notCalled(Restaurant.findById);
            sinon.assert.notCalled(claim.save);
        });
    }

    it('404: cannot approve a claim for a missing restaurant', async function () {
        restaurantQuery.session.resolves(null);
        const res = await request();
        assert.strictEqual(res.status, 404);
        sinon.assert.notCalled(claim.save);
    });

    it('409: cannot approve a claim whose applicant is no longer an owner account', async function () {
        applicantQuery.session.resolves(null);
        const res = await request();
        assert.strictEqual(res.status, 409);
        sinon.assert.notCalled(restaurant.save);
        sinon.assert.notCalled(claim.save);
    });

    it('409: cannot replace a different existing restaurant owner', async function () {
        restaurant.ownerId = new mongoose.Types.ObjectId();
        const res = await request();
        assert.strictEqual(res.status, 409);
        sinon.assert.notCalled(restaurant.save);
        sinon.assert.notCalled(claim.save);
    });

    it('200: a pending claim can be approved if the restaurant already belongs to that applicant', async function () {
        restaurant.ownerId = ownerId;
        const res = await request();
        assert.strictEqual(res.status, 200);
    });

    for (const failure of ['restaurant save', 'claim save', 'commit']) {
        it(`500: ${failure} failure propagates out of the transaction and returns a safe error`, async function () {
            const error = new Error('Private database connection details');
            if (failure === 'restaurant save') restaurant.save.rejects(error);
            if (failure === 'claim save') claim.save.rejects(error);
            if (failure === 'commit') {
                transaction.callsFake(async callback => { await callback(session); throw error; });
            }
            const res = await request();
            assert.strictEqual(res.status, 500);
            assert.deepStrictEqual(res.body, { message: 'Could not save the claim decision.' });
            await assert.rejects(transaction.firstCall.returnValue, err => err === error);
            if (failure === 'restaurant save') sinon.assert.notCalled(claim.save);
        });
    }
});
