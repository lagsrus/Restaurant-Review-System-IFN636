const OwnerClaim = require('../models/OwnerClaim');

// RRP-28 / FR-14: List claims awaiting an administrator's decision.
const getPendingClaims = async (req, res) => {
    try {
        const claims = await OwnerClaim.find({ status: 'pending' })
            .select('restaurantId userId message status createdAt')
            .populate('restaurantId', 'name')
            .populate('userId', 'name email')
            .sort({ createdAt: 1, _id: 1 })
            .lean();

        return res.status(200).json(claims);
    } catch (error) {
        console.error('Get pending claims failed:', error);
        return res.status(500).json({ message: 'Could not load ownership claims.' });
    }
};

module.exports = { getPendingClaims };
