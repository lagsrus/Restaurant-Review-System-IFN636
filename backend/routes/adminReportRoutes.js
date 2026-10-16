const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getOpenReports, getReportHistory, processReport } = require('../controllers/adminReportController');

const router = express.Router();
router.use(protect, admin);
router.get('/', getOpenReports);
router.get('/history', getReportHistory);
router.patch('/:reportId', processReport);

module.exports = router;
