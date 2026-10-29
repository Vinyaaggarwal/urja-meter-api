require('dotenv').config();
const { buildApp } = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const app = await buildApp({
      logger: process.env.NODE_ENV !== 'test',
    });

    await app.listen({ port: PORT, host: HOST });
    console.log(`Urja Meter Operations API server listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`Interactive Swagger UI documentation: http://localhost:${PORT}/docs`);
    console.log(`OpenAPI specification available at http://localhost:${PORT}/docs/json`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = {
  start,
};

