const assert = require('assert');
const {
    Permissions,
    GuestRole,
    CustomerRole,
    OwnerRole,
    AdminRole,
    createRole
} = require('../roleFactory');

describe('roleFactory', function () {
    it('creates each supported role type', function () {
        assert.ok(createRole('guest') instanceof GuestRole);
        assert.ok(createRole('customer') instanceof CustomerRole);
        assert.ok(createRole('owner') instanceof OwnerRole);
        assert.ok(createRole('admin') instanceof AdminRole);
    });

    it('returns no role for unsupported values', function () {
        assert.strictEqual(createRole('superuser'), null);
        assert.strictEqual(createRole(undefined), null);
    });

    it('inherits public browsing permission for customer, owner, and admin', function () {
        for (const roleName of ['customer', 'owner', 'admin']) {
            assert.strictEqual(
                createRole(roleName).hasPermission(Permissions.BROWSE_RESTAURANTS),
                true
            );
        }
    });

    it('grants review creation and management only to customers', function () {
        const customer = createRole('customer');
        const owner = createRole('owner');
        const guest = createRole('guest');

        assert.strictEqual(customer.hasPermission(Permissions.CREATE_REVIEW), true);
        assert.strictEqual(customer.hasPermission(Permissions.MANAGE_OWN_REVIEWS), true);
        assert.strictEqual(owner.hasPermission(Permissions.CREATE_REVIEW), false);
        assert.strictEqual(owner.hasPermission(Permissions.MANAGE_OWN_REVIEWS), false);
        assert.strictEqual(guest.hasPermission(Permissions.CREATE_REVIEW), false);
    });

    it('keeps global legacy review deletion permission exclusive to admins', function () {
        assert.strictEqual(
            createRole('admin').hasPermission(Permissions.DELETE_ANY_REVIEW),
            true
        );
        assert.strictEqual(
            createRole('customer').hasPermission(Permissions.DELETE_ANY_REVIEW),
            false
        );
        assert.strictEqual(
            createRole('owner').hasPermission(Permissions.DELETE_ANY_REVIEW),
            false
        );
    });

    it('denies admins review updates while preserving review deletion', function () {
        assert.strictEqual(
            createRole('admin').hasPermission(Permissions.MANAGE_OWN_REVIEWS),
            false
        );
        assert.strictEqual(
            createRole('admin').hasPermission(Permissions.DELETE_ANY_REVIEW),
            true
        );
        assert.strictEqual(
            createRole('owner').hasPermission(Permissions.MANAGE_OWN_REVIEWS),
            false
        );
    });
});
