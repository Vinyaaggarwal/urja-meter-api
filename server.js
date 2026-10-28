require('dotenv').config();
const Fastify = require('fastify');
const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');
const { UrjaClient } = require('./lib/urjaClient');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const urjaClient = new UrjaClient({
  baseUrl: process.env.URJA_BASE_URL || 'https://urja-ops.flockenergy.tech',
  email: process.env.URJA_EMAIL || 'operator@urja.local',
  password: process.env.URJA_PASSWORD || '<password>',
});

async function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger !== undefined ? opts.logger : true,
  });

  // Fallback to simple logging if pino-pretty isn't available
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    const statusCode = error.status || error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: error.message || 'Internal Server Error',
      statusCode,
      details: error.data || undefined,
    });
  });

  // Register OpenAPI / Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Urja Meter Operations API',
        description:
          'RESTful API service wrapping Urja Meter Operations portal. Provides authenticated proxy endpoints for Distribution Transformers, Meters, Geospatial positions, Energy telemetry, and HMAC-signed Data Exports.',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'System', description: 'System health and status' },
        { name: 'Transformers', description: 'Distribution Transformer (DT) queries' },
        { name: 'Meters', description: 'Smart meter search, telemetry and geo data' },
        { name: 'Export', description: 'HMAC-signed data exports' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Health check
  const healthSchema = {
    tags: ['System'],
    summary: 'Service health check',
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          portal: { type: 'string' },
        },
      },
    },
  };

  app.get('/health', { schema: healthSchema }, async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      portal: process.env.URJA_BASE_URL || 'https://urja-ops.flockenergy.tech',
    };
  });

  // Distribution Transformers
  const transformersSchema = {
    tags: ['Transformers'],
    summary: 'List Distribution Transformers (DTs)',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
      },
    },
  };

  const getTransformersHandler = async (request) => {
    const page = parseInt(request.query.page || '1', 10);
    const result = await urjaClient.getTransformers({ page });
    return result;
  };

  app.get('/transformers', { schema: transformersSchema }, getTransformersHandler);
  app.get('/api/v1/transformers', { schema: transformersSchema }, getTransformersHandler);

  // Meter Search & Listing
  const metersSearchSchema = {
    tags: ['Meters'],
    summary: 'Search and paginate smart meters',
    querystring: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search term (meter ID, serial, make, dtCode)' },
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
      },
    },
  };

  const getMetersHandler = async (request) => {
    const q = request.query.q || '';
    const page = parseInt(request.query.page || '1', 10);
    const result = await urjaClient.searchMeters({ q, page });
    return result;
  };

  app.get('/meters', { schema: metersSearchSchema }, getMetersHandler);
  app.get('/api/v1/meters', { schema: metersSearchSchema }, getMetersHandler);

  // Meter Detail (Composite)
  const meterDetailSchema = {
    tags: ['Meters'],
    summary: 'Get composite smart meter details with geo coordinates and energy readings',
    params: {
      type: 'object',
      required: ['meterId'],
      properties: {
        meterId: { type: 'string', description: 'Meter ID (e.g. J100000)' },
      },
    },
  };

  const getMeterDetailHandler = async (request) => {
    const { meterId } = request.params;
    const result = await urjaClient.getMeterComposite(meterId);
    return result;
  };

  app.get('/meters/:meterId', { schema: meterDetailSchema }, getMeterDetailHandler);
  app.get('/api/v1/meters/:meterId', { schema: meterDetailSchema }, getMeterDetailHandler);

  // Meter Geo Location
  const meterGeoSchema = {
    tags: ['Meters'],
    summary: 'Get GPS coordinates for a specific smart meter',
    params: {
      type: 'object',
      required: ['meterId'],
      properties: {
        meterId: { type: 'string', description: 'Meter ID' },
      },
    },
  };

  const getMeterGeoHandler = async (request) => {
    const { meterId } = request.params;
    const result = await urjaClient.getMeterGeo(meterId);
    return result;
  };

  app.get('/meters/:meterId/geo', { schema: meterGeoSchema }, getMeterGeoHandler);
  app.get('/api/v1/meters/:meterId/geo', { schema: meterGeoSchema }, getMeterGeoHandler);

  // Meter Energy Readings
  const meterEnergySchema = {
    tags: ['Meters'],
    summary: 'Get telemetry energy readings (kWh, kVAh, voltage) for a specific smart meter',
    params: {
      type: 'object',
      required: ['meterId'],
      properties: {
        meterId: { type: 'string', description: 'Meter ID' },
      },
    },
  };

  const getMeterEnergyHandler = async (request) => {
    const { meterId } = request.params;
    const result = await urjaClient.getMeterEnergy(meterId);
    return result;
  };

  app.get('/meters/:meterId/energy', { schema: meterEnergySchema }, getMeterEnergyHandler);
  app.get('/api/v1/meters/:meterId/energy', { schema: meterEnergySchema }, getMeterEnergyHandler);

  // Signed Export
  const exportSchema = {
    tags: ['Export'],
    summary: 'Get signed export data with HMAC-SHA256 authenticated headers',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
      },
    },
  };

  const getExportHandler = async (request) => {
    const page = parseInt(request.query.page || '1', 10);
    const result = await urjaClient.getExport({ page });
    return result;
  };

  app.get('/export', { schema: exportSchema }, getExportHandler);
  app.get('/api/v1/export', { schema: exportSchema }, getExportHandler);

  return app;
}

if (require.main === module) {
  buildApp()
    .then(async (app) => {
      await app.listen({ port: PORT, host: HOST });
      console.log(`Urja API Server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
      console.log(`Swagger UI Documentation available at http://localhost:${PORT}/docs`);
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

module.exports = { buildApp, urjaClient };
