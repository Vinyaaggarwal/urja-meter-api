const Fastify = require('fastify');
const cors = require('@fastify/cors');
const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');
const { errorHandler } = require('./middleware/errorHandler');
const registerRoutes = require('./routes');

async function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger !== undefined ? opts.logger : false,
  });

  // Enable Cross-Origin Resource Sharing (CORS) for local frontend UI
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  const port = process.env.PORT || '3000';

  // Register OpenAPI / Swagger
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Urja Meter Operations API',
        description:
          'RESTful API service wrapping the Urja Meter Operations portal. Provides authenticated proxy endpoints for Distribution Transformers, Smart Meters, Geospatial positions, Interval Consumption telemetry, Network Hierarchy, and HMAC-signed Data Exports.',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${port}`,
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'System', description: 'System health and status' },
        { name: 'Meters', description: 'Smart meter search, details, consumption and network location' },
        { name: 'Transformers', description: 'Distribution Transformer (DT) queries' },
        { name: 'Export', description: 'HMAC-signed data exports' },
      ],
    },
  });

  // Register Swagger UI at /docs
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Register All Routes
  await registerRoutes(app);

  return app;
}

module.exports = {
  buildApp,
};

