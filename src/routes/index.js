const meterRoutes = require('./meterRoutes');

async function registerRoutes(fastify) {
  await fastify.register(meterRoutes);
}

module.exports = registerRoutes;
