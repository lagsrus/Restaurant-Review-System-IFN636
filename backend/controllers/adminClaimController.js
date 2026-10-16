const mongoose = require('mongoose');
const OwnerClaim = require('../models/OwnerClaim');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

class ClaimDecisionError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

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

// RRP-28 / FR-14 / NFR-02: Only pending claims can receive a decision.
const decideClaim = async (req, res) => {
    const { claimId } = req.params;
    const decision = req.body?.decision;

    if (!/^[a-fA-F0-9]{24}$/.test(claimId)) {
        return res.status(400).json({ message: 'Invalid claim ID.' });
    }
    if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ message: 'Decision must be approved or rejected.' });
    }

    try {
        let result;
        // Throwing inside this callback aborts all writes in the transaction.
        await mongoose.connection.transaction(async (session) => {
            const claim = await OwnerClaim.findById(claimId).session(session);
            if (!claim) throw new ClaimDecisionError(404, 'Ownership claim not found.');
            if (claim.status !== 'pending') {
                throw new ClaimDecisionError(409, 'This claim has already been decided.');
            }

            if (decision === 'approved') {
                const applicant = await User.findOne({ _id: claim.userId, role: 'owner' }).session(session);
                if (!applicant) {
                    throw new ClaimDecisionError(409, 'The applicant is no longer an owner account.');
                }
                const restaurant = await Restaurant.findById(claim.restaurantId).session(session);
                if (!restaurant) throw new ClaimDecisionError(404, 'Restaurant not found.');

                // A claim is not a transfer of ownership from another owner.
                if (restaurant.ownerId && !restaurant.ownerId.equals(claim.userId)) {
                    throw new ClaimDecisionError(409, 'This restaurant already has another owner.');
                }
                restaurant.ownerId = claim.userId;
                await restaurant.save({ session });
            }

            claim.status = decision;
            claim.decidedBy = req.user._id;
            claim.decidedAt = new Date();
            await claim.save({ session });
            result = {
                _id: claim._id,
                status: claim.status,
                decidedBy: claim.decidedBy,
                decidedAt: claim.decidedAt
            };
        }, { readPreference: 'primary' });

        // Respond only after the transaction has committed successfully.
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof ClaimDecisionError) {
            return res.status(error.status).json({ message: error.message });
        }
        console.error('Decide ownership claim failed:', error);
        return res.status(500).json({ message: 'Could not save the claim decision.' });
    }
};

module.exports = { getPendingClaims, decideClaim };
