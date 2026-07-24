export class PoracleApiClient {
  constructor(baseUrl, secret) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.secret = secret;
    // When using the Vite proxy, requests go through /poracle-api/ on the same origin
    this.useProxy = false;
    // Set by loadDtsTypes() on connect. false = old poracle → fallback path.
    this.supportsDerivedTypes = false;
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

  async saveTemplateFile(type, platform, id, language, content) {
    const params = new URLSearchParams({ type, platform, id: id || '', language: language || '' });
    return this.fetch(`/api/dts/templates/file?${params}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
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

  async getTestdata({ type, dtsType } = {}) {
    const params = new URLSearchParams();
    if (dtsType) params.set('dtsType', dtsType);
    else if (type) params.set('type', type);
    const query = params.toString();
    return this.fetch(`/api/dts/testdata${query ? '?' + query : ''}`);
  }

  // Determine derived-DTS-types support and store it on `supportsDerivedTypes`.
  // Prefers the explicit /health `capabilities.derivedDtsTypes` flag; for builds
  // whose /health predates the flag, falls back to sniffing the testdata response
  // shape (presence of the `types` map). Never throws. Returns the boolean.
  async loadDtsTypes(capabilities) {
    if (capabilities && 'derivedDtsTypes' in capabilities) {
      this.supportsDerivedTypes = capabilities.derivedDtsTypes === true;
      return this.supportsDerivedTypes;
    }
    try {
      const res = await this.getTestdata();
      this.supportsDerivedTypes = !!res.types;
    } catch {
      this.supportsDerivedTypes = false;
    }
    return this.supportsDerivedTypes;
  }

  async getPartials() {
    return this.fetch('/api/dts/partials');
  }

  async getEmoji(platform) {
    const params = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    return this.fetch(`/api/dts/emoji${params}`);
  }

  async getActions() {
    return this.fetch('/api/dts/actions');
  }

  async getConfigSchema() {
    return this.fetch('/api/config/schema');
  }

  async getConfigValues(section) {
    const params = section ? `?section=${encodeURIComponent(section)}` : '';
    return this.fetch(`/api/config/values${params}`);
  }

  async saveConfigValues(updates) {
    return this.fetch('/api/config/values', {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  async validateConfig(updates) {
    return this.fetch('/api/config/validate', {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  async getGeofenceAll() {
    return this.fetch('/api/geofence/all');
  }

  async resolve(request) {
    return this.fetch('/api/resolve', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async sendTest(template, variables, targetId, { targetType = 'discord:user', language = 'en', platform = 'discord' } = {}) {
    return this.fetch('/api/dts/sendtest', {
      method: 'POST',
      body: JSON.stringify({
        template,
        variables,
        target: { id: targetId, type: targetType },
        language,
        platform,
      }),
    });
  }

  async getAutocreateTemplates() {
    return this.fetch('/api/autocreate/templates');
  }

  async saveAutocreateTemplates(templates) {
    return this.fetch('/api/autocreate/templates', {
      method: 'POST',
      body: JSON.stringify({ templates }),
    });
  }

  async deleteAutocreateTemplate(name) {
    return this.fetch(`/api/autocreate/templates/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  async validateAutocreateTemplates(templates) {
    return this.fetch('/api/autocreate/templates/validate', {
      method: 'POST',
      body: JSON.stringify({ templates }),
    });
  }

  async getAutocreateSchema() {
    return this.fetch('/api/autocreate/templates/schema');
  }

  async health() {
    // Try direct connection (PoracleNG provides CORS headers).
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (res.ok) {
        this.useProxy = false;
        return res.json();
      }
    } catch {
      // Network error — fall through to dev proxy attempt
    }

    // In dev, also try the Vite proxy at /poracle-api/* for the rare case
    // where the user is running an older PoracleNG without CORS.
    try {
      const res = await fetch('/poracle-api/health');
      if (res.ok) {
        this.useProxy = true;
        return res.json();
      }
    } catch {
      // Not running through Vite, or proxy not configured
    }

    throw new Error(
      `Cannot reach PoracleNG at ${this.baseUrl}. Check the URL and that the server is running.`
    );
  }
}
