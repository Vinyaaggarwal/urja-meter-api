const { portalClient } = require('../clients/portalClient');
const {
  normalizeMeter,
  normalizeGeo,
  normalizeConsumptionList,
  normalizeReading,
  normalizeExportRecord,
} = require('../utils/normalizer');

/**
 * Simple service handling business logic for meters, transformers, and exports
 */
class MeterService {
  constructor(client = portalClient) {
    this.client = client;
  }

  // 1. Search and list meters with pagination
  async searchMeters({ q = '', page = 1 } = {}) {
    const raw = await this.client.searchMeters({ q, page });
    const list = Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : [];
    const total = raw.total ?? list.length;
    const pageSize = raw.pageSize || 20;

    return {
      data: list.map(normalizeMeter),
      meta: {
        page: Number(page) || 1,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  // 2. Get single meter details (composite of info + GPS + latest reading)
  async getMeterById(meterId) {
    if (!meterId) {
      const err = new Error('meterId is required');
      err.statusCode = 400;
      throw err;
    }

    const [searchRes, geoRes, energyRes] = await Promise.allSettled([
      this.client.searchMeters({ q: meterId, page: 1 }),
      this.client.getMeterGeo(meterId),
      this.client.getMeterEnergy(meterId),
    ]);

    const meters = searchRes.status === 'fulfilled' ? searchRes.value?.data || [] : [];
    const basicInfo = meters.find((m) => m.meterId === meterId) || meters[0] || null;
    const geo = geoRes.status === 'fulfilled' ? geoRes.value : null;
    const energy = energyRes.status === 'fulfilled' ? energyRes.value : null;

    if (!basicInfo && !geo && !energy) {
      const err = new Error(`Meter '${meterId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const readings = energy?.data || energy || [];
    const latestReading = readings.length > 0 ? normalizeReading(readings[0]) : null;

    return {
      data: {
        ...(basicInfo ? normalizeMeter(basicInfo) : { meterId }),
        geo: normalizeGeo(geo),
        latestReading,
      },
    };
  }

  // 3. Get consumption history for a meter
  async getMeterConsumption(meterId) {
    if (!meterId) {
      const err = new Error('meterId is required');
      err.statusCode = 400;
      throw err;
    }

    const raw = await this.client.getMeterEnergy(meterId);
    const readings = raw?.data || raw || [];
    const normalized = normalizeConsumptionList(readings);

    return {
      data: normalized,
      meta: {
        meterId,
        count: normalized.length,
        unit: 'kWh',
      },
    };
  }

  // 4. Get network hierarchy (zone, feeder, DT) and coordinates for a meter
  async getMeterNetwork(meterId) {
    if (!meterId) {
      const err = new Error('meterId is required');
      err.statusCode = 400;
      throw err;
    }

    let hierarchy = null;
    let coordinates = null;
    let dtCode = null;

    try {
      const expRes = await this.client.getExport({ page: 1 });
      const items = expRes?.data || expRes || [];
      const match = items.find((m) => m.meterId === meterId);
      if (match) {
        hierarchy = match.hierarchy || null;
        coordinates = normalizeGeo(match.geo);
        dtCode = match.dtCode || null;
      }
    } catch {
      // export unavailable, fallback below
    }

    if (!hierarchy) {
      const detail = await this.getMeterById(meterId);
      dtCode = detail.data.distributionTransformerCode;
      coordinates = detail.data.geo;
      hierarchy = { dt: { code: dtCode || null } };
    }

    return {
      data: {
        meterId,
        distributionTransformerCode: dtCode,
        hierarchy,
        coordinates,
      },
    };
  }

  // 5. List distribution transformers
  async getTransformers({ page = 1 } = {}) {
    const raw = await this.client.getTransformers({ page });
    const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
    const total = raw.total ?? list.length;
    const pageSize = raw.pageSize || 20;
    return {
      data: list,
      meta: {
        page: Number(page) || 1,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  // 6. Get signed export data
  async getExport({ page = 1 } = {}) {
    const raw = await this.client.getExport({ page });
    const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
    const total = raw.total ?? 403;
    const pageSize = raw.pageSize || list.length;
    return {
      data: list.map(normalizeExportRecord),
      meta: {
        page: Number(page) || 1,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        signatureMethod: 'HMAC-SHA256',
      },
    };
  }
}

const meterService = new MeterService();

module.exports = {
  MeterService,
  meterService,
};
