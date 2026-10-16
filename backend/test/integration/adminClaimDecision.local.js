// Optional real-database check: node test/integration/adminClaimDecision.local.js
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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function availablePort() {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

async function run() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rrp28-mongo-'));
    const port = await availablePort();
    const log = fs.openSync(path.join(directory, 'mongod.log'), 'w');
    const mongod = spawn('mongod', ['--dbpath', directory, '--port', String(port),
        '--bind_ip', '127.0.0.1', '--replSet', 'rrp28test', '--nounixsocket'], { stdio: ['ignore', log, log] });
    let launchError;
    mongod.on('error', error => { launchError = error; });
    const stopped = new Promise(resolve => { mongod.once('exit', resolve); mongod.once('error', resolve); });
    let server, bootstrap;
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'isolated-local-claim-integration-secret';
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
            _id: 'rrp28test', members: [{ _id: 0, host: `127.0.0.1:${port}` }]
        } });
        ready = false;
        for (let i = 0; i < 100; i++) {
            const hello = await bootstrap.db('admin').command({ hello: 1 });
            if (hello.isWritablePrimary) { ready = true; break; }
            await delay(100);
        }
        assert.ok(ready, 'Temporary replica set did not elect a primary');
        await bootstrap.close();
        await mongoose.connect(`mongodb://127.0.0.1:${port}/rrp28_isolated_test?replicaSet=rrp28test`);
        await Promise.all([User.init(), Restaurant.init(), OwnerClaim.init()]);
        const admin = await User.create({ name: 'Admin', email: 'admin@local.test', password: 'LocalTest123!', role: 'admin' });
        const owner = await User.create({ name: 'Owner', email: 'owner@local.test', password: 'LocalTest123!', role: 'owner' });
        const other = await User.create({ name: 'Other', email: 'other@local.test', password: 'LocalTest123!', role: 'owner' });
        const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const url = `http://127.0.0.1:${server.address().port}/api/admin/claims`;
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        async function decide(claim, decision) {
            const response = await fetch(`${url}/${claim.id}`, { method: 'PATCH', headers, body: JSON.stringify({ decision }) });
            return { status: response.status, body: await response.json() };
        }
        async function fixture(name, applicant = owner) {
            const restaurant = await Restaurant.create({ name });
            const claim = await OwnerClaim.create({ restaurantId: restaurant._id, userId: applicant._id, message: 'Local test' });
            return { restaurant, claim };
        }
        const approved = await fixture('Approved');
        assert.strictEqual((await decide(approved.claim, 'approved')).status, 200);
        let saved = await OwnerClaim.findById(approved.claim.id);
        assert.strictEqual(saved.status, 'approved');
        assert.ok(saved.decidedBy.equals(admin._id));
        assert.ok(saved.decidedAt instanceof Date);
        assert.ok((await Restaurant.findById(approved.restaurant.id)).ownerId.equals(owner._id));
        console.log('PASS approval persists ownership and audit fields');

        const rejected = await fixture('Rejected');
        await Restaurant.updateOne({ _id: rejected.restaurant._id }, { ownerId: other._id });
        assert.strictEqual((await decide(rejected.claim, 'rejected')).status, 200);
        assert.strictEqual((await OwnerClaim.findById(rejected.claim.id)).status, 'rejected');
        assert.ok((await Restaurant.findById(rejected.restaurant.id)).ownerId.equals(other._id));
        console.log('PASS rejection preserves existing ownership');

        assert.strictEqual((await decide(approved.claim, 'rejected')).status, 409);
        console.log('PASS repeated decision is rejected');

        const rollback = await fixture('Rollback');
        const saveFailure = sinon.stub(OwnerClaim.prototype, 'save').rejects(new Error('Simulated claim persistence failure'));
        const errorLog = sinon.stub(console, 'error');
        try { assert.strictEqual((await decide(rollback.claim, 'approved')).status, 500); }
        finally { saveFailure.restore(); errorLog.restore(); }
        assert.strictEqual((await Restaurant.findById(rollback.restaurant.id)).ownerId, null);
        assert.strictEqual((await OwnerClaim.findById(rollback.claim.id)).status, 'pending');
        console.log('PASS transaction rolls back restaurant write when claim save fails');

        const concurrent = await fixture('Concurrent same claim');
        const results = await Promise.all([decide(concurrent.claim, 'approved'), decide(concurrent.claim, 'rejected')]);
        assert.deepStrictEqual(results.map(r => r.status).sort(), [200, 409]);
        saved = await OwnerClaim.findById(concurrent.claim.id);
        const concurrentRestaurant = await Restaurant.findById(concurrent.restaurant.id);
        if (saved.status === 'approved') assert.ok(concurrentRestaurant.ownerId.equals(owner._id));
        else assert.strictEqual(concurrentRestaurant.ownerId, null);
        console.log('PASS simultaneous decisions allow exactly one winner');

        const competing = await fixture('Competing owners');
        const otherClaim = await OwnerClaim.create({ restaurantId: competing.restaurant._id, userId: other._id });
        const competingResults = await Promise.all([decide(competing.claim, 'approved'), decide(otherClaim, 'approved')]);
        assert.deepStrictEqual(competingResults.map(r => r.status).sort(), [200, 409]);
        const claims = await OwnerClaim.find({ restaurantId: competing.restaurant._id });
        const winner = claims.find(c => c.status === 'approved');
        assert.strictEqual(claims.filter(c => c.status === 'approved').length, 1);
        assert.ok((await Restaurant.findById(competing.restaurant.id)).ownerId.equals(winner.userId));
        console.log('PASS competing applicants cannot overwrite the winning owner');

        const response = await fetch(url, { headers });
        assert.strictEqual(response.status, 200);
        const pending = await response.json();
        assert.ok(pending.every(c => c.status === 'pending' && c.userId.email && c.restaurantId.name));
        assert.ok(pending.every(c => !('password' in c.userId)));
        assert.ok(!pending.some(c => [approved.claim.id, rejected.claim.id].includes(c._id)));
        console.log('PASS refreshed list populates details and excludes decided claims');
        console.log('7 local MongoDB integration checks passed; shared Atlas was not used.');
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
