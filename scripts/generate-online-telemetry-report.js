#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const out = {
    days: 30,
    minEvents: 40,
    strict: false,
    store: process.env.AI_TELEMETRY_STORE_FILE || path.resolve(process.cwd(), '.runtime-logs/ai-online-telemetry.jsonl'),
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--days' && argv[i + 1]) {
      out.days = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === '--min-events' && argv[i + 1]) {
      out.minEvents = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === '--store' && argv[i + 1]) {
      out.store = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === '--strict') {
      out.strict = true;
    }
  }
  return out;
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object') rows.push(parsed);
    } catch {
      // ignore invalid lines
    }
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv);
  const sinceTs = Date.now() - args.days * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceTs).toISOString();
  const events = readJsonLines(args.store).filter((event) => {
    const observedAt = String(event.observedAt || event.evaluatedAt || '');
    return observedAt && observedAt >= sinceIso;
  });

  let fallback = 0;
  let mismatch = 0;
  let mismatchDen = 0;
  let criticalMiss = 0;
  let criticalDen = 0;

  for (const e of events) {
    if (e.fallbackUsed === true) fallback += 1;
    if (e.expectedSeverity && e.predictedSeverity) {
      mismatchDen += 1;
      if (e.expectedSeverity !== e.predictedSeverity) mismatch += 1;
      if (e.expectedSeverity === 'critical') {
        criticalDen += 1;
        if (e.predictedSeverity !== 'critical') criticalMiss += 1;
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    windowDays: args.days,
    since: sinceIso,
    storeFile: args.store,
    sampleSize: events.length,
    minEventsRequired: args.minEvents,
    sampleSufficient: events.length >= args.minEvents,
    fallbackRate: events.length ? fallback / events.length : 0,
    mismatchRate: mismatchDen ? mismatch / mismatchDen : 0,
    criticalMissRate: criticalDen ? criticalMiss / criticalDen : 0,
  };

  const outDir = path.resolve(process.cwd(), '.out/telemetry');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const jsonPath = path.join(outDir, `online-telemetry-report-${stamp}.json`);
  const mdPath = path.join(outDir, `online-telemetry-report-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    mdPath,
    [
      '# Online Telemetry Report',
      '',
      `- generatedAt: \`${report.generatedAt}\``,
      `- windowDays: \`${report.windowDays}\``,
      `- since: \`${report.since}\``,
      `- sampleSize: \`${report.sampleSize}\``,
      `- minEventsRequired: \`${report.minEventsRequired}\``,
      `- sampleSufficient: \`${report.sampleSufficient}\``,
      `- fallbackRate: \`${report.fallbackRate.toFixed(4)}\``,
      `- mismatchRate: \`${report.mismatchRate.toFixed(4)}\``,
      `- criticalMissRate: \`${report.criticalMissRate.toFixed(4)}\``,
      '',
      `- source: \`${report.storeFile}\``,
    ].join('\n')
  );

  console.log('Online telemetry report generated');
  console.log('markdown:', mdPath);
  console.log('json:', jsonPath);
  console.log('sampleSize:', report.sampleSize);
  console.log('sampleSufficient:', report.sampleSufficient);

  if (args.strict && !report.sampleSufficient) {
    process.exitCode = 2;
  }
}

main();
