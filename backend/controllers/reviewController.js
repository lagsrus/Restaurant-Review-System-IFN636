
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const { notifyReviewChanged } = require('../services/reviewObserver');

// RRP-18 / FR-07: Create a four-dimension review
const createReview = async (req, res) => {
    const { restaurantId } = req.params;
    const { ratings, comment } = req.body || {};

    // Check restaurant ID
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
    }

    // Check all four ratings
    const fields = ['food', 'service', 'ambience', 'value'];

    if (!ratings || fields.some(field =>
        !Number.isInteger(ratings[field]) ||
        ratings[field] < 1 ||
        ratings[field] > 5
    )) {
        return res.status(400).json({
            message: 'All four ratings must be whole numbers from 1 to 5'
        });
    }

    // Check comment
    if (typeof comment !== 'string' || !comment.trim()) {
        return res.status(400).json({ message: 'Comment is required' });
    }

    try {
        // Confirm restaurant exists
        const restaurant = await Restaurant.findById(restaurantId);

        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        // Prevent duplicate reviews
        const existing = await Review.findOne({
            restaurantId,
            userId: req.user._id
        });

        if (existing) {
            return res.status(409).json({
                message: 'You have already reviewed this restaurant'
            });
        }

        // Calculate review score
        const score = Review.calculateScore(ratings);

        // Save review
        const review = await Review.create({
            restaurantId,
            userId: req.user._id,
            ratings,
            score,
            comment: comment.trim()
        });

        try {
           await notifyReviewChanged(restaurantId);
        } catch (error) {
            try {
                await Review.deleteOne({ _id: review._id });
            } catch (rollbackError) {
                console.error('Review rollback failed:', rollbackError);
            }

        throw error;
        }

        return res.status(201).json(review);


    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'You have already reviewed this restaurant'
            });
        }

        console.error('Create review failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
    const getMyReviews = async (req, res) => {
    try {
        const reviews = await Review.find({
            userId: req.user._id
        }).sort({ createdAt: -1 });

        return res.status(200).json(reviews);
    } catch (error) {
        console.error('Get my reviews failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const editReview = async (req, res) => {
    const { reviewId } = req.params;
    const { ratings, comment } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        return res.status(400).json({ message: 'Invalid review ID' });
    }

    const fields = ['food', 'service', 'ambience', 'value'];

    if (!ratings || fields.some(field =>
        !Number.isInteger(ratings[field]) ||
        ratings[field] < 1 ||
        ratings[field] > 5
    )) {
        return res.status(400).json({
            message: 'All four ratings must be whole numbers from 1 to 5'
        });
    }

    if (typeof comment !== 'string' || !comment.trim()) {
        return res.status(400).json({ message: 'Comment is required' });
    }

    try {
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const original = {
            ratings: Object.fromEntries(
                fields.map(field => [field, review.ratings[field]])
            ),
            score: review.score,
            comment: review.comment,
            edited: review.edited
        };

        review.ratings = Object.fromEntries(
            fields.map(field => [field, ratings[field]])
        );
        review.score = Review.calculateScore(ratings);
        review.comment = comment.trim();
        review.edited = true;

        await review.save();

        try {
            await notifyReviewChanged(review.restaurantId);
        } catch (error) {
            try {
                review.ratings = original.ratings;
                review.score = original.score;
                review.comment = original.comment;
                review.edited = original.edited;
                await review.save();
            } catch (rollbackError) {
                console.error('Review edit rollback failed:', rollbackError);
            }
            throw error;
        }

        return res.status(200).json(review);
    } catch (error) {
        console.error('Edit review failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const deleteReview = async (req, res) => {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        return res.status(400).json({ message: 'Invalid review ID' });
    }

    try {
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const backup = review.toObject();

        const result = await Review.deleteOne({
            _id: reviewId,
            userId: req.user._id
        });

        if (result.deletedCount !== 1) {
            return res.status(404).json({ message: 'Review not found' });
        }

        try {
            await notifyReviewChanged(review.restaurantId);
        } catch (error) {
            try {
                await Review.create(backup);
            } catch (rollbackError) {
                console.error('Review delete rollback failed:', rollbackError);
            }

            throw error;
        }

        return res.status(200).json({
            message: 'Review deleted successfully'
        });
    } catch (error) {
        console.error('Delete review failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createReview, getMyReviews, editReview, deleteReview };
