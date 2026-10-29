const { meterController } = require('../controllers/meterController');
const {
  healthSchema,
  metersSearchSchema,
  meterDetailSchema,
  meterConsumptionSchema,
  meterNetworkSchema,
  transformersSchema,
  exportSchema,
} = require('../schemas/meterSchemas');

async function meterRoutes(fastify) {
  // Health
  fastify.get('/health', { schema: healthSchema }, (req, res) => meterController.getHealth(req, res));

  // Meters
  fastify.get('/api/meters', { schema: metersSearchSchema }, (req, res) => meterController.searchMeters(req, res));
  fastify.get('/api/meters/:meterId', { schema: meterDetailSchema }, (req, res) => meterController.getMeterById(req, res));
  fastify.get('/api/meters/:meterId/consumption', { schema: meterConsumptionSchema }, (req, res) => meterController.getMeterConsumption(req, res));
  fastify.get('/api/meters/:meterId/network', { schema: meterNetworkSchema }, (req, res) => meterController.getMeterNetwork(req, res));

  // Transformers
  fastify.get('/api/transformers', { schema: transformersSchema }, (req, res) => meterController.getTransformers(req, res));

  // Export
  fastify.get('/api/export', { schema: exportSchema }, (req, res) => meterController.getExport(req, res));
}

module.exports = meterRoutes;
