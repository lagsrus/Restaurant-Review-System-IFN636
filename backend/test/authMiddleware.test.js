const assert = require('assert');
const {
    protect,
    authorizeRoles,
    authorizePermissions,
    authorizeAnyPermission
} = require('../middleware/authMiddleware');
const { Permissions } = require('../roleFactory');

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

    it('allows customers to create reviews through their role permissions', function () {
        const req = { user: { role: 'customer' } };
        const res = makeResponse();
        let nextCalled = false;

        authorizePermissions(Permissions.CREATE_REVIEW)(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
    });

    it('denies owners permission to create or manage customer reviews', function () {
        const req = { user: { role: 'owner' } };
        const res = makeResponse();
        let nextCalled = false;

        authorizePermissions(Permissions.CREATE_REVIEW)(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(nextCalled, false);
    });

    it('denies users with unknown roles', function () {
        const req = { user: { role: 'superuser' } };
        const res = makeResponse();
        let nextCalled = false;

        authorizePermissions(Permissions.BROWSE_RESTAURANTS)(req, res, () => {
            nextCalled = true;
        });

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(nextCalled, false);
    });

    it('allows only customers or admins to enter the legacy review delete handler', function () {
        const deniedReq = { user: { role: 'owner' } };
        const deniedRes = makeResponse();
        let deniedNextCalled = false;

        authorizeAnyPermission(
            Permissions.MANAGE_OWN_REVIEWS,
            Permissions.DELETE_ANY_REVIEW
        )(deniedReq, deniedRes, () => {
            deniedNextCalled = true;
        });

        assert.strictEqual(deniedRes.statusCode, 403);
        assert.strictEqual(deniedNextCalled, false);

        const adminReq = { user: { role: 'admin' } };
        const adminRes = makeResponse();
        let adminNextCalled = false;

        authorizeAnyPermission(
            Permissions.MANAGE_OWN_REVIEWS,
            Permissions.DELETE_ANY_REVIEW
        )(adminReq, adminRes, () => {
            adminNextCalled = true;
        });

        assert.strictEqual(adminNextCalled, true);
    });

    it('denies admins and owners access to the legacy review update handler', function () {
        for (const role of ['owner', 'admin']) {
            const res = makeResponse();
            let nextCalled = false;

            authorizeAnyPermission(Permissions.MANAGE_OWN_REVIEWS)(
                { user: { role } },
                res,
                () => {
                    nextCalled = true;
                }
            );

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(nextCalled, false);
        }
    });
});
