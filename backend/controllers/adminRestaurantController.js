const Restaurant = require('../models/Restaurant');
const { validateRestaurantInput, RestaurantInputError } = require('../services/restaurantInput');
const { deleteRestaurantWithRelatedData } = require('../services/restaurantDeletion');

function handleError(res, error) {
    if (error instanceof RestaurantInputError) return res.status(400).json({ message: error.message });
    console.error('Admin restaurant operation failed:', error);
    return res.status(500).json({ message: 'Could not complete the restaurant operation.' });
}

const getRestaurants = async (req, res) => {
    try {
        const restaurants = await Restaurant.find({}).sort({ name: 1, _id: 1 }).lean();
        return res.status(200).json(restaurants);
    } catch (error) { return handleError(res, error); }
};

const createRestaurant = async (req, res) => {
    try {
        const data = validateRestaurantInput(req.body, true);
        const restaurant = await Restaurant.create(data);
        return res.status(201).json(restaurant);
    } catch (error) { return handleError(res, error); }
};

const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const updateRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    if (!validId(restaurantId)) return res.status(400).json({ message: 'Invalid restaurant ID.' });
    try {
        const data = validateRestaurantInput(req.body);
        // Dotted updates preserve location fields not included in a partial edit.
        const changes = { ...data };
        if (data.location) {
            delete changes.location;
            for (const [key, value] of Object.entries(data.location)) changes[`location.${key}`] = value;
        }
        const restaurant = await Restaurant.findByIdAndUpdate(restaurantId, { $set: changes }, {
            new: true, runValidators: true
        });
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });
        return res.status(200).json(restaurant);
    } catch (error) { return handleError(res, error); }
};

const deleteRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    if (!validId(restaurantId)) return res.status(400).json({ message: 'Invalid restaurant ID.' });
    try {
        const restaurant = await deleteRestaurantWithRelatedData(restaurantId);
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });
        return res.status(200).json({ message: 'Restaurant and related records deleted.' });
    } catch (error) { return handleError(res, error); }
};

module.exports = { getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant };
