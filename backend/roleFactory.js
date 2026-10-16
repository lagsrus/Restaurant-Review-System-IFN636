const Permissions = Object.freeze({
    BROWSE_RESTAURANTS: 'browse:restaurants',
    CREATE_REVIEW: 'create:review',
    MANAGE_OWN_REVIEWS: 'manage:own-reviews',
    REPORT_REVIEW: 'report:review',
    UPDATE_ANY_REVIEW: 'update:any-review',
    DELETE_ANY_REVIEW: 'delete:any-review'
});

class GuestRole {
    constructor() {
        this.name = 'guest';
        this.permissions = new Set([Permissions.BROWSE_RESTAURANTS]);
    }

    hasPermission(permission) {
        return this.permissions.has(permission);
    }
}

class CustomerRole extends GuestRole {
    constructor() {
        super();
        this.name = 'customer';
        this.additionalPermissions = new Set([
            Permissions.CREATE_REVIEW,
            Permissions.MANAGE_OWN_REVIEWS,
            Permissions.REPORT_REVIEW
        ]);
    }

    hasPermission(permission) {
        return this.additionalPermissions.has(permission) || super.hasPermission(permission);
    }
}

class OwnerRole extends GuestRole {
    constructor() {
        super();
        this.name = 'owner';
        this.additionalPermissions = new Set([Permissions.REPORT_REVIEW]);
    }

    hasPermission(permission) {
        return this.additionalPermissions.has(permission) || super.hasPermission(permission);
    }
}

class AdminRole extends GuestRole {
    constructor() {
        super();
        this.name = 'admin';
        this.additionalPermissions = new Set([
            Permissions.UPDATE_ANY_REVIEW,
            Permissions.DELETE_ANY_REVIEW
        ]);
    }

    hasPermission(permission) {
        return this.additionalPermissions.has(permission) || super.hasPermission(permission);
    }
}

const roleConstructors = new Map([
    ['guest', GuestRole],
    ['customer', CustomerRole],
    ['owner', OwnerRole],
    ['admin', AdminRole]
]);

const createRole = (roleName) => {
    const RoleType = roleConstructors.get(roleName);
    return RoleType ? new RoleType() : null;
};

module.exports = {
    Permissions,
    GuestRole,
    CustomerRole,
    OwnerRole,
    AdminRole,
    createRole
};
