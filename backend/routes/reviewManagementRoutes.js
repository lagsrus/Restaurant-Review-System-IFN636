const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getMyReviews, editReview, deleteReview } = require('../controllers/reviewController');
const router = express.Router();

router.get('/mine', protect, authorizeRoles('customer'), getMyReviews);
router.put('/:reviewId', protect, authorizeRoles('customer'), editReview);
router.delete('/:reviewId', protect, authorizeRoles('customer'), deleteReview);

module.exports = router;