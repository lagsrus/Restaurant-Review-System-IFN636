// config/db.js
const mongoose = require('mongoose');
const dns = require('dns');

if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(','));
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;