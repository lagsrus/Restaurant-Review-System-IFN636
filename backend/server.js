const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const cors = require('cors');
const connectDB = require('./config/db');


const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/restaurants', require('./routes/reviewRoutes'));
app.use('/api/reviews', require('./routes/reviewManagementRoutes'));
app.use('/api/admin/restaurants', require('./routes/adminRestaurantRoutes'));
app.use('/api/admin/claims', require('./routes/adminClaimRoutes'));
// NFR-02: JSON parsing fails before the controller's input validation runs.
app.use(['/api/admin/restaurants', '/api/admin/claims'], (error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Request body must be valid JSON.' });
    }
    next(error);
});

// Export the app object for testing
if (require.main === module) {
    connectDB();
    // If the file is run directly, start the server
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  }


module.exports = app
