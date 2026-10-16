const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const Review = require('../models/Review');

const getRestaurantDetails = async (req, res) => {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
    }

    try {
        const restaurant = await Restaurant.findById(restaurantId);

        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        const reviews = await Review.find({
            restaurantId,
            status: 'published'
        })
        .select('ratings score comment edited ownerReply createdAt')
        .sort({ createdAt: -1 });

        return res.status(200).json({
            restaurant,
            reviews
        });

    } catch (error) {
        console.error('Get restaurant details failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getRestaurantDetails };