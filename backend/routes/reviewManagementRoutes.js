const express = require('express');
const {
    protect,
    authorizePermissions,
    authorizeRoles
} = require('../middleware/authMiddleware');
const { getMyReviews, editReview, deleteReview } = require('../controllers/reviewController');
const router = express.Router();
const { createReport } = require('../controllers/reportController');
const { Permissions } = require('../roleFactory');
const { createOwnerReply } = require('../controllers/ownerReplyController');

router.get('/mine', protect, authorizePermissions(Permissions.MANAGE_OWN_REVIEWS), getMyReviews);
router.put('/:reviewId', protect, authorizePermissions(Permissions.MANAGE_OWN_REVIEWS), editReview);
router.delete('/:reviewId', protect, authorizePermissions(Permissions.MANAGE_OWN_REVIEWS), deleteReview);
router.post('/:reviewId/reports', protect, authorizePermissions(Permissions.REPORT_REVIEW), createReport);
router.post('/:reviewId/reply', protect, authorizeRoles('owner'), createOwnerReply);

module.exports = router;