#!/usr/bin/env node
/**
 * Capture enriched test data from a running PoracleNG instance (on-demand only).
 *
 * Usage:
 *   PORACLE_URL=http://localhost:4201 PORACLE_SECRET=flibble node scripts/capture-test-data.mjs
 *
 * Uses the server-side DTS type map (GET /api/dts/testdata -> `types`) and
 * per-DTS-type scenarios (?dtsType=), enriches each by DTS name, and writes the
 * enriched variable maps to src/data/test-data.js for standalone/offline mode.
 * Requires a poracle build that exposes `types` (develop / >= 5.2.0).
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL = process.env.PORACLE_URL || 'http://localhost:4201';
const SECRET = process.env.PORACLE_SECRET || '';

// DTS types with no bundled webhook sample — skip (no scenarios to capture).
const SKIP_TYPES = new Set(['rsvpChanges', 'greeting', 'help', 'nest']);

if (!SECRET) {
  console.error('PORACLE_SECRET environment variable is required');
  process.exit(1);
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Poracle-Secret': SECRET,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  console.log(`Connecting to ${URL}...`);
  try {
    const res = await fetch(`${URL}/health`);
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
  } catch (err) {
    console.error(`Cannot reach ${URL}: ${err.message}`);
    process.exit(1);
  }

  // Discover DTS types from the server map.
  const root = await fetchJson('/api/dts/testdata');
  if (!root.types || Object.keys(root.types).length === 0) {
    console.error(
      'The poracle `types` map is absent or empty — refusing to overwrite fixtures. ' +
      'Check PORACLE_URL/PORACLE_SECRET point at a derived-types build (develop / >= 5.2.0).'
    );
    process.exit(1);
  }
  const dtsTypes = Object.keys(root.types).filter(
    (t) => root.types[t].templateType === t && !SKIP_TYPES.has(t)
  );

  const result = {};
  for (const dtsType of dtsTypes) {
    console.log(`\n=== ${dtsType} ===`);
    let scenarios;
    try {
      const data = await fetchJson(`/api/dts/testdata?dtsType=${encodeURIComponent(dtsType)}`);
      scenarios = data.testdata || [];
    } catch (err) {
      console.warn(`  testdata fetch failed: ${err.message}`);
      continue;
    }
    if (scenarios.length === 0) {
      console.log('  no scenarios');
      continue;
    }

    result[dtsType] = {};
    for (const scenario of scenarios) {
      const name = scenario.test;
      try {
        const enriched = await fetchJson('/api/dts/enrich', {
          method: 'POST',
          body: JSON.stringify({ type: dtsType, webhook: scenario.webhook, language: 'en' }),
        });
        if (enriched.variables) {
          result[dtsType][name] = enriched.variables;
          console.log(`  ✓ ${name}`);
        } else {
          console.log(`  ✗ ${name} (no variables in response)`);
        }
      } catch (err) {
        console.warn(`  ✗ ${name}: ${err.message}`);
      }
    }
    if (Object.keys(result[dtsType]).length === 0) delete result[dtsType];
  }

  const totalScenarios = Object.values(result).reduce((sum, t) => sum + Object.keys(t).length, 0);
  console.log(`\nCaptured ${totalScenarios} scenarios across ${Object.keys(result).length} types`);

  const banner = `/**
 * Pre-enriched test data for standalone preview mode.
 *
 * AUTO-GENERATED — do not edit by hand.
 * Regenerate with: PORACLE_URL=... PORACLE_SECRET=... node scripts/capture-test-data.mjs
 */

`;
  const body = `export const testScenarios = ${JSON.stringify(result, null, 2)};

export function getTestScenario(type, scenario) {
  return testScenarios[type]?.[scenario] || null;
}

export function getTestScenarioNames(type) {
  return Object.keys(testScenarios[type] || {});
}
`;
  const outputPath = join(__dirname, '..', 'src', 'data', 'test-data.js');
  writeFileSync(outputPath, banner + body);
  console.log(`Wrote ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
