const assert = require('assert');
const sinon = require('sinon');

const Task = require('../models/Task');
const { deleteTask } = require('../controllers/taskController');

describe('deleteTask authorization', function () {
    const sandbox = sinon.createSandbox();
    const taskId = '507f1f77bcf86cd799439011';
    const authorId = '507f191e810c19729de860ea';
    const otherUserId = '507f191e810c19729de860eb';

    function makeResponse() {
        return {
            statusCode: 200,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.body = data;
                return this;
            }
        };
    }

    function makeTask() {
        return {
            userId: { toString: () => authorId },
            remove: sandbox.stub().resolves()
        };
    }

    beforeEach(function () {
        sandbox.stub(Task, 'findById');
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('allows an admin to delete another user\'s review', async function () {
        const task = makeTask();
        Task.findById.resolves(task);
        const req = {
            params: { id: taskId },
            user: { id: otherUserId, role: 'admin' }
        };
        const res = makeResponse();

        await deleteTask(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(task.remove.calledOnce, true);
    });

    it('allows a user to delete their own review', async function () {
        const task = makeTask();
        Task.findById.resolves(task);
        const req = {
            params: { id: taskId },
            user: { id: authorId, role: 'customer' }
        };
        const res = makeResponse();

        await deleteTask(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(task.remove.calledOnce, true);
    });

    it('rejects a non-admin deleting another user\'s review', async function () {
        const task = makeTask();
        Task.findById.resolves(task);
        const req = {
            params: { id: taskId },
            user: { id: otherUserId, role: 'customer' }
        };
        const res = makeResponse();

        await deleteTask(req, res);

        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(task.remove.called, false);
    });
});
