# Poracle Config

A web-based configuration tool for [PoracleNG](https://github.com/jfberry/PoracleNG) community admins. Edit DTS templates, server configuration, and autocreate channel templates — all from your browser with a live preview.

## Features

### DTS Template Editor
- Form-based and raw JSON editing for Discord and Telegram message templates
- Live preview rendering with Handlebars, including emoji and partial support
- Context-aware tag picker with block scopes
- Send test messages to Discord for verification
- Import/export templates as JSON files

### Config Editor
- Schema-driven configuration management pulled from your PoracleNG instance
- All field types: strings, numbers, booleans, selects, arrays, maps, colors
- ID resolution for Discord roles, channels, and Telegram chats
- Dirty tracking, validation, and overridden field indicators
- Migration support (config.toml to overrides.json)

### Autocreate Editor
- Visual editor for `channelTemplate.json` — the file controlling `!autocreate`
- Tree sidebar showing template structure (categories, channels, threads)
- Expandable role cards with tri-state permission grid (allow/deny/inherit)
- Commands, threads, and thread picker editing
- Client-side validation with server-side verification on save

## Usage

### GitHub Pages (no install)

The tool is hosted at **https://jfberry.github.io/poracle-config/**

Open it in your browser and enter your PoracleNG API URL and secret to connect. Your PoracleNG instance must have CORS enabled (included in recent builds).

### Local Install

Requirements: Node.js 18+

```bash
git clone https://github.com/jfberry/poracle-config.git
cd poracle-config
npm install
npm run dev
```

This starts a dev server (default http://localhost:3000/poracle-config/). The dev server includes a Vite proxy at `/poracle-api/*` that forwards to your PoracleNG instance, useful if your PoracleNG build doesn't have CORS headers.

To configure the proxy target, edit `vite.config.js` and set the proxy target URL.

### Production Build

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server. The app is a single-page application with no server-side requirements — all API calls go directly from the browser to your PoracleNG instance.

## Connecting to PoracleNG

Enter your PoracleNG API URL (e.g. `http://localhost:4200`) and the API secret configured in your PoracleNG settings. The tool verifies the connection and secret before showing the editor.

If running PoracleNG on a different machine, ensure the API port is accessible and CORS is enabled in your PoracleNG configuration.

## License

MIT
