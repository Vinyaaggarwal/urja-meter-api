const { meterService } = require('../services/meterService');

/**
 * Controller handling HTTP requests and passing responses
 */
class MeterController {
  constructor(service = meterService) {
    this.service = service;
  }

  // GET /health
  async getHealth(request, reply) {
    const portal = process.env.PORTAL_URL || process.env.URJA_BASE_URL || 'https://urja-ops.flockenergy.tech';
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      portal,
    });
  }

  // GET /api/meters
  async searchMeters(request, reply) {
    const q = request.query.q || '';
    const page = parseInt(request.query.page || '1', 10);
    const result = await this.service.searchMeters({ q, page });
    return reply.status(200).send(result);
  }

  // GET /api/meters/:id
  async getMeterById(request, reply) {
    const meterId = request.params.meterId || request.params.id;
    const result = await this.service.getMeterById(meterId);
    return reply.status(200).send(result);
  }

  // GET /api/meters/:id/consumption
  async getMeterConsumption(request, reply) {
    const meterId = request.params.meterId || request.params.id;
    const result = await this.service.getMeterConsumption(meterId);
    return reply.status(200).send(result);
  }

  // GET /api/meters/:id/network
  async getMeterNetwork(request, reply) {
    const meterId = request.params.meterId || request.params.id;
    const result = await this.service.getMeterNetwork(meterId);
    return reply.status(200).send(result);
  }

  // GET /api/transformers
  async getTransformers(request, reply) {
    const page = parseInt(request.query.page || '1', 10);
    const result = await this.service.getTransformers({ page });
    return reply.status(200).send(result);
  }

  // GET /api/export
  async getExport(request, reply) {
    const page = parseInt(request.query.page || '1', 10);
    const result = await this.service.getExport({ page });
    return reply.status(200).send(result);
  }
}

const meterController = new MeterController();

module.exports = {
  MeterController,
  meterController,
};
