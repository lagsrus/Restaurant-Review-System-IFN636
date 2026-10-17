require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const Review = require('./models/Review');

const { updateRestaurantRating } = require('./services/ratingService');

// FR-02: additive seed data for the discovery module (home, search, filter, sort).
// This script only inserts. It never deletes, so it is safe to run on the shared
// database. It checks for existing records first, so it can be run more than once
// without creating duplicates and without touching data that is already there.
// Usage: node backend/seedDiscovery.js

// Extra customer reviewers. The unique index on review (restaurantId, userId)
// means each person can review a restaurant once, so we need several of them.
const reviewerData = [
    { name: 'Mia Nguyen', email: 'mia@test.com' },
    { name: 'Liam Smith', email: 'liam@test.com' },
    { name: 'Noah Patel', email: 'noah@test.com' },
    { name: 'Ava Chen', email: 'ava@test.com' },
    { name: 'Ethan Brown', email: 'ethan@test.com' },
    { name: 'Olivia Garcia', email: 'olivia@test.com' }
];

// Restaurant definitions. Varied cuisine, suburb and price level.
// ratings is a list of review scores so each restaurant gets a realistic summary.
const restaurantData = [
    { name: 'Sala Thai', cuisine: 'Thai', priceLevel: 2, suburb: 'West End', address: '12 Boundary Street', description: 'Street style Thai food in West End.', ratings: [{ food: 5, service: 4, ambience: 4, value: 5 }, { food: 4, service: 4, ambience: 3, value: 4 }, { food: 5, service: 5, ambience: 4, value: 4 }] },
    { name: 'Sakura Sushi', cuisine: 'Japanese', priceLevel: 3, suburb: 'Fortitude Valley', address: '88 Ann Street', description: 'Fresh sushi and sashimi in the Valley.', ratings: [{ food: 5, service: 5, ambience: 5, value: 4 }, { food: 5, service: 4, ambience: 5, value: 5 }, { food: 4, service: 5, ambience: 4, value: 4 }, { food: 5, service: 5, ambience: 5, value: 5 }] },
    { name: 'Spice Route', cuisine: 'Indian', priceLevel: 2, suburb: 'South Bank', address: '5 Grey Street', description: 'North Indian curries by the river.', ratings: [{ food: 4, service: 3, ambience: 4, value: 4 }, { food: 3, service: 4, ambience: 3, value: 3 }] },
    { name: 'El Mariachi', cuisine: 'Mexican', priceLevel: 1, suburb: 'Fortitude Valley', address: '200 Brunswick Street', description: 'Tacos, burritos and margaritas.', ratings: [{ food: 4, service: 4, ambience: 5, value: 5 }, { food: 5, service: 4, ambience: 4, value: 4 }, { food: 4, service: 3, ambience: 4, value: 5 }] },
    { name: 'Golden Dragon', cuisine: 'Chinese', priceLevel: 2, suburb: 'Sunnybank', address: '15 Mains Road', description: 'Classic yum cha and Cantonese dishes.', ratings: [{ food: 3, service: 3, ambience: 3, value: 4 }, { food: 4, service: 3, ambience: 3, value: 3 }] },
    { name: 'Pho Saigon', cuisine: 'Vietnamese', priceLevel: 1, suburb: 'Inala', address: '9 Corsair Avenue', description: 'Hot bowls of pho and fresh rolls.', ratings: [{ food: 5, service: 4, ambience: 4, value: 5 }, { food: 4, service: 5, ambience: 4, value: 5 }, { food: 5, service: 4, ambience: 5, value: 4 }] },
    { name: 'Seoul Kitchen', cuisine: 'Korean', priceLevel: 2, suburb: 'Sunnybank', address: '22 Mains Road', description: 'Korean barbecue and bibimbap.', ratings: [{ food: 4, service: 4, ambience: 4, value: 4 }, { food: 3, service: 4, ambience: 4, value: 3 }, { food: 4, service: 3, ambience: 3, value: 4 }] },
    { name: 'The Coffee Lab', cuisine: 'Cafe', priceLevel: 1, suburb: 'New Farm', address: '33 Brunswick Street', description: 'Specialty coffee and all day brunch.', ratings: [{ food: 5, service: 5, ambience: 4, value: 4 }, { food: 4, service: 4, ambience: 5, value: 5 }] },
    { name: 'Big Smoke Burgers', cuisine: 'Burgers', priceLevel: 2, suburb: 'Newstead', address: '1 Doggett Street', description: 'Smash burgers and loaded fries.', ratings: [{ food: 4, service: 3, ambience: 3, value: 4 }, { food: 3, service: 3, ambience: 4, value: 3 }, { food: 4, service: 4, ambience: 3, value: 3 }] },
    { name: 'Casa Iberica', cuisine: 'Spanish', priceLevel: 3, suburb: 'Paddington', address: '7 Latrobe Terrace', description: 'Tapas and paella to share.', ratings: [{ food: 5, service: 5, ambience: 5, value: 5 }, { food: 4, service: 5, ambience: 5, value: 4 }, { food: 5, service: 4, ambience: 5, value: 5 }] },
    { name: 'Cedar Lebanese', cuisine: 'Lebanese', priceLevel: 2, suburb: 'Woolloongabba', address: '44 Logan Road', description: 'Mezze, wraps and charcoal grills.', ratings: [{ food: 4, service: 4, ambience: 4, value: 3 }, { food: 3, service: 4, ambience: 4, value: 4 }] }
];

// Find an existing reviewer by email, or create one if it is not there yet.
const findOrCreateReviewer = async (data) => {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
        return existing;
    }
    return User.create({
        name: data.name,
        email: data.email,
        password: 'Password123!',
        role: 'customer'
    });
};

const seedDiscovery = async () => {
    try {
        await connectDB();

        // Make sure the reviewer users exist.
        const reviewers = [];
        for (const data of reviewerData) {
            reviewers.push(await findOrCreateReviewer(data));
        }

        let added = 0;
        let skipped = 0;

        for (let i = 0; i < restaurantData.length; i++) {
            const def = restaurantData[i];

            // Skip a restaurant that is already in the database.
            const existing = await Restaurant.findOne({ name: def.name });
            if (existing) {
                skipped++;
                continue;
            }

            const newRestaurant = await Restaurant.create({
                name: def.name,
                cuisine: def.cuisine,
                priceLevel: def.priceLevel,
                description: def.description,
                phone: '07 3000 00' + String(10 + i),
                openingHours: 'Mon-Sun 11:00-22:00',
                location: {
                    address: def.address,
                    suburb: def.suburb,
                    latitude: -27.47,
                    longitude: 153.02,
                    mapsUrl: 'https://maps.google.com/'
                },
                imageUrls: ['https://picsum.photos/seed/' + encodeURIComponent(def.name) + '/600/400'],
                menuUrl: 'https://example.com/menu',
                websiteUrl: 'https://example.com'
            });

            // A few reviews from different customers, then recalculate the summary.
            for (let r = 0; r < def.ratings.length; r++) {
                const reviewer = reviewers[r % reviewers.length];
                await Review.create({
                    restaurantId: newRestaurant._id,
                    userId: reviewer._id,
                    ratings: def.ratings[r],
                    score: Review.calculateScore(def.ratings[r]),
                    comment: 'Seed review for ' + def.name + '.',
                    status: 'published'
                });
            }

            await updateRestaurantRating(newRestaurant._id);
            added++;
        }

        console.log('Discovery seed complete. Added ' + added + ', skipped ' + skipped + ' already present.');

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('Discovery seed error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

seedDiscovery();
