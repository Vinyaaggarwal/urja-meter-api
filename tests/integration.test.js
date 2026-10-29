const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { buildApp } = require('../src/app');
const { portalClient } = require('../src/clients/portalClient');

describe('Live Portal Read-Only Integration Suite', () => {
  let app;
  let sampleMeterId = 'J100000';
  let isPortalReachable = false;

  before(async () => {
    // Probe portal connectivity
    try {
      await portalClient.login();
      isPortalReachable = true;
    } catch (err) {
      console.warn('⚠️ Live portal is unreachable or running in isolated sandbox:', err.message);
      isPortalReachable = false;
    }

    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('Live Portal: Authenticated Session and Meter Query', async (t) => {
    if (!isPortalReachable) {
      t.skip('Live portal is unreachable or network is restricted');
      return;
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/meters?page=1',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
    sampleMeterId = body.data[0].meterId;
    assert.ok(sampleMeterId);
  });

  test('Live Portal: Meter Details & Coordinates for Sample Meter', async (t) => {
    if (!isPortalReachable) {
      t.skip('Live portal is unreachable or network is restricted');
      return;
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/meters/${sampleMeterId}`,
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.meterId, sampleMeterId);
  });

  test('Live Portal: Interval Consumption Readings', async (t) => {
    if (!isPortalReachable) {
      t.skip('Live portal is unreachable or network is restricted');
      return;
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/meters/${sampleMeterId}/consumption`,
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.meta.unit, 'kWh');
  });

  test('Live Portal: Network Location & Hierarchy', async (t) => {
    if (!isPortalReachable) {
      t.skip('Live portal is unreachable or network is restricted');
      return;
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/meters/${sampleMeterId}/network`,
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.meterId, sampleMeterId);
  });

  test('Live Portal: HMAC Signed Export', async (t) => {
    if (!isPortalReachable) {
      t.skip('Live portal is unreachable or network is restricted');
      return;
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/export?page=1',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.meta.signatureMethod, 'HMAC-SHA256');
  });
});

