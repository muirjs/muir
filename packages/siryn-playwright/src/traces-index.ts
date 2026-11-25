import fs from 'node:fs';
import path from 'node:path';

import type { schema } from '@stryker-mutator/api/core';

import { muirSirynPlaywrightIsRecord } from './is-record.ts';
import {
  type MuirSirynPlaywrightCopiedTrace,
  muirSirynPlaywrightMutantFile,
  muirSirynPlaywrightReportKey,
} from './survivor-traces.ts';

export interface MuirSirynPlaywrightTraceFolder {
  readonly dir: string;
  readonly traces: readonly MuirSirynPlaywrightCopiedTrace[];
}

export function muirSirynPlaywrightDescribeSurvivors(
  report: schema.MutationTestResult,
  folders: ReadonlyMap<string, MuirSirynPlaywrightTraceFolder>,
): schema.MutationTestResult {
  const configFile = muirSirynPlaywrightIsRecord(report.config)
    ? report.config['configFile']
    : undefined;
  const files = Object.fromEntries(
    Object.entries(report.files).map(([fileName, file]) => [
      fileName,
      {
        ...file,
        mutants: file.mutants.map((mutant) =>
          mutant.status === 'Survived'
            ? {
                ...mutant,
                description: describe(
                  fileName,
                  mutant,
                  folders.get(muirSirynPlaywrightReportKey(fileName, mutant)),
                  typeof configFile === 'string' ? configFile : undefined,
                ),
              }
            : mutant,
        ),
      },
    ]),
  );

  return { ...report, files };
}

function describe(
  fileName: string,
  { location: { start, end } }: schema.MutantResult,
  folder: MuirSirynPlaywrightTraceFolder | undefined,
  configFile: string | undefined,
): string {
  const traces = folder
    ? [
        'Traces of this mutant run:',
        ...folder.traces.flatMap(({ test, attempt, status, trace }) => [
          `  ${test} (${attempt > 0 ? `retry ${attempt}, ` : ''}${status}):`,
          trace
            ? `    npx playwright show-trace "${path.join(folder.dir, trace)}"`
            : '    no trace recorded',
        ]),
      ]
    : [
        'No trace from this run: incremental mode reused this result, or copying its traces failed. Recheck it to record one.',
      ];
  // A --mutate range counts lines from 1 and columns from 0; the report counts both from 1.
  const range = `${start.line}:${start.column - 1}-${end.line}:${end.column - 1}`;
  const command = [
    'npx stryker run',
    ...(configFile === undefined ? [] : [`"${configFile}"`]),
    `--mutate "${fileName}:${range}"`,
  ].join(' ');

  return [
    ...traces,
    'Recheck this mutant after a test change:',
    `  ${command}`,
  ].join('\n');
}

export function muirSirynPlaywrightReadTraceFolders(tracesDir: string): {
  readonly folders: ReadonlyMap<string, MuirSirynPlaywrightTraceFolder>;
  readonly unreadable: readonly string[];
} {
  const folders = new Map<string, MuirSirynPlaywrightTraceFolder>();
  const unreadable: string[] = [];

  for (const entry of fs.readdirSync(tracesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dir = path.join(tracesDir, entry.name);
    const written = readJson(path.join(dir, muirSirynPlaywrightMutantFile));

    if (
      muirSirynPlaywrightIsRecord(written) &&
      typeof written['key'] === 'string' &&
      Array.isArray(written['tests']) &&
      written['tests'].every(isCopiedTrace)
    ) {
      folders.set(written['key'], { dir, traces: written['tests'] });
    } else {
      unreadable.push(dir);
    }
  }

  return { folders, unreadable };
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function isCopiedTrace(
  value: unknown,
): value is MuirSirynPlaywrightCopiedTrace {
  return (
    muirSirynPlaywrightIsRecord(value) &&
    typeof value['test'] === 'string' &&
    typeof value['attempt'] === 'number' &&
    typeof value['status'] === 'string' &&
    (value['trace'] === undefined || typeof value['trace'] === 'string')
  );
}

export function muirSirynPlaywrightIndexHtml(
  report: schema.MutationTestResult,
  reportAppScript: string,
): string {
  const data = JSON.stringify(report)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>
    ${reportAppScript}
  </script>
</head>
<body>
  <mutation-test-report-app title-postfix="Stryker, traced run"></mutation-test-report-app>
  <script>
    const app = document.querySelector('mutation-test-report-app');
    app.report = ${data};
    function updateTheme() {
      document.body.style.backgroundColor = app.themeBackgroundColor;
    }
    app.addEventListener('theme-changed', updateTheme);
    updateTheme();
  </script>
</body>
</html>
`;
}
