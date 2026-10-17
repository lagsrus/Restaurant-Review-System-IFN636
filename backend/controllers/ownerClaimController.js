const OwnerClaim = require('../models/OwnerClaim');
const Restaurant = require('../models/Restaurant');

const submitClaim = async (req, res) => {
    const { restaurantId } = req.params;
    const { message = '' } = req.body || {};

    if (!/^[a-f\d]{24}$/i.test(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID.' });
    }

    if (typeof message !== 'string' || message.trim().length > 500) {
        return res.status(400).json({ message: 'Claim message must be text of 500 characters or fewer.' });
    }

    try {
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found.' });
        }

        if (restaurant.ownerId) {
            return res.status(409).json({ message: 'This restaurant already has an owner.' });
        }

        const claim = await OwnerClaim.create({
            restaurantId,
            userId: req.user._id,
            message: message.trim(),
            status: 'pending'
        });

        return res.status(201).json({
            message: 'Claim submitted for administrator review.',
            claim: {
                _id: claim._id,
                restaurantId: claim.restaurantId,
                status: claim.status
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'You have already submitted a claim for this restaurant.' });
        }

        console.error('Submit ownership claim failed:', error);
        return res.status(500).json({ message: 'Could not submit the ownership claim.' });
    }
};

module.exports = { submitClaim };
