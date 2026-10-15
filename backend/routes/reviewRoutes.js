const express = require('express');
const { createReview } = require('../controllers/reviewController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/:restaurantId/reviews',protect,authorizeRoles('customer'),createReview);

module.exports = router;