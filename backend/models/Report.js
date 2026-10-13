const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {type: String,enum: ['spam', 'offensive', 'fake', 'other'],required: true},
    note: { type: String, default: '' },
    status: { type: String, enum: ['open', 'dismissed', 'actioned'], default: 'open' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null }
}, {
    timestamps: true
});

reportSchema.index({ reviewId: 1, reporterId: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);