/**
 * Utility functions for normalizing upstream Urja Ops Portal data
 */

/**
 * Parses DD/MM/YYYY HH:mm string (assumed to be Indian Standard Time, UTC+5:30)
 * to an ISO 8601 UTC string.
 * Example: '23/06/2026 23:30' IST -> '2026-06-23T18:00:00.000Z' UTC
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

  // Portal timestamps (DD/MM/YYYY HH:mm) are in Indian Standard Time (IST, UTC+5:30).
  // Convert IST to UTC by subtracting 5 hours and 30 minutes (19,800,000 ms).
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes) - (5 * 60 + 30) * 60 * 1000;
  const dt = new Date(utcMillis);
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
 * Normalizes an array of energy / consumption readings.
 * Computes intervalKwh (delta from preceding reading) if readings are cumulative registers.
 * Rules:
 *  - First reading: intervalKwh = null (no baseline).
 *  - Gap > 30 min between consecutive timestamps: intervalKwh = null (misleading span).
 *  - Register decrease (reset/rollover): intervalKwh = null.
 *  - Otherwise: intervalKwh = curr - prev (rounded to 2 decimal places).
 * @param {Array} readings
 * @returns {Array}
 */
function normalizeConsumptionList(readings) {
  if (!Array.isArray(readings)) return [];
  const normalized = readings.map(normalizeReading).filter(Boolean);

  for (let i = 0; i < normalized.length; i++) {
    if (i === 0) {
      normalized[i].intervalKwh = null; // Baseline — no preceding reading
    } else {
      const prev = normalized[i - 1].activeEnergyKwh;
      const curr = normalized[i].activeEnergyKwh;

      // Gap detection: if the gap between consecutive timestamps exceeds 30 minutes
      // (1 800 000 ms), the delta would cover a longer-than-expected window.
      const prevTs = normalized[i - 1].timestamp ? new Date(normalized[i - 1].timestamp).getTime() : NaN;
      const currTs = normalized[i].timestamp ? new Date(normalized[i].timestamp).getTime() : NaN;
      const gapMs = currTs - prevTs;
      const hasGap = isNaN(gapMs) || gapMs > 30 * 60 * 1000;

      if (hasGap) {
        // Timestamps more than 30 min apart — delta would be misleading
        normalized[i].intervalKwh = null;
      } else if (typeof prev === 'number' && typeof curr === 'number' && curr >= prev) {
        normalized[i].intervalKwh = parseFloat((curr - prev).toFixed(2));
      } else {
        // Register decreased (reset or rollover)
        normalized[i].intervalKwh = null;
      }
    }
  }

  return normalized;
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
    serialNumber: meter.serialNo || meter.serialNumber || null,
    manufacturer: meter.make || meter.manufacturer || null,
    phaseType: meter.phaseType || null,
    installationStatus: meter.installStatus || meter.installationStatus || null,
    distributionTransformerCode: meter.dtCode || meter.distributionTransformerCode || null,
    installationType: meter.installType || meter.installationType || undefined,
    build: meter.build || undefined,
  };
}

/**
 * Normalizes an export record, converting raw portal field names to standard API naming
 * @param {Object} record
 * @returns {Object}
 */
function normalizeExportRecord(record) {
  if (!record) return null;
  return {
    meterId: record.meterId || null,
    serialNumber: record.serialNo || record.serialNumber || null,
    manufacturer: record.make || record.manufacturer || null,
    phaseType: record.phaseType || null,
    installationStatus: record.installStatus || record.installationStatus || null,
    installationType: record.installType || record.installationType || undefined,
    build: record.build || undefined,
    distributionTransformerCode: record.dtCode || record.distributionTransformerCode || null,
    hierarchy: record.hierarchy || null,
    geo: normalizeGeo(record.geo),
  };
}

module.exports = {
  parseIndianDateToIso,
  normalizeGeo,
  normalizeReading,
  normalizeConsumptionList,
  normalizeMeter,
  normalizeExportRecord,
};

