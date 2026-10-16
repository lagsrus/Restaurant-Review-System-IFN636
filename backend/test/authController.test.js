const assert = require('assert');
const sinon = require('sinon');
const bcrypt = require('bcrypt');

const User = require('../models/User');
const { registerUser, loginUser } = require('../controllers/authController');

describe('authController role handling', function () {
    const sandbox = sinon.createSandbox();
    const originalJwtSecret = process.env.JWT_SECRET;

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

    beforeEach(function () {
        process.env.JWT_SECRET = 'test-jwt-secret';
        sandbox.stub(User, 'findOne').resolves(null);
        sandbox.stub(User, 'create').callsFake(async user => ({
            id: '507f1f77bcf86cd799439011',
            ...user
        }));
    });

    afterEach(function () {
        sandbox.restore();
        if (originalJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalJwtSecret;
        }
    });

    it('registers customer and owner roles requested by the user', async function () {
        for (const role of ['customer', 'owner']) {
            const res = makeResponse();

            await registerUser({
                body: { name: 'Test User', email: `${role}@example.com`, password: 'secret', role }
            }, res);

            assert.strictEqual(res.statusCode, 201);
            assert.strictEqual(res.body.role, role);
            assert.strictEqual(User.create.lastCall.args[0].role, role);
        }
    });

    it('defaults registration without a role to customer', async function () {
        const res = makeResponse();

        await registerUser({
            body: { name: 'Test User', email: 'customer@example.com', password: 'secret' }
        }, res);

        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.body.role, 'customer');
    });

    it('rejects public registration with the admin role', async function () {
        const res = makeResponse();

        await registerUser({
            body: { name: 'Test Admin', email: 'admin@example.com', password: 'secret', role: 'admin' }
        }, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(User.create.called, false);
    });

    it('returns the stored role when logging in', async function () {
        User.findOne.resolves({
            id: '507f1f77bcf86cd799439011',
            name: 'Restaurant Owner',
            email: 'owner@example.com',
            password: 'hashed-password',
            role: 'owner'
        });
        sandbox.stub(bcrypt, 'compare').resolves(true);
        const res = makeResponse();

        await loginUser({
            body: { email: 'owner@example.com', password: 'secret' }
        }, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.role, 'owner');
    });
});
