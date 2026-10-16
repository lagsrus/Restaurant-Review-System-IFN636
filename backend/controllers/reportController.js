const mongoose = require('mongoose');
const Review = require('../models/Review');
const Report = require('../models/Report');

const createReport = async (req, res) => {
    const { reviewId } = req.params;
    const { reason, note = '' } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        return res.status(400).json({ message: 'Invalid review ID' });
    }

    const validReasons = ['spam', 'offensive', 'fake', 'other'];

    if (!validReasons.includes(reason)) {
        return res.status(400).json({ message: 'Invalid report reason' });
    }

    if (typeof note !== 'string') {
        return res.status(400).json({ message: 'Note must be text' });
    }

    try {
        const review = await Review.findById(reviewId);

        if (!review || review.status !== 'published') {
            return res.status(404).json({ message: 'Review not found' });
        }

        const report = await Report.create({
            reviewId,
            reporterId: req.user._id,
            reason,
            note: note.trim()
        });

        return res.status(201).json({
            message: 'Review reported successfully',
            report
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'You have already reported this review'
            });
        }

        console.error('Create report failed:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createReport };