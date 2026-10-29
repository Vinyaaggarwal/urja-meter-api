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

  test('GET /api/health alias returns 200 with same structure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'healthy');
  });
});

