const express = require('express');
const { getRestaurants } = require('../controllers/restaurantListController');

const router = express.Router();

// FR-03: public list of restaurants for the home page.
// This router is mounted at /api/restaurants before the review routes,
// so the plain list at / does not clash with the /:restaurantId review paths.
router.get('/', getRestaurants);

module.exports = router;
