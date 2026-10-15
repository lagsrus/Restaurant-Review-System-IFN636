const { updateRestaurantRating } = require('./ratingService');

const observers = [];

const subscribe = (observer) => {
    observers.push(observer);
};

const notifyReviewChanged = async (restaurantId) => {
    for (const observer of observers) {
        await observer(restaurantId);
    }
};

subscribe(updateRestaurantRating);

module.exports = { subscribe, notifyReviewChanged };