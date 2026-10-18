// FR-04 / NFR-02: build a safe MongoDB filter from the list query values.
// Bad input throws RestaurantQueryError, which the controller turns into a
// clear 400 response with no stack trace. This matches the style used in
// restaurantInput.js.

class RestaurantQueryError extends Error {}

const invalid = message => {
    throw new RestaurantQueryError(message);
};

// Escape a user string so it is safe to use inside a regular expression.
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Return true if the query value is present and not just empty space.
const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';

// Build the filter. The filters combine with AND, which is how MongoDB
// treats several keys in one query object.
const buildRestaurantFilter = (query = {}) => {
    const filter = {};

    // search: partial, case insensitive match on the name.
    if (hasValue(query.search)) {
        const term = String(query.search).trim();
        filter.name = { $regex: escapeRegex(term), $options: 'i' };
    }

    // cuisine: exact match, case insensitive.
    if (hasValue(query.cuisine)) {
        const cuisine = String(query.cuisine).trim();
        filter.cuisine = { $regex: '^' + escapeRegex(cuisine) + '$', $options: 'i' };
    }

    // suburb: exact match, case insensitive.
    if (hasValue(query.suburb)) {
        const suburb = String(query.suburb).trim();
        filter['location.suburb'] = { $regex: '^' + escapeRegex(suburb) + '$', $options: 'i' };
    }

    // priceLevel: a whole number from 1 to 3.
    if (hasValue(query.priceLevel)) {
        const priceLevel = Number(query.priceLevel);
        if (!Number.isInteger(priceLevel) || priceLevel < 1 || priceLevel > 3) {
            invalid('Price level must be a whole number from 1 to 3.');
        }
        filter.priceLevel = priceLevel;
    }

    // minRating: a number from 0 to 5.
    if (hasValue(query.minRating)) {
        const minRating = Number(query.minRating);
        if (Number.isNaN(minRating) || minRating < 0 || minRating > 5) {
            invalid('Minimum rating must be a number from 0 to 5.');
        }
        filter['ratingSummary.avgRating'] = { $gte: minRating };
    }

    return filter;
};

module.exports = { buildRestaurantFilter, RestaurantQueryError };
