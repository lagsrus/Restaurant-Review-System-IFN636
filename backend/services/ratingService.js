const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');

const round1 = value => Math.round(value * 10) / 10;

// NFR-05: Recalculate ratings using published reviews only
const updateRestaurantRating = async (restaurantId) => {
    const reviews = await Review.find({
        restaurantId,
        status: 'published'
    });

    const fields = ['food', 'service', 'ambience', 'value'];

    const summary = {
        avgRating: 0,
        reviewCount: reviews.length,
        dimensions: {
            food: 0,
            service: 0,
            ambience: 0,
            value: 0
        },
        distribution: {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        }
    };

    for (const review of reviews) {
        for (const field of fields) {
            summary.dimensions[field] += review.ratings[field];
        }

        // Calculate the review score from its four ratings
        const score = Review.calculateScore(review.ratings);
        summary.avgRating += score;
        summary.distribution[Math.round(score)]++;
    }

    if (reviews.length > 0) {
        summary.avgRating = round1(summary.avgRating / reviews.length);

        for (const field of fields) {
            summary.dimensions[field] = round1(
                summary.dimensions[field] / reviews.length
            );
        }
    }

    await Restaurant.findByIdAndUpdate(restaurantId, {
        $set: { ratingSummary: summary }
    });

    return summary;
};

module.exports = { updateRestaurantRating };
