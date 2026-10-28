const crypto = require('crypto');

class UrjaClient {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl
   * @param {string} options.email
   * @param {string} options.password
   */
  constructor({ baseUrl, email, password }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.email = email;
    this.password = password;
    this.cookies = new Map();
    this.signingSecret = null;
    this.signingSecretExpiry = 0;
  }

  /**
   * Returns formatted Cookie string for requests
   */
  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, val]) => `${name}=${val}`)
      .join('; ');
  }

  /**
   * Parses set-cookie headers and saves to internal cookie store
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
   * Logs into Urja Ops portal using SvelteKit form action
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

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers,
      body: formBody,
      redirect: 'manual',
    });

    // Capture set-cookie headers
    // Node fetch might provide getSetCookie() or get('set-cookie')
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

    const hasSessionToken = Array.from(this.cookies.keys()).some(k =>
      k.includes('better-auth.session_token') || k.includes('session')
    );

    if (response.status >= 400 || (!hasSessionToken && response.status !== 303 && response.status !== 200)) {
      const text = await response.text();
      throw new Error(`Login failed (HTTP ${response.status}): ${text.substring(0, 300)}`);
    }

    return true;
  }

  /**
   * Authenticated request with automatic login and retry on 401
   * @param {string} endpointPath
   * @param {RequestInit} [options={}]
   * @param {boolean} [retry=true]
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

    const response = await fetch(url, {
      ...options,
      headers,
      redirect: 'manual',
    });

    // Handle redirects to login or 401 unauthorized
    const location = response.headers.get('location') || '';
    if (
      (response.status === 401 ||
        (response.status >= 300 && response.status < 400 && location.includes('/login'))) &&
      retry
    ) {
      // Clear cookies and re-authenticate
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
   * Helper to perform authenticated request and parse JSON response
   */
  async requestJson(endpointPath, options = {}) {
    const response = await this.request(endpointPath, options);
    if (!response.ok) {
      const text = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { message: text || response.statusText };
      }
      const err = new Error(errorData.message || `Request to ${endpointPath} failed with HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }

    return response.json();
  }

  /**
   * Fetch signing secret for export requests
   * @returns {Promise<string>}
   */
  async getSigningSecret() {
    const now = Date.now();
    // Cache for 10 minutes
    if (this.signingSecret && this.signingSecretExpiry > now) {
      return this.signingSecret;
    }

    const res = await this.requestJson('/portal/keys');
    const secret = res?.data?.signingSecret || res?.signingSecret;
    if (!secret) {
      throw new Error(`Signing secret not returned by /portal/keys: ${JSON.stringify(res)}`);
    }

    this.signingSecret = secret;
    this.signingSecretExpiry = now + 10 * 60 * 1000;
    return this.signingSecret;
  }

  /**
   * Generate HMAC signature for an endpoint
   * Format: METHOD\nPATH\nQUERY_STRING\nTIMESTAMP
   */
  createHmacSignature(method, path, queryString, secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = [method.toUpperCase(), path, queryString, timestamp].join('\n');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    return { timestamp, signature };
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
   * Search / list meters
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
   * Get meter geo location
   * @param {string} meterId
   */
  async getMeterGeo(meterId) {
    return this.requestJson(`/portal/meters/${encodeURIComponent(meterId)}/geo`);
  }

  /**
   * Get meter energy readings
   * @param {string} meterId
   */
  async getMeterEnergy(meterId) {
    return this.requestJson(`/portal/meters/${encodeURIComponent(meterId)}/energy`);
  }

  /**
   * Get signed export data
   * @param {Object} [params]
   * @param {number} [params.page=1]
   */
  async getExport({ page = 1 } = {}) {
    const path = '/portal/export';
    const queryString = `page=${page}`;
    const secret = await this.getSigningSecret();
    const { timestamp, signature } = this.createHmacSignature('GET', path, queryString, secret);

    const headers = {
      'x-timestamp': timestamp,
      'x-signature': signature,
    };

    return this.requestJson(`${path}?${queryString}`, { headers });
  }

  /**
   * Get comprehensive meter detail (composite from search, geo, energy, and hierarchy)
   * @param {string} meterId
   */
  async getMeterComposite(meterId) {
    const [searchRes, geoRes, energyRes] = await Promise.allSettled([
      this.searchMeters({ q: meterId, page: 1 }),
      this.getMeterGeo(meterId),
      this.getMeterEnergy(meterId),
    ]);

    let basicInfo = null;
    if (searchRes.status === 'fulfilled' && searchRes.value && Array.isArray(searchRes.value.data)) {
      basicInfo = searchRes.value.data.find(m => m.meterId === meterId) || searchRes.value.data[0];
    }

    const geo = geoRes.status === 'fulfilled' ? geoRes.value : null;
    const energy = energyRes.status === 'fulfilled' ? energyRes.value : null;

    if (!basicInfo && !geo && !energy) {
      const err = new Error(`Meter ${meterId} not found`);
      err.status = 404;
      throw err;
    }

    return {
      meterId,
      ...(basicInfo || {}),
      geo: geo?.data || geo || null,
      energy: energy?.data || energy || null,
    };
  }
}

module.exports = { UrjaClient };
