const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  parseIndianDateToIso,
  normalizeGeo,
  normalizeReading,
  normalizeMeter,
} = require('../src/utils/normalizer');

describe('Data Normalization Utilities', () => {
  test('parseIndianDateToIso parses DD/MM/YYYY HH:mm format accurately', () => {
    const parsed = parseIndianDateToIso('23/06/2026 23:30');
    assert.strictEqual(parsed, '2026-06-23T23:30:00.000Z');
  });

  test('parseIndianDateToIso handles null or invalid strings safely', () => {
    assert.strictEqual(parseIndianDateToIso(null), null);
    assert.strictEqual(parseIndianDateToIso(''), null);
    assert.strictEqual(parseIndianDateToIso('invalid-date'), null);
  });

  test('normalizeGeo parses coordinate strings to floating-point numbers', () => {
    const raw = {
      data: {
        latitude: '26.938961002479868',
        longitude: '75.83095696146852',
      },
    };
    const result = normalizeGeo(raw);
    assert.strictEqual(typeof result.latitude, 'number');
    assert.strictEqual(typeof result.longitude, 'number');
    assert.ok(result.latitude > 26.9 && result.latitude < 27.0);
  });

  test('normalizeGeo gracefully handles null or missing coordinates', () => {
    assert.strictEqual(normalizeGeo(null), null);
    const emptyResult = normalizeGeo({});
    assert.strictEqual(emptyResult.latitude, null);
    assert.strictEqual(emptyResult.longitude, null);
  });

  test('normalizeReading converts string readings and Indian dates to structured objects', () => {
    const raw = {
      timestamp: '24/06/2026 00:00',
      kwh: '48439.16',
      kvah: '52314.29',
      voltR: '229',
    };
    const normalized = normalizeReading(raw);
    assert.strictEqual(normalized.timestamp, '2026-06-24T00:00:00.000Z');
    assert.strictEqual(normalized.activeEnergyKwh, 48439.16);
    assert.strictEqual(normalized.apparentEnergyKvah, 52314.29);
    assert.strictEqual(normalized.voltageR, 229);
  });

  test('normalizeMeter preserves meter identity and cleans up field names', () => {
    const raw = {
      meterId: 'J100000',
      serialNo: 'SE33962',
      make: 'HPL',
      phaseType: 'single',
      installStatus: 'Decommissioned',
      dtCode: 'DT-001',
    };
    const normalized = normalizeMeter(raw);
    assert.strictEqual(normalized.meterId, 'J100000');
    assert.strictEqual(normalized.serialNumber, 'SE33962');
    assert.strictEqual(normalized.manufacturer, 'HPL');
    assert.strictEqual(normalized.phaseType, 'single');
    assert.strictEqual(normalized.installationStatus, 'Decommissioned');
    assert.strictEqual(normalized.distributionTransformerCode, 'DT-001');
  });
});

