const assert = require('assert');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

function makeResponse() {
    return {
        statusCode: 200,
        body: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

describe('authorizeRoles middleware', function () {
    it('returns 401 when protect receives no authentication token', async function () {
        const req = { headers: {} };
        const res = makeResponse();
        let nextCalled = false;

        await protect(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(nextCalled, false);
    });

    it('returns 401 when there is no authenticated user', function () {
        const req = {};
        const res = makeResponse();
        let nextCalled = false;

        authorizeRoles('admin')(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(nextCalled, false);
    });

    it('returns 403 when the user role is not permitted', function () {
        const req = { user: { role: 'customer' } };
        const res = makeResponse();
        let nextCalled = false;

        authorizeRoles('admin')(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(nextCalled, false);
    });

    it('allows an owner when owner access is permitted', function () {
        const req = { user: { role: 'owner' } };
        const res = makeResponse();
        let nextCalled = false;

        authorizeRoles('owner', 'admin')(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
    });

    it('allows an admin when admin access is permitted', function () {
        const req = { user: { role: 'admin' } };
        const res = makeResponse();
        let nextCalled = false;

        authorizeRoles('admin')(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
    });
});
