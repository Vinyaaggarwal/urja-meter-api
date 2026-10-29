const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { buildApp } = require('../src/app');
const { portalClient } = require('../src/clients/portalClient');

describe('Upstream Error Handling & Resilience Tests', () => {
  let app;
  let originalSearchMeters;

  before(async () => {
    originalSearchMeters = portalClient.searchMeters;
    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    portalClient.searchMeters = originalSearchMeters;
    await app.close();
  });

  test('Upstream 504 Timeout translates into 504 Gateway Timeout error response', async () => {
    portalClient.searchMeters = async () => {
      const err = new Error('Upstream request timed out');
      err.statusCode = 504;
      throw err;
    };

    const res = await app.inject({
      method: 'GET',
      url: '/api/meters',
    });

    assert.strictEqual(res.statusCode, 504);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.statusCode, 504);
    assert.ok(body.error.includes('timed out'));
  });

  test('Upstream 502 Bad Gateway translates cleanly without leaking credentials', async () => {
    portalClient.searchMeters = async () => {
      const err = new Error('Failed to authenticate operator@urja.local with session_token=secret123');
      err.statusCode = 502;
      throw err;
    };

    const res = await app.inject({
      method: 'GET',
      url: '/api/meters',
    });

    assert.strictEqual(res.statusCode, 502);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.statusCode, 502);
    // Ensure email and session token are redacted
    assert.ok(!body.error.includes('operator@urja.local'));
    assert.ok(!body.error.includes('secret123'));
    assert.ok(body.error.includes('[REDACTED'));
  });
});

