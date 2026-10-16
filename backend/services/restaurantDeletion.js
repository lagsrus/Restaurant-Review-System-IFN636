const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const Review = require('../models/Review');
const OwnerClaim = require('../models/OwnerClaim');
const Report = require('../models/Report');

// RRP-29 / FR-15: Delete the restaurant and its dependent records together.
async function deleteRestaurantWithRelatedData(restaurantId) {
    let restaurant;
    await mongoose.connection.transaction(async session => {
        restaurant = await Restaurant.findOneAndDelete({ _id: restaurantId }, { session });
        if (!restaurant) return null;
        const reviews = await Review.find({ restaurantId }).select('_id').session(session).lean();
        await Report.deleteMany({ reviewId: { $in: reviews.map(review => review._id) } }, { session });
        await Review.deleteMany({ restaurantId }, { session });
        await OwnerClaim.deleteMany({ restaurantId }, { session });
    }, { readPreference: 'primary' });
    // Mongoose 6 resolves a transaction to the commit result, not the callback's value.
    return restaurant;
}

module.exports = { deleteRestaurantWithRelatedData };
