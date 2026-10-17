const express = require('express');
const { getRestaurants, getRestaurantMeta } = require('../controllers/restaurantListController');

const router = express.Router();

// FR-03: public list of restaurants for the home page.
// FR-04: /meta gives the filter dropdown values.
// This router is mounted at /api/restaurants before the review routes, so the
// plain list at / and /meta do not clash with the /:restaurantId review paths.
router.get('/', getRestaurants);
router.get('/meta', getRestaurantMeta);

module.exports = router;
