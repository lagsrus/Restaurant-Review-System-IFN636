const express = require('express');
const { createReview } = require('../controllers/reviewController');
const { protect, authorizePermissions } = require('../middleware/authMiddleware');
const { getRatingBreakdown } = require('../controllers/ratingController');
const { getRestaurantDetails } = require('../controllers/restaurantDetailsController');
const { Permissions } = require('../roleFactory');

const router = express.Router();

router.post(
    '/:restaurantId/reviews',
    protect,
    authorizePermissions(Permissions.CREATE_REVIEW),
    createReview
);
router.get('/:restaurantId/ratings', getRatingBreakdown);
router.get('/:restaurantId/details', getRestaurantDetails);

module.exports = router;