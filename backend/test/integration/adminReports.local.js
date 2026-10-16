// Run: node test/integration/adminReports.local.js
// Requires mongod on PATH. Starts a fresh local database and removes only its
// own temporary files on exit. Never uses the application's configured Atlas URI.
const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const sinon = require('sinon');
const User = require('../../models/User');
const Restaurant = require('../../models/Restaurant');
const Review = require('../../models/Review');
const Report = require('../../models/Report');
const observer = require('../../services/reviewObserver');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function availablePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

async function run() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rrp30-mongo-'));
    const port = await availablePort();
    const uri = `mongodb://127.0.0.1:${port}/rrp30_isolated_test`;
    const log = fs.openSync(path.join(directory, 'mongod.log'), 'w');
    const mongod = spawn('mongod', ['--dbpath', directory, '--port', String(port),
        '--bind_ip', '127.0.0.1', '--nounixsocket'], { stdio: ['ignore', log, log] });
    let launchError;
    mongod.on('error', error => { launchError = error; });
    const stopped = new Promise(resolve => { mongod.once('exit', resolve); mongod.once('error', resolve); });
    let server;
    const originalEnv = { MONGO_URI: process.env.MONGO_URI, JWT_SECRET: process.env.JWT_SECRET };
    process.env.MONGO_URI = uri;
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    try {
        let ready = false;
        for (let attempt = 0; attempt < 20; attempt++) {
            if (launchError) throw launchError;
            if (mongod.exitCode !== null) throw new Error('Temporary mongod stopped during startup');
            try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 }); ready = true; break; }
            catch { await delay(250); }
        }
        assert.ok(ready, 'Temporary mongod did not start');
        assert.strictEqual(mongoose.connection.host, '127.0.0.1');
        assert.strictEqual(mongoose.connection.name, 'rrp30_isolated_test');
        console.log(`Isolated database: ${uri}`);
        await Promise.all([User.init(), Restaurant.init(), Review.init(), Report.init()]);
        const users = {};
        const tokens = {};
        for (const role of ['admin', 'customer', 'owner']) {
            users[role] = await User.create({ name: `Local ${role}`, role,
                email: `${role}@rrp30.example.test`, password: crypto.randomBytes(20).toString('hex') });
            tokens[role] = jwt.sign({ id: users[role].id }, process.env.JWT_SECRET, { expiresIn: '10m' });
        }
        const app = require('../../server');
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const base = `http://127.0.0.1:${server.address().port}`;
        const queuePath = '/api/admin/reports';
        const headers = role => ({ 'Content-Type': 'application/json',
            ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}) });
        async function request(method, endpoint, body, role = 'admin') {
            const res = await fetch(`${base}${endpoint}`, {
                method, headers: headers(role), ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: res.status, body: await res.json() };
        }
        const moderate = (report, action) => request('PATCH', `${queuePath}/${report._id}`, { action });
        const ratings = value => ({ food: value, service: value, ambience: value, value });
        async function fixture() {
            const restaurant = await Restaurant.create({ name: 'Isolated moderation kitchen' });
            // Use real existing creation/reporting APIs to verify module integration.
            const created = await request('POST', `/api/restaurants/${restaurant.id}/reviews`, {
                ratings: ratings(5), comment: 'Content under review'
            }, 'customer');
            assert.strictEqual(created.status, 201);
            const review = created.body;
            await Review.create({ restaurantId: restaurant._id, userId: users.owner._id,
                ratings: ratings(1), score: 1, comment: 'Unrelated review to retain' });
            await observer.notifyReviewChanged(restaurant.id);
            const reported = await request('POST', `/api/reviews/${review._id}/reports`, {
                reason: 'spam', note: 'Local integration fixture'
            }, 'owner');
            assert.strictEqual(reported.status, 201);
            return { restaurant, review, report: reported.body.report };
        }
        function audit(report, status, decision) {
            assert.strictEqual(report.status, status);
            assert.strictEqual(String(report.resolvedBy), users.admin.id);
            assert.ok(report.resolvedAt instanceof Date);
            assert.strictEqual(report.decision, decision);
        }
        async function assertExcluded(restaurant, reviewId, expectedCount = 1) {
            const details = await request('GET', `/api/restaurants/${restaurant.id}/details`, undefined, null);
            assert.strictEqual(details.status, 200);
            assert.ok(!details.body.reviews.some(review => review._id === reviewId));
            assert.strictEqual(details.body.restaurant.ratingSummary.reviewCount, expectedCount);
            const breakdown = await request('GET', `/api/restaurants/${restaurant.id}/ratings`, undefined, null);
            assert.strictEqual(breakdown.body.reviewCount, expectedCount);
            assert.strictEqual(breakdown.body.avgRating, expectedCount ? 1 : 0);
            for (const field of ['food', 'service', 'ambience', 'value']) {
                assert.strictEqual(breakdown.body.dimensions[field], expectedCount ? 1 : 0);
            }
            assert.strictEqual(breakdown.body.distribution['5'], 0);
            assert.strictEqual(breakdown.body.distribution['1'], expectedCount);
        }

        const initial = await fixture();
        const list = await request('GET', queuePath);
        const entry = list.body.find(item => item._id === initial.report._id);
        assert.strictEqual(entry.reviewId.comment, 'Content under review');
        assert.strictEqual(entry.reviewId.restaurantId.name, initial.restaurant.name);
        assert.strictEqual(entry.reviewId.userId.name, 'Local customer');
        assert.strictEqual(entry.reporterId.name, 'Local owner');
        assert.strictEqual(entry.reviewId.userId.password, undefined);
        console.log('PASS 1: Existing review/report APIs feed the admin queue with related details');

        for (const role of [null, 'customer', 'owner']) {
            const expected = role ? 403 : 401;
            assert.strictEqual((await request('GET', queuePath, undefined, role)).status, expected);
            assert.strictEqual((await request('PATCH', `${queuePath}/${initial.report._id}`, { action: 'delete' }, role)).status, expected);
        }
        assert.strictEqual((await Review.findById(initial.review._id)).status, 'published');
        console.log('PASS 2: Server denies guest, customer and owner reads and decisions');

        const beforeReview = await Review.findById(initial.review._id).lean();
        const beforeReport = await Report.findById(initial.report._id).lean();
        const beforeRestaurant = await Restaurant.findById(initial.restaurant.id).lean();
        for (const body of [{}, [], { action: 'restore' }, { action: null },
            { action: 'hide', resolvedBy: users.owner.id }, { action: 'delete', decision: 'delete' }]) {
            const res = await request('PATCH', `${queuePath}/${initial.report._id}`, body);
            assert.strictEqual(res.status, 400);
            assert.deepStrictEqual(Object.keys(res.body), ['message']);
        }
        assert.strictEqual((await request('PATCH', `${queuePath}/not-valid`, { action: 'hide' })).status, 400);
        const malformed = await fetch(`${base}${queuePath}/${initial.report._id}`, {
            method: 'PATCH', headers: headers('admin'), body: '{broken'
        });
        assert.strictEqual(malformed.status, 400);
        assert.deepStrictEqual(Object.keys(await malformed.json()), ['message']);
        assert.deepStrictEqual(await Review.findById(initial.review._id).lean(), beforeReview);
        assert.deepStrictEqual(await Report.findById(initial.report._id).lean(), beforeReport);
        assert.deepStrictEqual(await Restaurant.findById(initial.restaurant.id).lean(), beforeRestaurant);
        console.log('PASS 3: Invalid input returns safe HTTP 400 and leaves database records unchanged');

        assert.strictEqual((await moderate(initial.report, 'dismiss')).status, 200);
        assert.deepStrictEqual(await Review.findById(initial.review._id).lean(), beforeReview);
        assert.deepStrictEqual(await Restaurant.findById(initial.restaurant.id).lean(), beforeRestaurant);
        audit(await Report.findById(initial.report._id), 'dismissed', 'dismiss');
        assert.ok(!(await request('GET', queuePath)).body.some(item => item._id === initial.report._id));
        assert.strictEqual((await moderate(initial.report, 'hide')).status, 409);
        console.log('PASS 4: Dismissal persists actor/time, preserves review/ratings and leaves the open queue');

        const hidden = await fixture();
        assert.strictEqual((await moderate(hidden.report, 'hide')).status, 200);
        assert.strictEqual((await Review.findById(hidden.review._id)).status, 'hidden');
        audit(await Report.findById(hidden.report._id), 'actioned', 'hide');
        await assertExcluded(hidden.restaurant, hidden.review._id);
        assert.ok(!(await request('GET', queuePath)).body.some(item => item._id === hidden.report._id));
        console.log('PASS 5: Hide persists across fresh requests and excludes review from public details and all ratings');

        const deleted = await fixture();
        const secondReport = await Report.create({ reviewId: deleted.review._id, reporterId: users.customer._id, reason: 'other' });
        assert.strictEqual((await moderate(deleted.report, 'delete')).status, 200);
        assert.strictEqual(await Review.findById(deleted.review._id), null);
        audit(await Report.findById(deleted.report._id), 'actioned', 'delete');
        await assertExcluded(deleted.restaurant, deleted.review._id);
        assert.strictEqual((await Report.findById(secondReport.id)).status, 'open');
        console.log('PASS 6: Delete removes review, retains report audit and updates ratings without resolving other reports');

        const stale = (await request('GET', queuePath)).body.find(item => item._id === secondReport.id);
        assert.strictEqual(stale.reviewId, null);
        assert.strictEqual((await moderate(secondReport, 'hide')).status, 409);
        assert.strictEqual((await moderate(secondReport, 'dismiss')).status, 200);
        console.log('PASS 7: A report whose review is gone remains readable and can be dismissed');

        const lastReview = await Review.findOne({ restaurantId: hidden.restaurant.id, status: 'published' });
        const lastReport = await Report.create({ reviewId: lastReview.id, reporterId: users.customer.id, reason: 'spam' });
        assert.strictEqual((await moderate(lastReport, 'hide')).status, 200);
        await assertExcluded(hidden.restaurant, lastReview.id, 0);
        console.log('PASS 8: Hiding the final public review resets rating averages, count and distribution');

        const retry = await fixture();
        const ratingFailure = sinon.stub(Restaurant, 'findByIdAndUpdate').rejects(new Error('Injected private database error'));
        const errorLog = sinon.stub(console, 'error');
        let failed;
        try { failed = await moderate(retry.report, 'delete'); }
        finally { ratingFailure.restore(); errorLog.restore(); }
        assert.strictEqual(failed.status, 500);
        assert.ok(failed.body.message.includes('retry the same action'));
        assert.ok(!failed.body.message.includes('private'));
        assert.strictEqual((await Review.findById(retry.review._id)).status, 'hidden');
        assert.strictEqual((await Report.findById(retry.report._id)).status, 'open');
        assert.strictEqual((await Restaurant.findById(retry.restaurant.id)).ratingSummary.reviewCount, 2);
        console.log('PASS 9: Injected rating failure returns 500, keeps report open and review available for retry');
        console.log('KNOWN LIMITATION: After that failure the review is hidden but stored ratings remain stale until retry.');
        assert.strictEqual((await moderate(retry.report, 'delete')).status, 200);
        assert.strictEqual(await Review.findById(retry.review._id), null);
        await assertExcluded(retry.restaurant, retry.review._id);
        console.log('PASS 10: Retrying the same delete action repairs ratings and completes deletion');

        const closure = await fixture();
        const closeFailure = sinon.stub(Report, 'findOneAndUpdate').rejects(new Error('Injected close failure'));
        const closeLog = sinon.stub(console, 'error');
        try { failed = await moderate(closure.report, 'delete'); }
        finally { closeFailure.restore(); closeLog.restore(); }
        assert.strictEqual(failed.status, 500);
        assert.ok(failed.body.message.includes('review was deleted'));
        assert.strictEqual(await Review.findById(closure.review._id), null);
        assert.strictEqual((await Report.findById(closure.report._id)).status, 'open');
        await assertExcluded(closure.restaurant, closure.review._id);
        assert.strictEqual((await Report.findById(closure.report._id)).decision, 'delete');
        assert.strictEqual((await moderate(closure.report, 'dismiss')).status, 409);
        assert.strictEqual((await moderate(closure.report, 'delete')).status, 200);
        audit(await Report.findById(closure.report._id), 'actioned', 'delete');
        console.log('PASS 11: Failed report closure after deletion returns recovery guidance; retry closes remaining report with the original delete decision');

        const missing = new mongoose.Types.ObjectId().toString();
        assert.strictEqual((await request('PATCH', `${queuePath}/${missing}`, { action: 'hide' })).status, 404);
        assert.strictEqual((await moderate(hidden.report, 'delete')).status, 409);
        assert.deepStrictEqual((await request('GET', queuePath)).body, []);
        assert.strictEqual((await Review.findById(initial.review._id)).status, 'published');
        console.log('PASS 12: Missing/resolved reports are rejected; resolved queue is empty and unrelated review preserved');
        const history = await request('GET', `${queuePath}/history`);
        assert.strictEqual(history.status, 200);
        for (const [id, decision] of [[initial.report._id, 'dismiss'], [hidden.report._id, 'hide'], [deleted.report._id, 'delete'], [closure.report._id, 'delete']]) {
            const saved = history.body.find(item => item._id === id);
            assert.strictEqual(saved.decision, decision);
            assert.strictEqual(saved.resolvedBy.name, 'Local admin');
            assert.ok(saved.resolvedAt);
        }
        assert.strictEqual(history.body.find(item => item._id === deleted.report._id).reviewId, null);
        for (const role of [null, 'customer', 'owner']) {
            assert.strictEqual((await request('GET', `${queuePath}/history`, undefined, role)).status, role ? 403 : 401);
        }
        console.log('PASS 13: Admin-only history retains distinct decisions, actor and time even after deletion');
        const legacy = await Report.collection.insertOne({reviewId: new mongoose.Types.ObjectId(),
            reporterId: users.owner._id, reason: 'spam', status: 'actioned'});
        const legacyHistory = (await request('GET', `${queuePath}/history`)).body.find(item => item._id === String(legacy.insertedId));
        assert.ok(!legacyHistory.decision);
        assert.strictEqual(legacyHistory.reviewId, null);
        console.log('PASS 14: Legacy records without a decision remain readable without inventing a decision');
        console.log('14 isolated HTTP/MongoDB checks passed. No shared Atlas data was accessed.');
    } finally {
        sinon.restore();
        if (server) await new Promise(resolve => server.close(resolve));
        await mongoose.disconnect();
        if (mongod.exitCode === null && !launchError) mongod.kill('SIGTERM');
        await stopped;
        fs.closeSync(log);
        fs.rmSync(directory, { recursive: true, force: true });
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
