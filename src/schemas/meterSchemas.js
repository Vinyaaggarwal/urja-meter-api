/**
 * OpenAPI / Fastify JSON Schemas for Meter and Operations Endpoints
 */

const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'string', example: 'Resource not found' },
    statusCode: { type: 'integer', example: 404 },
  },
};

const healthSchema = {
  tags: ['System'],
  summary: 'Service health check',
  description: 'Returns API health status, local timestamp, and upstream portal target',
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2026-10-28T16:15:00.000Z' },
        portal: { type: 'string', example: 'https://urja-ops.flockenergy.tech' },
      },
    },
  },
};

const metersSearchSchema = {
  tags: ['Meters'],
  summary: 'Search and paginate smart meters',
  description: 'Search meters by meter ID, serial number, make, or DT code with pagination',
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string', description: 'Search term filter' },
      page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              meterId: { type: 'string' },
              serialNumber: { type: 'string' },
              manufacturer: { type: 'string' },
              phaseType: { type: 'string' },
              installationStatus: { type: 'string' },
              distributionTransformerCode: { type: 'string' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    400: errorResponseSchema,
    502: errorResponseSchema,
  },
};

const meterDetailSchema = {
  tags: ['Meters'],
  summary: 'Retrieve meter details',
  description: 'Retrieves comprehensive meter profile with geolocation and latest telemetry reading',
  params: {
    type: 'object',
    required: ['meterId'],
    properties: {
      meterId: { type: 'string', description: 'Unique meter identifier (e.g. J100000)' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            meterId: { type: 'string' },
            serialNumber: { type: 'string' },
            manufacturer: { type: 'string' },
            phaseType: { type: 'string' },
            installationStatus: { type: 'string' },
            distributionTransformerCode: { type: 'string' },
            geo: {
              type: 'object',
              nullable: true,
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
              },
            },
            latestReading: {
              type: 'object',
              nullable: true,
              properties: {
                timestamp: { type: 'string' },
                rawTimestamp: { type: 'string' },
                activeEnergyKwh: { type: 'number' },
                apparentEnergyKvah: { type: 'number' },
                voltageR: { type: 'number' },
              },
            },
          },
        },
      },
    },
    404: errorResponseSchema,
    502: errorResponseSchema,
  },
};

const meterConsumptionSchema = {
  tags: ['Meters'],
  summary: 'Retrieve meter consumption history',
  description: 'Retrieves historical interval telemetry energy readings (kWh, kVAh, voltage)',
  params: {
    type: 'object',
    required: ['meterId'],
    properties: {
      meterId: { type: 'string', description: 'Unique meter identifier' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              rawTimestamp: { type: 'string' },
              activeEnergyKwh: { type: 'number' },
              apparentEnergyKvah: { type: 'number' },
              voltageR: { type: 'number' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            meterId: { type: 'string' },
            count: { type: 'integer' },
            unit: { type: 'string', example: 'kWh' },
          },
        },
      },
    },
    404: errorResponseSchema,
    502: errorResponseSchema,
  },
};

const meterNetworkSchema = {
  tags: ['Meters'],
  summary: 'Retrieve meter network location and hierarchy',
  description: 'Retrieves network hierarchy (Zone, Circle, Feeder, Distribution Transformer) and coordinates',
  params: {
    type: 'object',
    required: ['meterId'],
    properties: {
      meterId: { type: 'string', description: 'Unique meter identifier' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            meterId: { type: 'string' },
            distributionTransformerCode: { type: 'string' },
            hierarchy: { type: 'object', additionalProperties: true },
            coordinates: {
              type: 'object',
              nullable: true,
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
              },
            },
          },
        },
      },
    },
    404: errorResponseSchema,
    502: errorResponseSchema,
  },
};

const transformersSchema = {
  tags: ['Transformers'],
  summary: 'List Distribution Transformers (DTs)',
  description: 'Lists distribution transformers with feeder association and capacity',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              name: { type: 'string' },
              feederCode: { type: 'string' },
              capacityKva: { type: 'number' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            count: { type: 'integer' },
          },
        },
      },
    },
    502: errorResponseSchema,
  },
};

const exportSchema = {
  tags: ['Export'],
  summary: 'Get signed export data',
  description: 'Retrieves HMAC-SHA256 authenticated export containing meters, hierarchy, and coordinates',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array' },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            count: { type: 'integer' },
            authenticated: { type: 'boolean' },
            signatureMethod: { type: 'string' },
          },
        },
      },
    },
    502: errorResponseSchema,
  },
};

module.exports = {
  errorResponseSchema,
  healthSchema,
  metersSearchSchema,
  meterDetailSchema,
  meterConsumptionSchema,
  meterNetworkSchema,
  transformersSchema,
  exportSchema,
};

