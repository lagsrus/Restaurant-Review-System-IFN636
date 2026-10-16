const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getPendingClaims, decideClaim } = require('../controllers/adminClaimController');

const router = express.Router();

router.get('/', protect, admin, getPendingClaims);
router.patch('/:claimId', protect, admin, decideClaim);

module.exports = router;
