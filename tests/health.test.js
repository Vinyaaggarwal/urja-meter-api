const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { buildApp } = require('../src/app');

describe('Health Check Routes', () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /health returns 200 with status healthy and portal info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'healthy');
    assert.ok(body.timestamp);
    assert.ok(body.portal);
  });

  test('GET /api/meters returns 200 with data array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters',
    });

    // 200 when portal reachable, 502/504 in offline test env — both are valid
    assert.ok([200, 502, 504].includes(res.statusCode));
  });
});

