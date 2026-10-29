const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { buildApp } = require('../src/app');
const { portalClient } = require('../src/clients/portalClient');

describe('Meter Network Hierarchy & Location Endpoints', () => {
  let app;
  let originalGetExport;
  let originalSearchMeters;
  let originalGetMeterGeo;
  let originalGetTransformers;

  before(async () => {
    originalGetExport = portalClient.getExport;
    originalSearchMeters = portalClient.searchMeters;
    originalGetMeterGeo = portalClient.getMeterGeo;
    originalGetTransformers = portalClient.getTransformers;

    portalClient.getExport = async () => {
      return {
        data: [
          {
            meterId: 'J100000',
            serialNo: 'SE33962',
            dtCode: 'DT-001',
            hierarchy: {
              zone: { name: 'Jaipur Zone 1', code: 'Z-01' },
              circle: { name: 'Circle 1', code: 'C-01' },
              division: { name: 'Division 1', code: 'D-01' },
              subdivision: { name: 'Subdivision 1', code: 'SD-01' },
              substation: { name: 'Substation 1', code: 'SS-01' },
              feeder: { name: 'Feeder 1', code: 'F-001' },
              dt: { name: 'Malviya Nagar DT 1', code: 'DT-001' },
            },
            geo: {
              lat: 26.938961,
              lng: 75.830956,
            },
          },
        ],
      };
    };

    app = await buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    portalClient.getExport = originalGetExport;
    portalClient.searchMeters = originalSearchMeters;
    portalClient.getMeterGeo = originalGetMeterGeo;
    portalClient.getTransformers = originalGetTransformers;
    await app.close();
  });

  test('GET /api/meters/:meterId/network retrieves complete network hierarchy and coordinates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/meters/J100000/network',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.data.meterId, 'J100000');
    assert.strictEqual(body.data.distributionTransformerCode, 'DT-001');
    assert.ok(body.data.hierarchy);
    assert.strictEqual(body.data.hierarchy.zone.name, 'Jaipur Zone 1');
    assert.strictEqual(body.data.hierarchy.dt.name, 'Malviya Nagar DT 1');
    assert.ok(body.data.coordinates);
    assert.strictEqual(body.data.coordinates.latitude, 26.938961);
  });
});

