const assert = require('assert');
const sinon = require('sinon');
const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Report = require('../models/Report');
const app = require('../server');

chai.use(chaiHttp);

describe('RRP-22 / FR-10: Reporting route permissions', function () {
    const sandbox = sinon.createSandbox();

    afterEach(function () {
        sandbox.restore();
    });

    it('403: prevents an admin from reporting a review', async function () {
        const adminId = '507f1f77bcf86cd799439022';
        const reviewId = '507f1f77bcf86cd799439011';

        sandbox.stub(jwt, 'verify').returns({ id: adminId });

        sandbox.stub(User, 'findById').returns({
            select: sandbox.stub().resolves({
                _id: adminId,
                role: 'admin'
            })
        });

        const createReport = sandbox.stub(Report, 'create');

        const res = await chai.request(app)
            .post(`/api/reviews/${reviewId}/reports`)
            .set('Authorization', 'Bearer mock-admin-token')
            .send({ reason: 'spam' })
            .ok(response => response.status === 403);

        assert.strictEqual(res.status, 403);
        assert.strictEqual(
            res.body.message,
            'Forbidden: insufficient role'
        );
        assert.strictEqual(createReport.called, false);
    });
});