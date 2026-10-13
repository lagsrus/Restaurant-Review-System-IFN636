require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('./config/db');

const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const Review = require('./models/Review');
const OwnerClaim = require('./models/OwnerClaim');
const Report = require('./models/Report');

const seedA2 = async () => {
    try {
        await connectDB();

        // Clear only the A2 collections before reseeding
        await Report.deleteMany({});
        await OwnerClaim.deleteMany({});
        await Review.deleteMany({});
        await Restaurant.deleteMany({});
        await User.deleteMany({});

        // Users
        const customer = await User.create({
            name: 'Test Customer',
            email: 'customer@test.com',
            password: 'Password123!',
            role: 'customer'
        });

        const owner = await User.create({
            name: 'Test Owner',
            email: 'owner@test.com',
            password: 'Password123!',
            role: 'owner'
        });

        const admin = await User.create({
            name: 'Test Admin',
            email: 'admin@test.com',
            password: 'Password123!',
            role: 'admin'
        });

        // Restaurant
        const restaurant = await Restaurant.create({
            name: 'Brisbane Test Kitchen',
            cuisine: 'Italian',
            priceLevel: 2,
            description: 'Seed restaurant for IFN636 A2 development.',
            phone: '07 3000 0000',
            openingHours: 'Mon-Sun 11:00-22:00',

            location: {
                address: '123 Test Street',
                suburb: 'Brisbane',
                latitude: -27.4698,
                longitude: 153.0251,
                mapsUrl: 'https://maps.google.com/'
            },

            imageUrls: [
                'https://example.com/restaurant.jpg'
            ],
            menuUrl: 'https://example.com/menu',
            websiteUrl: 'https://example.com',

            ownerId: owner._id,

            ratingSummary: {
                avgRating: 4,
                reviewCount: 1,

                dimensions: {
                    food: 4,
                    service: 5,
                    ambience: 3,
                    value: 4
                },

                distribution: {
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 1,
                    5: 0
                }
            }
        });

        // Review
        const review = await Review.create({
            restaurantId: restaurant._id,
            userId: customer._id,

            ratings: {
                food: 4,
                service: 5,
                ambience: 3,
                value: 4
            },

            score: 4,
            comment: 'Great food and service.',
            edited: false,
            status: 'published',

            ownerReply: {
                text: 'Thanks for visiting.',
                ownerId: owner._id,
                repliedAt: new Date()
            }
        });

        // Owner claim
        await OwnerClaim.create({
            restaurantId: restaurant._id,
            userId: owner._id,
            message: 'I am the owner of this restaurant.',
            status: 'approved',
            decidedBy: admin._id,
            decidedAt: new Date()
        });

        // Report
        await Report.create({
            reviewId: review._id,
            reporterId: owner._id,
            reason: 'fake',
            note: 'Seed report for moderation testing.',
            status: 'open'
        });

        console.log('A2 database seeded successfully');
        console.log('Restaurant:', restaurant.name);
        console.log('Review:', review.comment);

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('A2 seed error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

seedA2();