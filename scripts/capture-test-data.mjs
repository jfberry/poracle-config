#!/usr/bin/env node
/**
 * Capture enriched test data from a running PoracleNG instance.
 *
 * Usage:
 *   PORACLE_URL=http://localhost:4200 PORACLE_SECRET=hello node scripts/capture-test-data.mjs
 *
 * Connects to PoracleNG, fetches all webhook scenarios from /api/dts/testdata,
 * runs each through /api/dts/enrich, and writes the enriched variable maps to
 * src/data/test-data.js for use in standalone mode.
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const URL = process.env.PORACLE_URL || 'http://localhost:3030';
const SECRET = process.env.PORACLE_SECRET || '';

if (!SECRET) {
  console.error('PORACLE_SECRET environment variable is required');
  process.exit(1);
}

// Mapping of DTS template type → testdata webhook type
const dtsToWebhookType = {
  monster: 'pokemon',
  monsterNoIv: 'pokemon',
  raid: 'raid',
  egg: 'raid',
  invasion: 'pokestop',
  lure: 'pokestop',
  quest: 'quest',
  nest: 'nest',
  gym: 'gym',
  'fort-update': 'fort_update',
  maxbattle: 'max_battle',
};

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

  // Verify connectivity
  try {
    const res = await fetch(`${URL}/health`);
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
  } catch (err) {
    console.error(`Cannot reach ${URL}: ${err.message}`);
    process.exit(1);
  }

  const dtsTypes = [
    'monster', 'monsterNoIv', 'raid', 'egg', 'invasion', 'lure',
    'quest', 'nest', 'gym',
  ];

  const result = {};

  for (const dtsType of dtsTypes) {
    const webhookType = dtsToWebhookType[dtsType] || dtsType;
    console.log(`\n=== ${dtsType} (webhook: ${webhookType}) ===`);

    let scenarios;
    try {
      const data = await fetchJson(`/api/dts/testdata?type=${webhookType}`);
      scenarios = data.testdata || [];
    } catch (err) {
      console.warn(`  testdata fetch failed: ${err.message}`);
      continue;
    }

    if (scenarios.length === 0) {
      console.log(`  no scenarios for ${webhookType}`);
      continue;
    }

    // For pokestop-derived types, filter scenarios to only those matching this DTS type.
    // Invasions have grunt_type/character/display_type set; lures have lure_id/lure_expiration.
    const filtered = scenarios.filter((s) => {
      if (webhookType !== 'pokestop') return true;
      const w = s.webhook;
      const isInvasion = w.grunt_type !== undefined || w.character !== undefined || w.display_type !== undefined || w.incident_grunt_type !== undefined;
      const isLure = w.lure_id !== undefined || w.lure_expiration !== undefined || w.lure_type !== undefined;
      if (dtsType === 'invasion') return isInvasion && !isLure;
      if (dtsType === 'lure') return isLure;
      return false;
    });

    result[dtsType] = {};

    for (const scenario of filtered) {
      const name = scenario.test;
      try {
        // Send the DTS type (invasion/lure) to enrich, not the webhook type (pokestop).
        // The enrich endpoint understands the specific DTS types directly.
        const enriched = await fetchJson('/api/dts/enrich', {
          method: 'POST',
          body: JSON.stringify({
            type: dtsType === 'monsterNoIv' ? 'pokemon' : (dtsType === 'egg' ? 'raid' : dtsType),
            webhook: scenario.webhook,
            language: 'en',
          }),
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
  }

  // Build the JS module
  const totalScenarios = Object.values(result).reduce(
    (sum, type) => sum + Object.keys(type).length,
    0
  );
  console.log(`\nCaptured ${totalScenarios} scenarios across ${Object.keys(result).length} types`);

  const banner = `/**
 * Pre-enriched test data for standalone preview mode.
 *
 * AUTO-GENERATED — do not edit by hand.
 * Regenerate with: PORACLE_URL=... PORACLE_SECRET=... node scripts/capture-test-data.mjs
 *
 * Captured: ${new Date().toISOString()}
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
