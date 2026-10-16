const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createRole } = require('../roleFactory');

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const role = createRole(req.user.role);

        if (!role || !roles.includes(role.name)) {
            return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }

        next();
    };
};

const authorizePermissions = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const role = createRole(req.user.role);

        if (!role || !permissions.every(permission => role.hasPermission(permission))) {
            return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }

        next();
    };
};

const authorizeAnyPermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const role = createRole(req.user.role);

        if (!role || !permissions.some(permission => role.hasPermission(permission))) {
            return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }

        next();
    };
};

const admin = authorizeRoles('admin');

module.exports = {
    protect,
    authorizeRoles,
    authorizePermissions,
    authorizeAnyPermission,
    admin
};
