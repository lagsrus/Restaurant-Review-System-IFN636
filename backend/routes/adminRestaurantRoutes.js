const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant } = require('../controllers/adminRestaurantController');

const router = express.Router();
router.use(protect, admin);
router.get('/', getRestaurants);
router.post('/', createRestaurant);
router.patch('/:restaurantId', updateRestaurant);
router.delete('/:restaurantId', deleteRestaurant);

module.exports = router;
