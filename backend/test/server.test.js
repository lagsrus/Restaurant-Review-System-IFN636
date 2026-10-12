const assert = require('assert');
const app = require('../server');

describe('server baseline', function () {
    it('exports the Express application for testing', function () {
        assert.strictEqual(typeof app, 'function');
    });
});
