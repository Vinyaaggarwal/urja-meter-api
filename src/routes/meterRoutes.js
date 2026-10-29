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
  fastify.get('/api/health', { schema: healthSchema }, (req, res) => meterController.getHealth(req, res));

  // Meters search & list
  fastify.get('/api/meters', { schema: metersSearchSchema }, (req, res) => meterController.searchMeters(req, res));
  fastify.get('/meters', { schema: metersSearchSchema }, (req, res) => meterController.searchMeters(req, res));

  // Meter composite detail
  fastify.get('/api/meters/:meterId', { schema: meterDetailSchema }, (req, res) => meterController.getMeterById(req, res));
  fastify.get('/meters/:meterId', { schema: meterDetailSchema }, (req, res) => meterController.getMeterById(req, res));

  // Meter consumption
  fastify.get('/api/meters/:meterId/consumption', { schema: meterConsumptionSchema }, (req, res) => meterController.getMeterConsumption(req, res));
  fastify.get('/meters/:meterId/consumption', { schema: meterConsumptionSchema }, (req, res) => meterController.getMeterConsumption(req, res));
  fastify.get('/meters/:meterId/energy', { schema: meterConsumptionSchema }, (req, res) => meterController.getMeterConsumption(req, res));

  // Meter network hierarchy & coordinates
  fastify.get('/api/meters/:meterId/network', { schema: meterNetworkSchema }, (req, res) => meterController.getMeterNetwork(req, res));
  fastify.get('/meters/:meterId/network', { schema: meterNetworkSchema }, (req, res) => meterController.getMeterNetwork(req, res));
  fastify.get('/meters/:meterId/geo', { schema: meterNetworkSchema }, (req, res) => meterController.getMeterNetwork(req, res));

  // Transformers
  fastify.get('/api/transformers', { schema: transformersSchema }, (req, res) => meterController.getTransformers(req, res));
  fastify.get('/transformers', { schema: transformersSchema }, (req, res) => meterController.getTransformers(req, res));

  // Signed Export
  fastify.get('/api/export', { schema: exportSchema }, (req, res) => meterController.getExport(req, res));
  fastify.get('/export', { schema: exportSchema }, (req, res) => meterController.getExport(req, res));
}

module.exports = meterRoutes;
