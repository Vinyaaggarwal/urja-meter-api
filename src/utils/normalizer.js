/**
 * Utility functions for normalizing upstream Urja Ops Portal data
 */

/**
 * Parses DD/MM/YYYY HH:mm string to ISO 8601 string
 * Example: '23/06/2026 23:30' -> '2026-06-23T23:30:00.000Z'
 * @param {string} dateStr
 * @returns {string|null}
 */
function parseIndianDateToIso(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split(' ');
  if (parts.length < 2) return null;

  const [datePart, timePart] = parts;
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  if (!day || !month || !year || hours === undefined || minutes === undefined) {
    return null;
  }

  // Create date (months are 0-indexed in JS Date)
  const dt = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

/**
 * Normalizes GPS coordinates
 * @param {Object} geo
 * @returns {{ latitude: number|null, longitude: number|null }}
 */
function normalizeGeo(geo) {
  if (!geo) return null;
  const rawData = geo.data || geo;
  const latRaw = rawData.latitude !== undefined ? rawData.latitude : rawData.lat;
  const lngRaw = rawData.longitude !== undefined ? rawData.longitude : rawData.lng;

  const lat = latRaw !== undefined && latRaw !== null ? parseFloat(latRaw) : null;
  const lng = lngRaw !== undefined && lngRaw !== null ? parseFloat(lngRaw) : null;

  return {
    latitude: !isNaN(lat) ? lat : null,
    longitude: !isNaN(lng) ? lng : null,
  };
}

/**
 * Normalizes a single consumption reading
 * @param {Object} item
 * @returns {Object}
 */
function normalizeReading(item) {
  if (!item) return null;
  const isoTime = parseIndianDateToIso(item.timestamp);
  const kwh = item.kwh !== undefined ? parseFloat(item.kwh) : null;
  const kvah = item.kvah !== undefined ? parseFloat(item.kvah) : null;
  const voltR = item.voltR !== undefined ? parseFloat(item.voltR) : null;

  return {
    timestamp: isoTime || item.timestamp,
    rawTimestamp: item.timestamp,
    activeEnergyKwh: !isNaN(kwh) ? kwh : null,
    apparentEnergyKvah: !isNaN(kvah) ? kvah : null,
    voltageR: !isNaN(voltR) ? voltR : null,
  };
}

/**
 * Normalizes an array of energy / consumption readings
 * @param {Array} readings
 * @returns {Array}
 */
function normalizeConsumptionList(readings) {
  if (!Array.isArray(readings)) return [];
  return readings.map(normalizeReading).filter(Boolean);
}

/**
 * Normalizes meter metadata
 * @param {Object} meter
 * @returns {Object}
 */
function normalizeMeter(meter) {
  if (!meter) return null;
  return {
    meterId: meter.meterId || null,
    serialNumber: meter.serialNo || null,
    manufacturer: meter.make || null,
    phaseType: meter.phaseType || null,
    installationStatus: meter.installStatus || null,
    distributionTransformerCode: meter.dtCode || null,
    installationType: meter.installType || undefined,
    build: meter.build || undefined,
  };
}

module.exports = {
  parseIndianDateToIso,
  normalizeGeo,
  normalizeReading,
  normalizeConsumptionList,
  normalizeMeter,
};

