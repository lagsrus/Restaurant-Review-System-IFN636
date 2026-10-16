
const express = require('express');
const { getTasks, getAllReviews, addTask, updateTask, deleteTask } = require('../controllers/taskController');
const {
    protect,
    authorizePermissions,
    authorizeAnyPermission
} = require('../middleware/authMiddleware');
const { Permissions } = require('../roleFactory');
const router = express.Router();

router.route('/').get(protect, getTasks).post(
    protect,
    authorizePermissions(Permissions.CREATE_REVIEW),
    addTask
);
router.get('/all', getAllReviews);
router.route('/:id').put(
    protect,
    authorizePermissions(Permissions.MANAGE_OWN_REVIEWS),
    updateTask
).delete(
    protect,
    authorizeAnyPermission(
        Permissions.MANAGE_OWN_REVIEWS,
        Permissions.DELETE_ANY_REVIEW
    ),
    deleteTask
);

module.exports = router;
    