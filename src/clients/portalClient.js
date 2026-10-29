const { createHmacSignature } = require('../utils/hmac');

class PortalClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl]
   * @param {string} [options.email]
   * @param {string} [options.password]
   * @param {number} [options.timeoutMs]
   */
  constructor(options = {}) {
    this.baseUrl = (
      options.baseUrl ||
      process.env.PORTAL_URL ||
      process.env.URJA_BASE_URL ||
      'https://urja-ops.flockenergy.tech'
    ).replace(/\/+$/, '');

    this.email =
      options.email ||
      process.env.PORTAL_USERNAME ||
      process.env.URJA_EMAIL ||
      'operator@urja.local';

    this.password =
      options.password ||
      process.env.PORTAL_PASSWORD ||
      process.env.URJA_PASSWORD;

    this.timeoutMs = options.timeoutMs || parseInt(process.env.PORTAL_TIMEOUT_MS || '10000', 10);
    this.cookies = new Map();
    this.signingSecret = null;
    this.signingSecretExpiry = 0;
  }

  /**
   * Serializes current cookies into a Header string
   * @returns {string}
   */
  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, val]) => `${name}=${val}`)
      .join('; ');
  }

  /**
   * Parses and stores set-cookie headers
   * @param {Headers|Array|string} setCookieHeader
   */
  storeCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    const cookiesArray = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];

    for (const cookieStr of cookiesArray) {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        this.cookies.set(name, value);
      }
    }
  }

  /**
   * Authenticates against SvelteKit form action on the portal
   * @returns {Promise<boolean>}
   */
  async login() {
    const loginUrl = `${this.baseUrl}/login`;
    const formBody = new URLSearchParams({
      email: this.email,
      password: this.password,
    }).toString();

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': this.baseUrl,
      'Referer': `${this.baseUrl}/login`,
      'x-sveltekit-action': 'true',
    };

    if (this.cookies.size > 0) {
      headers['Cookie'] = this.getCookieHeader();
    }

    let response;
    try {
      response = await fetch(loginUrl, {
        method: 'POST',
        headers,
        body: formBody,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        const timeoutErr = new Error('Portal login timed out');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      const netErr = new Error(`Cannot reach portal: ${err.message}`);
      netErr.statusCode = 502;
      throw netErr;
    }

    // Capture set-cookie headers
    if (typeof response.headers.getSetCookie === 'function') {
      const setCookies = response.headers.getSetCookie();
      for (const sc of setCookies) {
        this.storeCookies(sc);
      }
    } else {
      const rawCookie = response.headers.get('set-cookie');
      if (rawCookie) {
        this.storeCookies(rawCookie);
      }
    }

    const hasSessionToken = Array.from(this.cookies.keys()).some((k) =>
      k.includes('better-auth.session_token') || k.includes('session')
    );

    if (
      response.status >= 400 ||
      (!hasSessionToken && response.status !== 303 && response.status !== 200)
    ) {
      const authErr = new Error('Failed to authenticate with upstream portal. Check credentials.');
      authErr.statusCode = 502;
      throw authErr;
    }

    return true;
  }

  /**
   * Executes an authenticated HTTP request with auto-login and session retry
   * @param {string} endpointPath
   * @param {RequestInit} [options={}]
   * @param {boolean} [retry=true]
   * @returns {Promise<Response>}
   */
  async request(endpointPath, options = {}, retry = true) {
    if (this.cookies.size === 0) {
      await this.login();
    }

    const url = endpointPath.startsWith('http')
      ? endpointPath
      : `${this.baseUrl}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;

    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {}),
      'Cookie': this.getCookieHeader(),
      'Origin': this.baseUrl,
      'Referer': this.baseUrl,
    };

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        const timeoutErr = new Error(`Upstream request to ${endpointPath} timed out`);
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      const netErr = new Error(`Upstream network failure: ${err.message}`);
      netErr.statusCode = 502;
      throw netErr;
    }

    // If redirected to login or unauthorized, refresh session and retry once
    const location = response.headers.get('location') || '';
    if (
      (response.status === 401 ||
        (response.status >= 300 && response.status < 400 && location.includes('/login'))) &&
      retry
    ) {
      this.cookies.clear();
      await this.login();
      return this.request(endpointPath, options, false);
    }

    // Capture any updated cookies
    if (typeof response.headers.getSetCookie === 'function') {
      for (const sc of response.headers.getSetCookie()) {
        this.storeCookies(sc);
      }
    } else {
      const rawCookie = response.headers.get('set-cookie');
      if (rawCookie) {
        this.storeCookies(rawCookie);
      }
    }

    return response;
  }

  /**
   * Helper to perform authenticated request and parse JSON payload
   * @param {string} endpointPath
   * @param {RequestInit} [options={}]
   */
  async requestJson(endpointPath, options = {}) {
    const response = await this.request(endpointPath, options);

    if (!response.ok) {
      const text = await response.text();
      let errorData = {};
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { message: text || response.statusText };
      }

      if (response.status === 404) {
        const notFoundErr = new Error(errorData.message || 'Resource not found');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const upstreamErr = new Error(
        errorData.message || `Upstream request failed with HTTP ${response.status}`
      );
      upstreamErr.statusCode = response.status >= 500 ? 502 : response.status;
      upstreamErr.upstreamStatus = response.status;
      throw upstreamErr;
    }

    return response.json();
  }

  /**
   * Fetch signing secret for export requests
   * @returns {Promise<string>}
   */
  async getSigningSecret() {
    const now = Date.now();
    if (this.signingSecret && this.signingSecretExpiry > now) {
      return this.signingSecret;
    }

    const res = await this.requestJson('/portal/keys');
    const secret = res?.data?.signingSecret || res?.signingSecret;
    if (!secret) {
      const err = new Error('Signing secret not returned by portal /keys');
      err.statusCode = 502;
      throw err;
    }

    this.signingSecret = secret;
    this.signingSecretExpiry = now + 10 * 60 * 1000; // cache for 10 minutes
    return this.signingSecret;
  }

  /**
   * Get distribution transformers list
   * @param {Object} [params]
   * @param {number} [params.page=1]
   */
  async getTransformers({ page = 1 } = {}) {
    return this.requestJson(`/portal/dts?page=${encodeURIComponent(page)}`);
  }

  /**
   * Search and list smart meters
   * @param {Object} [params]
   * @param {string} [params.q='']
   * @param {number} [params.page=1]
   */
  async searchMeters({ q = '', page = 1 } = {}) {
    const query = new URLSearchParams({
      q: q || '',
      page: String(page || 1),
    }).toString();
    return this.requestJson(`/portal/meters/search?${query}`);
  }

  /**
   * Get GPS coordinates for a specific meter
   * @param {string} meterId
   */
  async getMeterGeo(meterId) {
    return this.requestJson(`/portal/meters/${encodeURIComponent(meterId)}/geo`);
  }

  /**
   * Get energy telemetry readings for a specific meter
   * @param {string} meterId
   */
  async getMeterEnergy(meterId) {
    return this.requestJson(`/portal/meters/${encodeURIComponent(meterId)}/energy`);
  }

  /**
   * Get HMAC-signed export data
   * @param {Object} [params]
   * @param {number} [params.page=1]
   */
  async getExport({ page = 1 } = {}) {
    const path = '/portal/export';
    const queryString = `page=${page}`;
    const secret = await this.getSigningSecret();
    const { timestamp, signature } = createHmacSignature('GET', path, queryString, secret);

    const headers = {
      'x-timestamp': timestamp,
      'x-signature': signature,
    };

    return this.requestJson(`${path}?${queryString}`, { headers });
  }
}

// Export singleton and class
const portalClient = new PortalClient();

module.exports = {
  PortalClient,
  portalClient,
};

