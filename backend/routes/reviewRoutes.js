const express = require('express');
const { createReview } = require('../controllers/reviewController');
const {
    protect,
    authorizePermissions,
    authorizeRoles
} = require('../middleware/authMiddleware');
const { getRatingBreakdown } = require('../controllers/ratingController');
const { getRestaurantDetails } = require('../controllers/restaurantDetailsController');
const { submitClaim } = require('../controllers/ownerClaimController');
const { updateOwnedRestaurant } = require('../controllers/ownerRestaurantController');
const { Permissions } = require('../roleFactory');

const router = express.Router();

router.post(
    '/:restaurantId/reviews',
    protect,
    authorizePermissions(Permissions.CREATE_REVIEW),
    createReview
);
router.post('/:restaurantId/claims', protect, authorizeRoles('owner'), submitClaim);
router.patch('/:restaurantId', protect, authorizeRoles('owner'), updateOwnedRestaurant);
router.get('/:restaurantId/ratings', getRatingBreakdown);
router.get('/:restaurantId/details', getRestaurantDetails);

module.exports = router;