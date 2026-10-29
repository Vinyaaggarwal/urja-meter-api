const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { buildApp } = require('../src/app');
const { portalClient } = require('../src/clients/portalClient');

describe('Meter Endpoints (Mocked Deterministic Tests)', () => {
  let app;
  let originalSearchMeters;
  let originalGetMeterGeo;
  let originalGetMeterEnergy;

  before(async () => {
    originalSearchMeters = portalClient.searchMeters;
    originalGetMeterGeo = portalClient.getMeterGeo;
    originalGetMeterEnergy = portalClient.getMeterEnergy;

    // Mock search meters
    portalClient.searchMeters = async ({ q = '', page = 1 }) => {
      if (q === 'NONEXISTENT') {
        return { data: [], total: 0, page: 1, pageSize: 20 };
      }
      return {
        data: [
          {
            meterId: 'J100000',
            serialNo: 'SE33962',
            make: 'HPL',
            phaseType: 'single',
            installStatus: 'Decommissioned',
            dtCode: 'DT-001',
          },
          {
            meterId: 'J100001',
            serialNo: 'GE84132',
            make: 'L&T',
            phaseType: 'three',
            installStatus: 'Active',
            dtCode: 'DT-002',
          },
        ],
        total: 2,
        page: Number(page) || 1,
        pageSize: 20,
      };
    };

    // Mock meter geo
    portalClient.getMeterGeo = async (meterId) => {
      if (meterId === 'NONEXISTENT') {
        const err = new Error('Meter not found');
        err.statusCode = 404;
        throw err;
      }
      return {
        data: {
          latitude: '26.938961002479868',
          longitude: '75.83095696146852',
        },
      };
    };

    // Mock meter energy
    portalClient.getMeterEnergy = async (meterId) => {
      if (meterId === 'NONEXISTENT') {
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
        ],
      };
    };

    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    portalClient.searchMeters = originalSearchMeters;
    portalClient.getMeterGeo = originalGetMeterGeo;
    portalClient.getMeterEnergy = originalGetMeterEnergy;
    await app.close();
  });

  test('GET /api/meters returns normalized meters and pagination metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters?page=1',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.data.length, 2);
    assert.strictEqual(body.data[0].meterId, 'J100000');
    assert.strictEqual(body.data[0].manufacturer, 'HPL');
    assert.strictEqual(body.meta.page, 1);
    assert.strictEqual(body.meta.total, 2);
    assert.strictEqual(body.meta.totalPages, 1);
  });

  test('GET /api/meters validates query parameters and rejects invalid page numbers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters?page=-5',
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.statusCode, 400);
  });

  test('GET /api/meters/:meterId retrieves normalized composite meter details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters/J100000',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.meterId, 'J100000');
    assert.strictEqual(body.data.serialNumber, 'SE33962');
    assert.strictEqual(body.data.distributionTransformerCode, 'DT-001');
    assert.ok(body.data.geo);
    assert.strictEqual(typeof body.data.geo.latitude, 'number');
    assert.strictEqual(typeof body.data.geo.longitude, 'number');
    assert.ok(body.data.latestReading);
    assert.strictEqual(body.data.latestReading.activeEnergyKwh, 48438.74);
  });

  test('GET /api/meters/:meterId returns 404 for unknown meter record', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters/NONEXISTENT',
    });

    assert.strictEqual(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.statusCode, 404);
    assert.ok(body.error.includes('not found'));
  });
});

