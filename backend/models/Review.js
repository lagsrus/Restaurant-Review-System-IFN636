const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    ratings: {
        food: { type: Number, min: 1, max: 5, required: true },
        service: { type: Number, min: 1, max: 5, required: true },
        ambience: { type: Number, min: 1, max: 5, required: true },
        value: { type: Number, min: 1, max: 5, required: true }
    },

    score: { type: Number, min: 1, max: 5 },
    comment: { type: String, required: true },
    edited: { type: Boolean, default: false },
    status: { type: String, enum: ['published', 'hidden'], default: 'published' },

    ownerReply: {
        text: { type: String, default: '' },
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        repliedAt: { type: Date, default: null }
    }
}, {
    timestamps: true
});

reviewSchema.index({ restaurantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);