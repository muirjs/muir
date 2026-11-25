import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { Mutant, schema } from '@stryker-mutator/api/core';

import type { MuirSirynPlaywrightReportedTest } from './reporter.ts';
import { muirSirynPlaywrightTestName } from './run-result.ts';

export const muirSirynPlaywrightTracesDirEnv =
  'MUIR_SIRYN_PLAYWRIGHT_TRACES_DIR';
export const muirSirynPlaywrightProjectRootEnv =
  'MUIR_SIRYN_PLAYWRIGHT_PROJECT_ROOT';

export interface MuirSirynPlaywrightTracesTarget {
  readonly dir: string;
  readonly projectRoot: string;
}

export function muirSirynPlaywrightReadTracesTarget(
  survivorTraces: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): MuirSirynPlaywrightTracesTarget | undefined {
  if (survivorTraces === undefined) {
    return undefined;
  }

  const dir = env[muirSirynPlaywrightTracesDirEnv];
  const projectRoot = env[muirSirynPlaywrightProjectRootEnv];

  if (!dir || !projectRoot) {
    throw new Error(
      'muirSirynPlaywright.survivorTraces is set, but the muir-siryn-playwright-traces reporter is not in reporters. ' +
        'Add it: it empties the traces folder at the start of each run.',
    );
  }

  return { dir, projectRoot };
}

export function muirSirynPlaywrightReportFileName(
  fileName: string,
  projectRoot: string,
): string {
  // Stryker disable next-line StringLiteral: Windows only, as POSIX paths use no backslash separator; the Windows run kills it
  return path.relative(projectRoot, fileName).replaceAll('\\', '/');
}

type ReportedMutant = Pick<
  schema.MutantResult,
  'mutatorName' | 'replacement' | 'location'
>;

export function muirSirynPlaywrightReportKey(
  fileName: string,
  { mutatorName, replacement, location: { start, end } }: ReportedMutant,
): string {
  return `${fileName}@${start.line}:${start.column}-${end.line}:${end.column}\n${mutatorName}: ${replacement}`;
}

export function muirSirynPlaywrightMutantKey(
  fileName: string,
  {
    mutatorName,
    replacement,
    location: { start, end },
  }: Pick<Mutant, 'mutatorName' | 'replacement' | 'location'>,
): string {
  return muirSirynPlaywrightReportKey(fileName, {
    mutatorName,
    replacement,
    location: {
      start: { line: start.line + 1, column: start.column + 1 },
      end: { line: end.line + 1, column: end.column + 1 },
    },
  });
}

const unsafe = /[^-0-9A-Za-z\P{ASCII}]+/gu;

export function muirSirynPlaywrightFolderName(key: string): string {
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 8);

  return `${trimMiddle(key.replace(unsafe, '-'), 91)}-${hash}`;
}

function trimMiddle(text: string, length: number): string {
  if (text.length <= length) {
    return text;
  }

  const head = Math.floor((length - 1) / 2);

  return `${text.slice(0, head)}-${text.slice(text.length - (length - 1 - head))}`;
}

export interface MuirSirynPlaywrightCopiedTrace {
  readonly test: string;
  readonly attempt: number;
  readonly status: string;
  readonly trace: string | undefined;
}

export const muirSirynPlaywrightMutantFile = 'mutant.json';

export interface MuirSirynPlaywrightMutantTraces {
  readonly key: string;
  readonly tests: readonly MuirSirynPlaywrightCopiedTrace[];
}

export function muirSirynPlaywrightCopySurvivorTraces(
  { dir: tracesDir, projectRoot }: MuirSirynPlaywrightTracesTarget,
  mutant: Pick<Mutant, 'fileName' | 'mutatorName' | 'replacement' | 'location'>,
  tests: Iterable<MuirSirynPlaywrightReportedTest>,
): string {
  const key = muirSirynPlaywrightMutantKey(
    muirSirynPlaywrightReportFileName(mutant.fileName, projectRoot),
    mutant,
  );
  const dir = path.join(tracesDir, muirSirynPlaywrightFolderName(key));
  fs.mkdirSync(dir, { recursive: true });
  const copied: MuirSirynPlaywrightCopiedTrace[] = [];

  for (const test of tests) {
    for (const [index, attempt] of test.results.entries()) {
      const source = attempt.attachments.find(
        (attachment) => attachment.name === 'trace' && attachment.path,
      )?.path;
      const copy = `${test.id}-${index}.zip`;

      if (source) {
        fs.copyFileSync(source, path.join(dir, copy));
      }

      copied.push({
        test: muirSirynPlaywrightTestName(test),
        attempt: index,
        status: attempt.status,
        trace: source ? copy : undefined,
      });
    }
  }

  const written: MuirSirynPlaywrightMutantTraces = { key, tests: copied };
  fs.writeFileSync(
    path.join(dir, muirSirynPlaywrightMutantFile),
    JSON.stringify(written, null, 2),
  );

  return dir;
}

export function muirSirynPlaywrightCleanTracesDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
