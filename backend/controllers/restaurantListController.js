const Restaurant = require('../models/Restaurant');
const { buildRestaurantFilter, RestaurantQueryError } = require('../services/restaurantQuery');

// FR-03: the plain list of restaurants for the home page.
// FR-04: the list also supports search and filter query values.
// Guests can browse, so this endpoint does not need a login.
// It returns a page of restaurants in a simple envelope:
// { data, page, limit, total, totalPages }.

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const getRestaurants = async (req, res) => {
    // FR-04: build the search and filter. Bad input is a 400, not a 500.
    let filter;
    try {
        filter = buildRestaurantFilter(req.query);
    } catch (error) {
        if (error instanceof RestaurantQueryError) {
            return res.status(400).json({ message: error.message });
        }
        console.error('getRestaurants filter failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }

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

// FR-04: the distinct cuisines and suburbs, used to fill the filter dropdowns.
const getRestaurantMeta = async (req, res) => {
    try {
        const cuisines = await Restaurant.distinct('cuisine');
        const suburbs = await Restaurant.distinct('location.suburb');

        // Drop empty values and sort them so the dropdowns read nicely.
        const clean = list => list
            .filter(value => value && String(value).trim() !== '')
            .sort();

        return res.status(200).json({
            cuisines: clean(cuisines),
            suburbs: clean(suburbs)
        });
    } catch (error) {
        console.error('getRestaurantMeta failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getRestaurants, getRestaurantMeta };
