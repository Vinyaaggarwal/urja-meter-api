const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { buildApp } = require('../src/app');
const { portalClient } = require('../src/clients/portalClient');

describe('Meter Consumption History Endpoints', () => {
  let app;
  let originalGetMeterEnergy;

  before(async () => {
    originalGetMeterEnergy = portalClient.getMeterEnergy;

    portalClient.getMeterEnergy = async (meterId) => {
      if (meterId === 'MTR_UNKNOWN') {
        const err = new Error('Meter not found');
        err.statusCode = 404;
        throw err;
      }

      return {
        data: [
          {
            timestamp: '23/06/2026 23:30',
            kwh: '48438.74',
            kvah: '52313.84',
            voltR: '226',
          },
          {
            timestamp: '24/06/2026 00:00',
            kwh: '48439.16',
            kvah: '52314.29',
            voltR: '229',
          },
        ],
      };
    };

    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    portalClient.getMeterEnergy = originalGetMeterEnergy;
    await app.close();
  });

  test('GET /api/meters/:meterId/consumption returns normalized interval readings and metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters/J100000/consumption',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.data.length, 2);
    assert.strictEqual(body.data[0].timestamp, '2026-06-23T23:30:00.000Z');
    assert.strictEqual(body.data[0].activeEnergyKwh, 48438.74);
    assert.strictEqual(body.data[0].apparentEnergyKvah, 52313.84);
    assert.strictEqual(body.data[0].voltageR, 226);
    assert.strictEqual(body.meta.meterId, 'J100000');
    assert.strictEqual(body.meta.count, 2);
    assert.strictEqual(body.meta.unit, 'kWh');
  });

  test('GET /api/meters/:meterId/consumption returns 404 for unknown meter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters/MTR_UNKNOWN/consumption',
    });

    assert.strictEqual(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.statusCode, 404);
  });
});

