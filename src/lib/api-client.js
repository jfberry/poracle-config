export class PoracleApiClient {
  constructor(baseUrl, secret) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.secret = secret;
    // When using the Vite proxy, requests go through /poracle-api/ on the same origin
    this.useProxy = false;
  }

  get effectiveBase() {
    return this.useProxy ? '/poracle-api' : this.baseUrl;
  }

  async fetch(path, options = {}) {
    const res = await fetch(`${this.effectiveBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Poracle-Secret': this.secret,
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getTemplates(filters = {}) {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.platform) params.set('platform', filters.platform);
    if (filters.language) params.set('language', filters.language);
    const query = params.toString();
    return this.fetch(`/api/dts/templates${query ? '?' + query : ''}`);
  }

  async saveTemplates(entries) {
    return this.fetch('/api/dts/templates', { method: 'POST', body: JSON.stringify(entries) });
  }

  async enrichWebhook(type, webhook, language = 'en') {
    return this.fetch('/api/dts/enrich', {
      method: 'POST',
      body: JSON.stringify({ type, webhook, language }),
    });
  }

  async getFields(type) {
    return this.fetch(`/api/dts/fields/${type}`);
  }

  async health() {
    // First try direct (works if PoracleNG has CORS enabled)
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (res.ok) {
        this.useProxy = false;
        return res.json();
      }
    } catch {
      // CORS blocked or network error — try the Vite proxy
    }

    // Try via Vite dev proxy (avoids CORS entirely)
    try {
      const res = await fetch('/poracle-api/health');
      if (res.ok) {
        this.useProxy = true;
        return res.json();
      }
    } catch {
      // Proxy not configured or server not reachable
    }

    throw new Error(
      `Cannot connect to ${this.baseUrl}. ` +
      `If PoracleNG lacks CORS headers, the Vite proxy can help — ` +
      `set PORACLE_URL=${this.baseUrl} and restart the dev server.`
    );
  }
}
