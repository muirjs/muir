import fs from 'node:fs';
import path from 'node:path';

import type { MuirSirynPlaywrightRunRequest } from './run-request.ts';
import { muirSirynPlaywrightWriteFileAtomic } from './server-protocol.ts';

export type MuirSirynPlaywrightRunKind = 'server' | 'other';

export type MuirSirynPlaywrightServerMutants = ReadonlySet<string> | 'unknown';

export function muirSirynPlaywrightRunKind(
  request: MuirSirynPlaywrightRunRequest,
  dryRunServerMutants: () => MuirSirynPlaywrightServerMutants,
): MuirSirynPlaywrightRunKind {
  if (request.kind !== 'mutant') {
    return 'other';
  }

  return serverRan(dryRunServerMutants(), request.activeMutant)
    ? 'server'
    : 'other';
}

/**
 * Stryker asks for static activation of every run without a test filter
 * (@stryker-mutator/core 10.1.1 mutant-test-planner.js:148).
 */
export function muirSirynPlaywrightStartupMutantFor(
  request: MuirSirynPlaywrightRunRequest,
  dryRunServerMutants: () => MuirSirynPlaywrightServerMutants,
): string | undefined {
  return request.kind === 'mutant' &&
    request.mutantActivation === 'static' &&
    serverRan(dryRunServerMutants(), request.activeMutant)
    ? request.activeMutant
    : undefined;
}

function serverRan(
  mutants: MuirSirynPlaywrightServerMutants,
  mutant: string,
): boolean {
  return mutants === 'unknown' || mutants.has(mutant);
}

export function muirSirynPlaywrightRestartsToIsolate(
  isolate: boolean,
  previous: MuirSirynPlaywrightRunKind,
  next: MuirSirynPlaywrightRunKind,
): boolean {
  return isolate && (previous === 'server' || next === 'server');
}

export type MuirSirynPlaywrightServerMutantsFile =
  | { readonly mutants: ReadonlySet<string> }
  | { readonly cause: string };

export const muirSirynPlaywrightServerMutantsFile =
  '.muir-playwright-server-mutants';

export function muirSirynPlaywrightWriteServerMutantsFile(
  dir: string,
  mutants: Iterable<string>,
): void {
  muirSirynPlaywrightWriteFileAtomic(
    dir,
    muirSirynPlaywrightServerMutantsFile,
    [...mutants].join('\n'),
  );
}

export function muirSirynPlaywrightReadServerMutantsFile(
  dir: string,
): MuirSirynPlaywrightServerMutantsFile {
  try {
    const text = fs.readFileSync(
      path.join(dir, muirSirynPlaywrightServerMutantsFile),
      'utf8',
    );

    return { mutants: new Set(text.split('\n').filter(Boolean)) };
  } catch (error) {
    return { cause: String(error) };
  }
}
