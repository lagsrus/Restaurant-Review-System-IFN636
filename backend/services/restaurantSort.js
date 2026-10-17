// FR-05: sort strategies for the restaurant list.
//
// This is the Strategy design pattern. Each concrete strategy decides its own
// MongoDB sort through the same getSortSpec method. Calling that one shared
// method on different strategy objects and getting different sort behaviour is
// the polymorphism. The sort rule is chosen at runtime from the user's choice,
// which is exactly when Strategy is a good fit.

// Base strategy. It sets the shared method that every strategy must provide.
class SortStrategy {
    getSortSpec() {
        throw new Error('getSortSpec must be implemented by a sort strategy');
    }
}

// Top rated first. Ties are broken by most reviewed, then by name.
class RatingSort extends SortStrategy {
    getSortSpec() {
        return { 'ratingSummary.avgRating': -1, 'ratingSummary.reviewCount': -1, name: 1 };
    }
}

// Most reviewed first, then by name.
class ReviewCountSort extends SortStrategy {
    getSortSpec() {
        return { 'ratingSummary.reviewCount': -1, name: 1 };
    }
}

// Name A to Z.
class NameSort extends SortStrategy {
    getSortSpec() {
        return { name: 1 };
    }
}

// The sort values the user can ask for, each mapped to its strategy.
const strategies = {
    rating: new RatingSort(),
    reviews: new ReviewCountSort(),
    name: new NameSort()
};

class SortError extends Error {}

// Pick the strategy for the sort value. The default is top rated.
// An unknown value throws, which the controller turns into a 400.
const selectSortStrategy = (sortValue) => {
    if (sortValue === undefined || sortValue === null || String(sortValue).trim() === '') {
        return strategies.rating;
    }

    const key = String(sortValue).trim().toLowerCase();
    if (!strategies[key]) {
        throw new SortError('Sort must be one of rating, reviews or name.');
    }
    return strategies[key];
};

module.exports = {
    SortStrategy,
    RatingSort,
    ReviewCountSort,
    NameSort,
    selectSortStrategy,
    SortError
};
