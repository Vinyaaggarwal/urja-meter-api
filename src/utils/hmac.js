const crypto = require('crypto');

/**
 * Creates HMAC-SHA256 signature for signed portal export
 * Message format: METHOD\nPATH\nQUERY_STRING\nTIMESTAMP
 *
 * @param {string} method HTTP method in uppercase (e.g. GET)
 * @param {string} path Endpoint path (e.g. /portal/export)
 * @param {string} queryString Query string (e.g. page=1)
 * @param {string} secret Secret signing key
 * @returns {{ timestamp: string, signature: string }}
 */
function createHmacSignature(method, path, queryString, secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const normalizedMethod = (method || 'GET').toUpperCase();
  const message = [normalizedMethod, path, queryString || '', timestamp].join('\n');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return { timestamp, signature };
}

module.exports = {
  createHmacSignature,
};

