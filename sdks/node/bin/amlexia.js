#!/usr/bin/env node
import { checkIngestHealth } from '../dist/health.js';

const cmd = process.argv[2];
const ingestUrl = process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com';

if (cmd === 'health' || !cmd) {
  const result = await checkIngestHealth(ingestUrl);
  console.log(JSON.stringify({ ingestUrl, ...result }, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (cmd === 'version') {
  console.log('1.0.2');
  process.exit(0);
}

console.error(`Usage: amlexia [health|version]`);
process.exit(1);
