const mongoose = require('mongoose');

const ownerClaimSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null }
}, {
    timestamps: true
});

ownerClaimSchema.index({ restaurantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('OwnerClaim', ownerClaimSchema);