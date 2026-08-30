
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    cuisine: { type: String, default: '' },
    visitedAt: { type: Date, default: null },
    location: {type: String, default: ''},
    waitTime: {
        type: String,
        enum: ['Short', 'Medium', 'Long'],
        default: 'Short',
    },
    cost: {
        type: String,
        enum: ['$', '$$', '$$$'],
        default: '$',
    },
    rating: {
        type: Number,
        min: 1,
        max: 5, 
        default: 5,
    }
});

module.exports = mongoose.model('Task', taskSchema);
