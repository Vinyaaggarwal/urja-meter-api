/**
 * Global Error Handler Middleware
 */
function errorHandler(error, request, reply) {
  // Safe logging without credentials
  request.log.error({
    msg: error.message,
    statusCode: error.statusCode,
    url: request.url,
    method: request.method,
  });

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: `Validation error: ${error.message}`,
      statusCode: 400,
    });
  }

  const statusCode = error.statusCode || error.status || 500;

  let clientMessage = error.message;

  // Sanitize message to never leak secrets
  if (clientMessage) {
    clientMessage = clientMessage.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g, '[REDACTED_EMAIL]');
    clientMessage = clientMessage.replace(/session_token=[^;]+/gi, 'session_token=[REDACTED]');
  }

  // Prevent internal 500 stack leak
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    clientMessage = 'Internal Server Error';
  }

  return reply.status(statusCode).send({
    success: false,
    error: clientMessage || 'An unexpected error occurred',
    statusCode,
  });
}

module.exports = {
  errorHandler,
};

