const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  parseIndianDateToIso,
  normalizeGeo,
  normalizeReading,
  normalizeMeter,
  normalizeConsumptionList,
  normalizeExportRecord,
} = require('../src/utils/normalizer');

describe('Data Normalization Utilities', () => {
  test('parseIndianDateToIso parses DD/MM/YYYY HH:mm IST into UTC ISO string accurately', () => {
    // 23:30 IST is 18:00 UTC (UTC+5:30 offset subtracted)
    const parsed = parseIndianDateToIso('23/06/2026 23:30');
    assert.strictEqual(parsed, '2026-06-23T18:00:00.000Z');
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
    // 00:00 IST is 18:30 UTC of previous day
    assert.strictEqual(normalized.timestamp, '2026-06-23T18:30:00.000Z');
    assert.strictEqual(normalized.activeEnergyKwh, 48439.16);
    assert.strictEqual(normalized.apparentEnergyKvah, 52314.29);
    assert.strictEqual(normalized.voltageR, 229);
  });

  test('normalizeConsumptionList computes intervalKwh incremental delta between intervals', () => {
    const readings = [
      { timestamp: '23/06/2026 23:30', kwh: '48438.74', kvah: '52313.84', voltR: '226' },
      { timestamp: '24/06/2026 00:00', kwh: '48439.16', kvah: '52314.29', voltR: '229' },
    ];
    const list = normalizeConsumptionList(readings);
    assert.strictEqual(list[0].intervalKwh, null);
    assert.strictEqual(list[1].intervalKwh, 0.42);
  });

  test('normalizeConsumptionList returns null intervalKwh when timestamp gap exceeds 30 minutes', () => {
    // 23:30 → 01:00 is a 90-minute gap — no reliable 30-min interval delta
    const readings = [
      { timestamp: '23/06/2026 23:30', kwh: '100.00', kvah: '110.00', voltR: '230' },
      { timestamp: '24/06/2026 01:00', kwh: '101.00', kvah: '111.10', voltR: '231' },
    ];
    const list = normalizeConsumptionList(readings);
    assert.strictEqual(list[0].intervalKwh, null);
    // Gap of 90 min → should be null, not 1.00
    assert.strictEqual(list[1].intervalKwh, null);
  });

  test('normalizeConsumptionList returns null intervalKwh when register decreases (reset or rollover)', () => {
    const readings = [
      { timestamp: '23/06/2026 23:30', kwh: '99999.99', kvah: '110.00', voltR: '230' },
      { timestamp: '24/06/2026 00:00', kwh: '0.50',     kvah: '0.55',   voltR: '229' },
    ];
    const list = normalizeConsumptionList(readings);
    assert.strictEqual(list[0].intervalKwh, null);
    assert.strictEqual(list[1].intervalKwh, null);
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

  test('normalizeExportRecord converts raw portal export fields to clean API schema', () => {
    const raw = {
      meterId: 'J100000',
      serialNo: 'SE33962',
      make: 'HPL',
      phaseType: 'single',
      installStatus: 'Decommissioned',
      dtCode: 'DT-001',
      hierarchy: { zone: { name: 'Jaipur Zone 1', code: 'Z-01' } },
      geo: { lat: '26.938961', lng: '75.830956' },
    };
    const normalized = normalizeExportRecord(raw);
    assert.strictEqual(normalized.meterId, 'J100000');
    assert.strictEqual(normalized.serialNumber, 'SE33962');
    assert.strictEqual(normalized.manufacturer, 'HPL');
    assert.strictEqual(normalized.distributionTransformerCode, 'DT-001');
    assert.strictEqual(normalized.geo.latitude, 26.938961);
    assert.strictEqual(normalized.geo.longitude, 75.830956);
  });
});

