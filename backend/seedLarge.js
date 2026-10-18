require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const Restaurant = require('./models/Restaurant');
const Review = require('./models/Review');
const OwnerClaim = require('./models/OwnerClaim');

// FR-02: large optional dataset for load testing (NFR-03).
// Adds many generated restaurants for load testing. It only removes its own
// previously generated restaurants (the ones named "Load Test Restaurant"),
// and only when they have no reviews or owner claims, so real data and any
// linked records are never touched.
// Usage: node backend/seedLarge.js [count]   default is 300.

const cuisines = ['Italian', 'Thai', 'Japanese', 'Indian', 'Mexican', 'Chinese', 'Vietnamese', 'Korean', 'Cafe', 'Burgers', 'Spanish', 'Lebanese'];
const suburbs = ['Brisbane', 'South Bank', 'Fortitude Valley', 'West End', 'New Farm', 'Paddington', 'Newstead', 'Woolloongabba', 'Sunnybank', 'Milton'];

const round1 = value => Math.round(value * 10) / 10;

const seedLarge = async () => {
    try {
        // Work out the count and check it first. We validate before touching the
        // database, so a bad value such as -1 can never delete data without
        // inserting replacements.
        let count = 300;
        if (process.argv[2] !== undefined) {
            count = Number(process.argv[2]);
            if (!Number.isInteger(count) || count < 1) {
                console.error('Count must be a positive whole number.');
                process.exit(1);
            }
        }

        await connectDB();

        // Find the load test restaurants left over from a previous run.
        const previous = await Restaurant.find({ name: /^Load Test Restaurant / }).select('_id');
        const previousIds = previous.map(restaurant => restaurant._id);

        // Protect any that have reviews or owner claims. We only remove the ones
        // with no linked records, so we never orphan a review or a claim.
        const reviewedIds = await Review.distinct('restaurantId', { restaurantId: { $in: previousIds } });
        const claimedIds = await OwnerClaim.distinct('restaurantId', { restaurantId: { $in: previousIds } });
        const linked = new Set([...reviewedIds, ...claimedIds].map(String));
        const safeToDelete = previousIds.filter(id => !linked.has(String(id)));

        const removed = await Restaurant.deleteMany({ _id: { $in: safeToDelete } });
        const kept = previousIds.length - safeToDelete.length;
        console.log('Removed ' + removed.deletedCount + ' old load test restaurants, kept ' + kept + ' that have reviews or claims');

        const docs = [];

        for (let i = 0; i < count; i++) {
            const cuisine = cuisines[i % cuisines.length];
            const suburb = suburbs[i % suburbs.length];
            const priceLevel = (i % 3) + 1;

            // Spread the ratings so sort and filter have varied data to work with.
            const avgRating = round1(2.5 + (i % 25) / 10);
            const reviewCount = (i % 40) + 1;

            docs.push({
                name: 'Load Test Restaurant ' + (i + 1),
                cuisine: cuisine,
                priceLevel: priceLevel,
                description: 'Generated restaurant for load testing.',
                phone: '07 3100 0000',
                openingHours: 'Mon-Sun 11:00-22:00',
                location: {
                    address: (100 + i) + ' Test Road',
                    suburb: suburb,
                    latitude: -27.47,
                    longitude: 153.02,
                    mapsUrl: 'https://maps.google.com/'
                },
                imageUrls: ['https://picsum.photos/seed/load' + i + '/600/400'],
                ratingSummary: {
                    avgRating: avgRating,
                    reviewCount: reviewCount,
                    dimensions: {
                        food: avgRating,
                        service: avgRating,
                        ambience: avgRating,
                        value: avgRating
                    },
                    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                }
            });
        }

        await Restaurant.insertMany(docs);

        console.log('Inserted ' + docs.length + ' load test restaurants');

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('Load seed error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

seedLarge();
