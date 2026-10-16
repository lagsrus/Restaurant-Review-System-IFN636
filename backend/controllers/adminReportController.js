const Report = require('../models/Report');
const { moderateReport, ModerationError } = require('../services/reviewModeration');

const getOpenReports = async (req, res) => {
    try {
        const reports = await Report.find({ status: 'open' })
            .select('reviewId reporterId reason note status decision createdAt')
            .populate('reporterId', 'name')
            .populate({
                path: 'reviewId',
                select: 'restaurantId userId ratings score comment status ownerReply createdAt',
                populate: [
                    { path: 'restaurantId', select: 'name' },
                    { path: 'userId', select: 'name' }
                ]
            })
            .sort({ createdAt: 1, _id: 1 })
            .lean();
        return res.status(200).json(reports);
    } catch (error) {
        console.error('Get open reports failed:', error);
        return res.status(500).json({ message: 'Could not load reports.' });
    }
};

const getReportHistory = async (req, res) => {
    try {
        const reports = await Report.find({ status: { $in: ['dismissed', 'actioned'] } })
            .select('reviewId reporterId reason note status decision resolvedBy resolvedAt createdAt')
            .populate('reporterId', 'name')
            .populate('resolvedBy', 'name')
            .populate({ path: 'reviewId', select: 'restaurantId comment',
                populate: { path: 'restaurantId', select: 'name' } })
            .sort({ resolvedAt: -1, _id: -1 })
            .lean();
        return res.status(200).json(reports);
    } catch (error) {
        console.error('Get report history failed:', error);
        return res.status(500).json({ message: 'Could not load report history.' });
    }
};

const processReport = async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.reportId)) {
        return res.status(400).json({ message: 'Invalid report ID.' });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, 'action') ||
        !['dismiss', 'hide', 'delete'].includes(body.action)) {
        return res.status(400).json({ message: 'Provide only action: dismiss, hide or delete.' });
    }
    try {
        const report = await moderateReport(req.params.reportId, body.action, req.user._id);
        const messages = {
            dismiss: 'Report dismissed. The review was not changed.',
            hide: 'Review hidden, ratings updated and report closed.',
            delete: 'Review deleted, ratings updated and report closed.'
        };
        return res.status(200).json({ message: messages[body.action], report });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status).json({ message: error.message });
        }
        console.error('Process report failed:', error);
        return res.status(500).json({ message: 'Could not process the report. Refresh and try again.' });
    }
};

module.exports = { getOpenReports, getReportHistory, processReport };
