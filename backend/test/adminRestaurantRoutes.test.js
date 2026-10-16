const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Review = require('../models/Review');
const Report = require('../models/Report');
const OwnerClaim = require('../models/OwnerClaim');

chai.use(chaiHttp);

describe('RRP-29 / FR-15 / NFR-02: Admin restaurant management', function () {
    const sandbox = sinon.createSandbox();
    const id = '507f1f77bcf86cd799439011';
    const userId = '507f1f77bcf86cd799439012';
    const reviewId = '507f1f77bcf86cd799439013';
    const secret = 'isolated-restaurant-route-test-secret';
    const session = { testSession: true };
    let originalSecret, token, userQuery, listQuery, reviewQuery;
    const restaurant = { _id: id, name: 'Test Kitchen' };

    beforeEach(function () {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        token = jwt.sign({ id: userId }, secret, { expiresIn: '5m' });
        userQuery = { select: sandbox.stub().resolves({ _id: userId, role: 'admin' }) };
        sandbox.stub(User, 'findById').returns(userQuery);
        listQuery = { sort: sandbox.stub().returnsThis(), lean: sandbox.stub().resolves([restaurant]) };
        sandbox.stub(Restaurant, 'find').returns(listQuery);
        sandbox.stub(Restaurant, 'create').callsFake(async data => ({ _id: id, ...data }));
        sandbox.stub(Restaurant, 'findByIdAndUpdate').resolves(restaurant);
        sandbox.stub(Restaurant, 'findOneAndDelete').resolves(restaurant);
        reviewQuery = {
            select: sandbox.stub().returnsThis(), session: sandbox.stub().returnsThis(),
            lean: sandbox.stub().resolves([{ _id: reviewId }])
        };
        sandbox.stub(Review, 'find').returns(reviewQuery);
        for (const model of [Review, Report, OwnerClaim]) sandbox.stub(model, 'deleteMany').resolves({ deletedCount: 1 });
        sandbox.stub(mongoose.connection, 'transaction').callsFake(async callback => {
            await callback(session);
            return { ok: 1 }; // Mongoose 6 returns the commit result.
        });
        sandbox.stub(console, 'error');
    });
    afterEach(function () {
        sandbox.restore();
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });
    function request(method, path = '', body, auth = token) {
        let req = chai.request(app)[method](`/api/admin/restaurants${path}`);
        if (auth) req = req.set('Authorization', `Bearer ${auth}`);
        return body === undefined ? req : req.send(body);
    }
    function noWrites() {
        sinon.assert.notCalled(Restaurant.create);
        sinon.assert.notCalled(Restaurant.findByIdAndUpdate);
        sinon.assert.notCalled(mongoose.connection.transaction);
    }

    it('200: admin can list restaurants', async function () {
        const res = await request('get');
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, [restaurant]);
    });
    it('200: an empty collection returns an empty list', async function () {
        listQuery.lean.resolves([]);
        assert.deepStrictEqual((await request('get')).body, []);
    });
    it('201: creates valid details and trims text', async function () {
        const res = await request('post', '', {
            name: ' Test Kitchen ', cuisine: 'Thai', priceLevel: 2, description: ' Lunch ',
            phone: '123', openingHours: '9–5', location: { address: ' Main St ', suburb: 'City', latitude: -27, longitude: 153, mapsUrl: 'https://example.test/map' },
            imageUrls: ['https://example.test/photo.jpg'], menuUrl: '', websiteUrl: 'http://example.test'
        });
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.name, 'Test Kitchen');
        assert.strictEqual(res.body.location.address, 'Main St');
        sinon.assert.calledOnce(Restaurant.create);
    });
    it('200: partial edit preserves omitted location fields and uses model validators', async function () {
        const res = await request('patch', `/${id}`, { location: { suburb: 'New suburb' } });
        assert.strictEqual(res.status, 200);
        sinon.assert.calledOnceWithExactly(Restaurant.findByIdAndUpdate, id,
            { $set: { 'location.suburb': 'New suburb' } }, { new: true, runValidators: true });
    });
    it('200: optional text, coordinates and images can be cleared', async function () {
        const res = await request('patch', `/${id}`, { description: '', imageUrls: [], location: { latitude: null, longitude: null } });
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(Restaurant.findByIdAndUpdate.firstCall.args[1].$set,
            { description: '', imageUrls: [], 'location.latitude': null, 'location.longitude': null });
    });
    const invalidBodies = [
        ['blank name', { name: '   ' }], ['non-text name', { name: 123 }],
        ['long name', { name: 'x'.repeat(121) }], ['long cuisine', { cuisine: 'x'.repeat(81) }],
        ['long description', { description: 'x'.repeat(2001) }], ['long phone', { phone: 'x'.repeat(51) }],
        ['long opening hours', { openingHours: 'x'.repeat(501) }], ['object text', { description: {} }],
        ['low price', { priceLevel: 0 }], ['high price', { priceLevel: 4 }],
        ['decimal price', { priceLevel: 1.5 }], ['text price', { priceLevel: '2' }],
        ['script URL', { websiteUrl: 'javascript:alert(1)' }], ['relative URL', { menuUrl: '/menu' }],
        ['malformed URL', { websiteUrl: 'https://' }], ['URL with credentials', { websiteUrl: 'https://user:pass@example.test' }],
        ['long URL', { websiteUrl: `https://example.test/${'x'.repeat(2048)}` }],
        ['non-array images', { imageUrls: 'https://example.test/a.jpg' }],
        ['too many images', { imageUrls: Array(11).fill('https://example.test/a.jpg') }],
        ['empty image URL', { imageUrls: [''] }], ['invalid image URL', { imageUrls: ['data:image/png,abc'] }],
        ['array location', { location: [] }], ['null location', { location: null }],
        ['unknown location', { location: { rating: 5 } }], ['long address', { location: { address: 'x'.repeat(301) } }],
        ['invalid latitude', { location: { latitude: 91 } }], ['invalid longitude', { location: { longitude: -181 } }],
        ['text coordinate', { location: { latitude: '12' } }], ['unsafe map', { location: { mapsUrl: 'ftp://example.test' } }],
        ['ownership override', { ownerId: userId }], ['ratings override', { ratingSummary: { avgRating: 5 } }],
        ['operator injection', { $set: { name: 'Injected' } }], ['timestamp override', { createdAt: '2026-01-01' }]
    ];
    for (const [label, body] of invalidBodies) {
        it(`400: ${label} is not saved`, async function () {
            for (const [method, path, payload] of [['post', '', { name: 'Valid', ...body }], ['patch', `/${id}`, body]]) {
                const res = await request(method, path, payload);
                assert.strictEqual(res.status, 400);
                assert.deepStrictEqual(Object.keys(res.body), ['message']);
                assert.ok(res.body.message.length > 0);
            }
            noWrites();
        });
    }
    it('400: missing required name is rejected on create', async function () {
        assert.strictEqual((await request('post', '', { cuisine: 'Thai' })).status, 400);
        noWrites();
    });
    it('400: empty or array input does not update a record', async function () {
        for (const body of [{}, [], { location: {} }]) assert.strictEqual((await request('patch', `/${id}`, body)).status, 400);
        noWrites();
    });
    it('400: malformed JSON returns a clear JSON error without an HTML stack trace', async function () {
        const res = await chai.request(app).post('/api/admin/restaurants').set('Content-Type', 'application/json').send('{broken');
        assert.strictEqual(res.status, 400);
        assert.deepStrictEqual(res.body, { message: 'Request body must be valid JSON.' });
        noWrites();
    });
    for (const method of ['patch', 'delete']) {
        it(`400: ${method} rejects malformed and 12-character IDs`, async function () {
            for (const badId of ['invalid', 'abcdefghijkl']) assert.strictEqual((await request(method, `/${badId}`, { name: 'Valid' })).status, 400);
            noWrites();
        });
        it(`404: ${method} handles a missing restaurant`, async function () {
            Restaurant.findByIdAndUpdate.resolves(null);
            Restaurant.findOneAndDelete.resolves(null);
            assert.strictEqual((await request(method, `/${id}`, { name: 'Valid' })).status, 404);
            sinon.assert.notCalled(Review.deleteMany);
        });
    }
    for (const [method, path] of [['get', ''], ['post', ''], ['patch', `/${id}`], ['delete', `/${id}`]]) {
        for (const role of [null, 'customer', 'owner']) {
            it(`${role ? 403 : 401}: ${role || 'anonymous'} cannot ${method} restaurants`, async function () {
                userQuery.select.resolves({ _id: userId, role });
                const res = await request(method, path, { name: 'Valid' }, role ? token : null);
                assert.strictEqual(res.status, role ? 403 : 401);
                sinon.assert.notCalled(Restaurant.find);
                noWrites();
            });
        }
    }
    it('401: an invalid token cannot delete data', async function () {
        assert.strictEqual((await request('delete', `/${id}`, undefined, 'invalid-token')).status, 401);
        noWrites();
    });
    it('200: deletion scopes every related record to the restaurant in the same transaction', async function () {
        const res = await request('delete', `/${id}`);
        assert.strictEqual(res.status, 200);
        sinon.assert.calledOnceWithExactly(Restaurant.findOneAndDelete, { _id: id }, { session });
        sinon.assert.calledOnceWithExactly(Review.find, { restaurantId: id });
        sinon.assert.calledOnceWithExactly(reviewQuery.session, session);
        sinon.assert.calledOnceWithExactly(Report.deleteMany, { reviewId: { $in: [reviewId] } }, { session });
        sinon.assert.calledOnceWithExactly(Review.deleteMany, { restaurantId: id }, { session });
        sinon.assert.calledOnceWithExactly(OwnerClaim.deleteMany, { restaurantId: id }, { session });
    });
    for (const [label, method, path, failure] of [
        ['list', 'get', '', () => listQuery.lean], ['create', 'post', '', () => Restaurant.create],
        ['update', 'patch', `/${id}`, () => Restaurant.findByIdAndUpdate],
        ['delete', 'delete', `/${id}`, () => Report.deleteMany],
        ['commit', 'delete', `/${id}`, () => mongoose.connection.transaction]
    ]) {
        it(`500: ${label} failure returns a safe error`, async function () {
            failure().rejects(new Error('private database connection information'));
            const res = await request(method, path, { name: 'Valid' });
            assert.strictEqual(res.status, 500);
            assert.deepStrictEqual(res.body, { message: 'Could not complete the restaurant operation.' });
        });
    }
});
