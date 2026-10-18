const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    cuisine: { type: String, default: '' },
    priceLevel: { type: Number, min: 1, max: 3, default: 1 },
    description: { type: String, default: '' },
    phone: { type: String, default: '' },
    openingHours: { type: String, default: '' },

    location: {
        address: { type: String, default: '' },
        suburb: { type: String, default: '' },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        mapsUrl: { type: String, default: '' }
    },

    imageUrls: [{ type: String }],
    menuUrl: { type: String, default: '' },
    websiteUrl: { type: String, default: '' },

    ratingSummary: {
        avgRating: { type: Number, default: 0 },
        reviewCount: { type: Number, default: 0 },

        dimensions: {
            food: { type: Number, default: 0 },
            service: { type: Number, default: 0 },
            ambience: { type: Number, default: 0 },
            value: { type: Number, default: 0 }
        },

    distribution: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 }
    }
},
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// FR-05 / NFR-03: indexes for the fields the discovery list sorts and filters on,
// so the list stays fast under load.
restaurantSchema.index({ 'ratingSummary.avgRating': -1 });
restaurantSchema.index({ name: 1 });
restaurantSchema.index({ cuisine: 1 });
restaurantSchema.index({ 'location.suburb': 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);