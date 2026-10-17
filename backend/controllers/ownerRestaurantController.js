const Restaurant = require('../models/Restaurant');
const { validateRestaurantInput, RestaurantInputError } = require('../services/restaurantInput');

const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

function handleError(res, error) {
    if (error instanceof RestaurantInputError) return res.status(400).json({ message: error.message });
    console.error('Owner restaurant update failed:', error);
    return res.status(500).json({ message: 'Could not update the restaurant.' });
}

const updateOwnedRestaurant = async (req, res) => {
    const { restaurantId } = req.params;
    if (!validId(restaurantId)) return res.status(400).json({ message: 'Invalid restaurant ID.' });

    try {
        const data = validateRestaurantInput(req.body);
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });
        if (!restaurant.ownerId || String(restaurant.ownerId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'You may only edit your own restaurant.' });
        }

        const changes = { ...data };
        if (data.location) {
            delete changes.location;
            for (const [key, value] of Object.entries(data.location)) {
                changes[`location.${key}`] = value;
            }
        }

        const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: restaurantId, ownerId: req.user._id },
            { $set: changes },
            { new: true, runValidators: true }
        );
        if (updatedRestaurant) return res.status(200).json(updatedRestaurant);

        const currentRestaurant = await Restaurant.findById(restaurantId);
        if (!currentRestaurant) return res.status(404).json({ message: 'Restaurant not found.' });
        return res.status(403).json({ message: 'You may only edit your own restaurant.' });
    } catch (error) {
        return handleError(res, error);
    }
};

module.exports = { updateOwnedRestaurant };
