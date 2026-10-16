const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getPendingClaims } = require('../controllers/adminClaimController');

const router = express.Router();

router.get('/', protect, admin, getPendingClaims);

module.exports = router;
