const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');

const getRatingBreakdown = async (req, res) => {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
    }

    try {
        const restaurant = await Restaurant.findById(restaurantId);

        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        const summary = restaurant.ratingSummary;
        const fields = ['food', 'service', 'ambience', 'value'];

        let strongest = null;
        let weakest = null;

        if (summary.reviewCount > 0) {
            const scores = fields.map(field => summary.dimensions[field]);
            const highest = Math.max(...scores);
            const lowest = Math.min(...scores);

            if (highest !== lowest) {
                strongest = fields.filter(
                    field => summary.dimensions[field] === highest
                ).join(', ');

                weakest = fields.filter(
                    field => summary.dimensions[field] === lowest
                ).join(', ');
            }
        }

        return res.status(200).json({
            restaurantId: restaurant._id,
            restaurantName: restaurant.name,
            avgRating: summary.avgRating,
            reviewCount: summary.reviewCount,
            dimensions: summary.dimensions,
            distribution: summary.distribution,
            strongest,
            weakest
        });
    } catch (error) {
        console.error('Get rating breakdown failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getRatingBreakdown };