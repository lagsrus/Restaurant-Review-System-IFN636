
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

module.exports = { createReview };
