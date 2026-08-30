
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    cuisine: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    visitedAt: { type: Date, default: null },
});

module.exports = mongoose.model('Task', taskSchema);
