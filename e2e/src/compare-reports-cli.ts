import { readFileSync } from 'node:fs';

import { muirCompareReports } from './compare-reports.ts';
import { muirParseReport } from './report.ts';

const [firstFile, secondFile, ...extra] = process.argv.slice(2);

if (firstFile === undefined || secondFile === undefined || extra.length > 0) {
  throw new Error(
    'Usage: node e2e/src/compare-reports-cli.ts <first mutation.json> <second mutation.json>',
  );
}

const differences = muirCompareReports(
  muirParseReport(readFileSync(firstFile, 'utf8')),
  muirParseReport(readFileSync(secondFile, 'utf8')),
);

for (const difference of differences) {
  console.log(difference);
}

if (differences.length > 0) {
  process.exitCode = 1;
}
