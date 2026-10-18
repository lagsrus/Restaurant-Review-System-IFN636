const Restaurant = require('../models/Restaurant');

// FR-03: the plain list of restaurants for the home page.
// Guests can browse, so this endpoint does not need a login.
// It returns a page of restaurants in a simple envelope:
// { data, page, limit, total, totalPages }.

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const getRestaurants = async (req, res) => {
    try {
        // Work out the page number. Anything invalid falls back to page 1.
        let page = parseInt(req.query.page, 10);
        if (!Number.isInteger(page) || page < 1) {
            page = 1;
        }

        // Work out the limit. Keep it between 1 and the maximum.
        let limit = parseInt(req.query.limit, 10);
        if (!Number.isInteger(limit) || limit < 1) {
            limit = DEFAULT_LIMIT;
        }
        if (limit > MAX_LIMIT) {
            limit = MAX_LIMIT;
        }

        const skip = (page - 1) * limit;

        // For now the list shows all restaurants.
        // Search, filter and sort are added in the next stories.
        const filter = {};

        const total = await Restaurant.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        const restaurants = await Restaurant.find(filter)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        // Only send the fields the home page cards need.
        const data = restaurants.map(restaurant => ({
            _id: restaurant._id,
            name: restaurant.name,
            cuisine: restaurant.cuisine,
            suburb: restaurant.location ? restaurant.location.suburb : '',
            priceLevel: restaurant.priceLevel,
            avgRating: restaurant.ratingSummary ? restaurant.ratingSummary.avgRating : 0,
            reviewCount: restaurant.ratingSummary ? restaurant.ratingSummary.reviewCount : 0,
            image: (restaurant.imageUrls && restaurant.imageUrls.length > 0) ? restaurant.imageUrls[0] : ''
        }));

        return res.status(200).json({ data, page, limit, total, totalPages });
    } catch (error) {
        console.error('getRestaurants failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getRestaurants };
