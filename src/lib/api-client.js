export class PoracleApiClient {
  constructor(baseUrl, secret) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.secret = secret;
  }

  async fetch(path, options = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
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
    return this.fetch('/health');
  }
}
