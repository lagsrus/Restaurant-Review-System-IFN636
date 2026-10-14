const express = require('express');
const { createReview } = require('../controllers/reviewController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getRatingBreakdown } = require('../controllers/ratingController');

const router = express.Router();

router.post('/:restaurantId/reviews',protect,authorizeRoles('customer'),createReview);
router.get('/:restaurantId/ratings', getRatingBreakdown);

module.exports = router;