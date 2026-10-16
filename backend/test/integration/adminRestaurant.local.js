// Optional real-database check: node test/integration/adminRestaurant.local.js
// Requires mongod on PATH. Uses only a new temporary local replica set, never .env's database.
const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const mongoose = require('mongoose');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const User = require('../../models/User');
const Restaurant = require('../../models/Restaurant');
const OwnerClaim = require('../../models/OwnerClaim');
const Review = require('../../models/Review');
const Report = require('../../models/Report');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function availablePort() {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

async function run() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rrp29-mongo-'));
    const port = await availablePort();
    const log = fs.openSync(path.join(directory, 'mongod.log'), 'w');
    const mongod = spawn('mongod', ['--dbpath', directory, '--port', String(port),
        '--bind_ip', '127.0.0.1', '--replSet', 'rrp29test', '--nounixsocket'], { stdio: ['ignore', log, log] });
    let launchError;
    mongod.on('error', error => { launchError = error; });
    const stopped = new Promise(resolve => { mongod.once('exit', resolve); mongod.once('error', resolve); });
    let server, bootstrap;
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'isolated-local-restaurant-integration-secret';
    try {
        bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`,
            { serverSelectionTimeoutMS: 1000 });
        let ready = false;
        for (let i = 0; i < 20; i++) {
            if (launchError) throw launchError;
            try { await bootstrap.connect(); ready = true; break; } catch { await delay(300); }
        }
        assert.ok(ready, 'Temporary mongod did not start');
        await bootstrap.db('admin').command({ replSetInitiate: {
            _id: 'rrp29test', members: [{ _id: 0, host: `127.0.0.1:${port}` }]
        } });
        ready = false;
        for (let i = 0; i < 100; i++) {
            const hello = await bootstrap.db('admin').command({ hello: 1 });
            if (hello.isWritablePrimary) { ready = true; break; }
            await delay(100);
        }
        assert.ok(ready, 'Temporary replica set did not elect a primary');
        await bootstrap.close();
        await mongoose.connect(`mongodb://127.0.0.1:${port}/rrp29_isolated_test?replicaSet=rrp29test`);
        await Promise.all([User.init(), Restaurant.init(), OwnerClaim.init(), Review.init(), Report.init()]);
        const admin = await User.create({ name: 'Admin', email: 'admin@local.test', password: 'LocalTest123!', role: 'admin' });
        const owner = await User.create({ name: 'Owner', email: 'owner@local.test', password: 'LocalTest123!', role: 'owner' });
        const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const url = `http://127.0.0.1:${server.address().port}/api/admin/restaurants`;
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        async function request(method, endpoint = '', data, auth = token) {
            const response = await fetch(`${url}${endpoint}`, {
                method, headers: { ...headers, Authorization: `Bearer ${auth}` },
                ...(data === undefined ? {} : { body: JSON.stringify(data) })
            });
            return { status: response.status, body: await response.json() };
        }
        const created = await request('POST', '', {
            name: ' New Kitchen ', priceLevel: 2,
            location: { address: 'Main St', suburb: 'City', latitude: -27, longitude: 153 },
            imageUrls: ['https://example.test/photo.jpg']
        });
        assert.strictEqual(created.status, 201);
        const id = created.body._id;
        assert.strictEqual(created.body.name, 'New Kitchen');
        assert.strictEqual((await Restaurant.findById(id)).ownerId, null);
        let list = await request('GET');
        assert.ok(list.body.some(item => item._id === id));
        console.log('PASS create persists defaults and appears in a fresh list request');

        await Restaurant.updateOne({ _id: id }, { ownerId: owner._id, 'ratingSummary.avgRating': 4 });
        assert.strictEqual((await request('PATCH', `/${id}`, { name: 'Updated Kitchen', location: { suburb: 'New suburb' } })).status, 200);
        const detailsURL = `http://127.0.0.1:${server.address().port}/api/restaurants/${id}/details`;
        let details = await fetch(detailsURL);
        let record = (await details.json()).restaurant;
        assert.strictEqual(record.name, 'Updated Kitchen');
        assert.strictEqual(record.location.suburb, 'New suburb');
        assert.strictEqual(record.location.address, 'Main St');
        assert.strictEqual(record.ownerId, owner.id);
        assert.strictEqual(record.ratingSummary.avgRating, 4);
        console.log('PASS partial edit persists on public details and preserves ownership and ratings');

        const before = await Restaurant.findById(id).lean();
        for (const body of [{ name: '' }, { priceLevel: 4 }, { websiteUrl: 'javascript:alert(1)' }, { ownerId: admin.id }]) {
            assert.strictEqual((await request('PATCH', `/${id}`, body)).status, 400);
        }
        assert.deepStrictEqual(await Restaurant.findById(id).lean(), before);
        console.log('PASS invalid edits return 400 without changing stored data');

        const ownerToken = jwt.sign({ id: owner.id }, process.env.JWT_SECRET);
        assert.strictEqual((await request('DELETE', `/${id}`, undefined, ownerToken)).status, 403);
        assert.ok(await Restaurant.findById(id));
        console.log('PASS real authentication prevents non-admin deletion');

        async function related(restaurantId, status = 'published') {
            const review = await Review.create({ restaurantId, userId: owner._id,
                ratings: { food: 4, service: 4, ambience: 4, value: 4 }, score: 4, comment: 'Local test', status });
            const claim = await OwnerClaim.create({ restaurantId, userId: owner._id });
            const report = await Report.create({ reviewId: review._id, reporterId: admin._id, reason: 'spam' });
            return { review, claim, report };
        }
        const target = await related(id, 'hidden');
        const unrelated = await Restaurant.create({ name: 'Keep this restaurant' });
        const keep = await related(unrelated.id);

        // Fail at the final child deletion, after real restaurant/report/review deletes have run.
        const failure = sinon.stub(OwnerClaim, 'deleteMany').rejects(new Error('Simulated claim deletion failure'));
        const errorLog = sinon.stub(console, 'error');
        try { assert.strictEqual((await request('DELETE', `/${id}`)).status, 500); }
        finally { failure.restore(); errorLog.restore(); }
        assert.ok(await Restaurant.findById(id));
        assert.ok(await Review.findById(target.review.id));
        assert.ok(await Report.findById(target.report.id));
        assert.ok(await OwnerClaim.findById(target.claim.id));
        console.log('PASS transaction rollback restores all records after a later delete fails');

        assert.strictEqual((await request('DELETE', `/${id}`)).status, 200);
        assert.strictEqual(await Restaurant.findById(id), null);
        assert.strictEqual(await Review.findById(target.review.id), null);
        assert.strictEqual(await Report.findById(target.report.id), null);
        assert.strictEqual(await OwnerClaim.findById(target.claim.id), null);
        assert.ok(await Restaurant.findById(unrelated.id));
        assert.ok(await Review.findById(keep.review.id));
        assert.ok(await Report.findById(keep.report.id));
        assert.ok(await OwnerClaim.findById(keep.claim.id));
        assert.strictEqual(await User.countDocuments(), 2);
        console.log('PASS cascade removes hidden reviews, claims and reports, preserving unrelated data and users');

        list = await request('GET');
        assert.ok(!list.body.some(item => item._id === id));
        details = await fetch(detailsURL);
        assert.strictEqual(details.status, 404);
        assert.strictEqual((await request('DELETE', `/${id}`)).status, 404);
        assert.strictEqual((await request('PATCH', `/${id}`, { name: 'Missing' })).status, 404);
        console.log('PASS deleted restaurant disappears from lists and returns 404 for details/edit/delete');

        assert.strictEqual((await request('DELETE', `/${unrelated.id}`)).status, 200);
        const empty = await Restaurant.create({ name: 'No related records' });
        assert.strictEqual((await request('DELETE', `/${empty.id}`)).status, 200);
        assert.deepStrictEqual((await request('GET')).body, []);
        console.log('PASS deletion also handles restaurants without related records');
        console.log('8 local MongoDB integration checks passed; shared Atlas was not used.');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        await mongoose.disconnect();
        if (bootstrap) await bootstrap.close();
        if (mongod.exitCode === null && !launchError) mongod.kill('SIGTERM');
        await stopped;
        fs.closeSync(log);
        fs.rmSync(directory, { recursive: true, force: true });
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
