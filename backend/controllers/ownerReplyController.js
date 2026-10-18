const mongoose = require('mongoose');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');

const MAX_REPLY_LENGTH = 2000;

const createOwnerReply = async (req, res) => {
    const { reviewId } = req.params;
    const { text } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        return res.status(400).json({ message: 'Invalid review ID.' });
    }
    if (
        !req.body ||
        typeof req.body !== 'object' ||
        Array.isArray(req.body) ||
        Object.keys(req.body).some(key => key !== 'text') ||
        typeof text !== 'string' ||
        !text.trim() ||
        text.trim().length > MAX_REPLY_LENGTH
    ) {
        return res.status(400).json({
            message: `Reply must be text of 1 to ${MAX_REPLY_LENGTH} characters.`
        });
    }

    try {
        const review = await Review.findById(reviewId);
        if (!review || review.status !== 'published') {
            return res.status(404).json({ message: 'Published review not found.' });
        }

        const restaurant = await Restaurant.findById(review.restaurantId);
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found.' });
        }
        if (!restaurant.ownerId || String(restaurant.ownerId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'You may only reply to reviews of your own restaurant.' });
        }
        if (review.ownerReply?.text) {
            return res.status(409).json({ message: 'A reply has already been posted for this review.' });
        }

        const updatedReview = await Review.findOneAndUpdate(
            {
                _id: reviewId,
                status: 'published',
                $or: [
                    { 'ownerReply.text': { $exists: false } },
                    { 'ownerReply.text': '' }
                ]
            },
            {
                $set: {
                    'ownerReply.text': text.trim(),
                    'ownerReply.ownerId': req.user._id,
                    'ownerReply.repliedAt': new Date()
                }
            },
            { new: true, runValidators: true }
        );

        if (updatedReview) {
            return res.status(201).json({
                _id: updatedReview._id,
                ownerReply: updatedReview.ownerReply
            });
        }

        const currentReview = await Review.findById(reviewId);
        if (!currentReview || currentReview.status !== 'published') {
            return res.status(404).json({ message: 'Published review not found.' });
        }
        if (currentReview.ownerReply?.text) {
            return res.status(409).json({ message: 'A reply has already been posted for this review.' });
        }
        return res.status(409).json({ message: 'The review changed before the reply could be saved. Please try again.' });
    } catch (error) {
        console.error('Create owner reply failed:', error);
        return res.status(500).json({ message: 'Could not post the owner reply.' });
    }
};

module.exports = { createOwnerReply };
