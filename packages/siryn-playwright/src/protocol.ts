import fs from 'node:fs';
import path from 'node:path';

import {
  INSTRUMENTER_CONSTANTS,
  type MutantCoverage,
} from '@stryker-mutator/api/core';

import {
  muirSirynPlaywrightIsRecord,
  muirSirynPlaywrightIsStringArray,
} from './is-record.ts';
import { muirSirynPlaywrightServerSnapshotPrefix } from './server-protocol.ts';

export const muirSirynPlaywrightRunSettingsEnv = 'MUIR_SIRYN_PLAYWRIGHT_RUN';

/**
 * The global the hooks manage in place of Stryker's, for the hooks' own tests: under Stryker the test's
 * instrumented copy of a hook keeps Stryker's global.
 */
export const muirSirynPlaywrightHookTestNamespaceEnv =
  'MUIR_SIRYN_PLAYWRIGHT_HOOK_TEST_NAMESPACE';

export const muirSirynPlaywrightSnapshotSuffix = '.ndjson';

export const muirSirynPlaywrightWorkerFilePrefix = 'worker-';

export const muirSirynPlaywrightInstallErrorSuffix = '.install-error';

export const muirSirynPlaywrightFrameReadTimeoutMs = 2000;

export interface MuirSirynPlaywrightRunSettings {
  readonly outDir: string;
  readonly perTest: boolean;
  readonly hitLimit?: number | undefined;
  /** The webServer hosts (see hostKey) whose requests from a test's page carry the test id header. */
  readonly testIdHosts?: readonly string[] | undefined;
  readonly pageHelpers?: string | undefined;
}

export interface MuirSirynPlaywrightPageSettings
  extends Pick<MuirSirynPlaywrightRunSettings, 'hitLimit'> {
  readonly ns: string;
  readonly activeMutant?: string | undefined;
  readonly testId?: string | undefined;
}

export interface MuirSirynPlaywrightSnapshotLine {
  readonly mutantCoverage?: unknown;
  readonly hitCount?: unknown;
  readonly outlivedItsTest: boolean;
  readonly lost?: boolean;
  readonly instrumented?: unknown;
}

export interface MuirSirynPlaywrightSnapshot {
  readonly coverage: MutantCoverage | undefined;
  readonly hitCount: number;
  readonly outlivedItsTest: boolean;
  readonly lost: boolean;
  /** Instrumented code loaded where the snapshot comes from, whether or not it reached a mutant. */
  readonly instrumented: boolean;
}

export interface MuirSirynPlaywrightSnapshotDir {
  readonly snapshots: readonly MuirSirynPlaywrightSnapshot[];
  readonly hookInstalled: boolean;
  readonly installErrors: readonly string[];
  readonly serverMutants: readonly string[];
}

export function muirSirynPlaywrightIsHitCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * A page can put a BigInt or a cyclic object in its namespace, which JSON cannot hold; that frame
 * counts as lost, so the hook never throws inside Playwright's context close.
 */
export function muirSirynPlaywrightSerializeSnapshot(
  line: MuirSirynPlaywrightSnapshotLine,
): string {
  try {
    return JSON.stringify(line);
  } catch {
    return JSON.stringify({
      lost: true,
      outlivedItsTest: line.outlivedItsTest,
    } satisfies MuirSirynPlaywrightSnapshotLine);
  }
}

export function muirSirynPlaywrightNullPrototypeRecord<T>(): Record<string, T> {
  const record: Record<string, T> = {};
  Object.setPrototypeOf(record, null);

  return record;
}

function nullPrototypeRecordOf<T>(
  entries: readonly (readonly [string, T])[],
): Record<string, T> {
  const record = muirSirynPlaywrightNullPrototypeRecord<T>();
  entries.forEach(([key, value]) => {
    record[key] = value;
  });

  return record;
}

function hitCounts(value: unknown): Record<string, number> {
  return nullPrototypeRecordOf(
    entriesOf(value).flatMap(([mutantId, count]) =>
      muirSirynPlaywrightIsHitCount(count) ? [[mutantId, count] as const] : [],
    ),
  );
}

function entriesOf(value: unknown): [string, unknown][] {
  return Object.entries(muirSirynPlaywrightIsRecord(value) ? value : {});
}

function parseCoverage(value: unknown): MutantCoverage | undefined {
  if (!muirSirynPlaywrightIsRecord(value)) {
    return undefined;
  }

  return {
    static: hitCounts(value['static']),
    perTest: nullPrototypeRecordOf(
      entriesOf(value['perTest']).map(
        ([testId, hits]) => [testId, hitCounts(hits)] as const,
      ),
    ),
  };
}

export function muirSirynPlaywrightParseSnapshotLine(
  line: string,
): MuirSirynPlaywrightSnapshot | undefined {
  let raw: unknown;

  try {
    raw = JSON.parse(line);
  } catch {
    // A killed worker leaves a partial last line; raw stays undefined.
  }

  if (!muirSirynPlaywrightIsRecord(raw)) {
    return undefined;
  }

  return {
    coverage: parseCoverage(raw['mutantCoverage']),
    hitCount: muirSirynPlaywrightIsHitCount(raw['hitCount'])
      ? raw['hitCount']
      : 0,
    outlivedItsTest: raw['outlivedItsTest'] === true,
    lost: raw['lost'] === true,
    instrumented: raw['instrumented'] === true,
  };
}

export function muirSirynPlaywrightReadSnapshotDir(
  dir: string,
): MuirSirynPlaywrightSnapshotDir {
  const names = fs.readdirSync(dir);
  const read = (file: string) => fs.readFileSync(path.join(dir, file), 'utf8');
  const files = names.filter((file) =>
    file.endsWith(muirSirynPlaywrightSnapshotSuffix),
  );
  const snapshotsIn = (file: string) =>
    read(file)
      .split('\n')
      .map(muirSirynPlaywrightParseSnapshotLine)
      .filter((snapshot) => snapshot !== undefined);
  const installErrors = names
    .filter((file) => file.endsWith(muirSirynPlaywrightInstallErrorSuffix))
    .map(read);

  return {
    snapshots: files.flatMap(snapshotsIn),
    hookInstalled: files.some((file) =>
      file.startsWith(muirSirynPlaywrightWorkerFilePrefix),
    ),
    installErrors,
    serverMutants: [
      ...new Set(
        files
          .filter((file) =>
            file.startsWith(muirSirynPlaywrightServerSnapshotPrefix),
          )
          .flatMap(snapshotsIn)
          .flatMap(({ coverage }) => coveredMutants(coverage)),
      ),
    ],
  };
}

function coveredMutants(coverage: MutantCoverage | undefined): string[] {
  if (!coverage) {
    return [];
  }

  return [
    ...Object.keys(coverage.static),
    ...Object.values(coverage.perTest).flatMap((hits) => Object.keys(hits)),
  ];
}

export function muirSirynPlaywrightReadHookTestNamespace(
  env: NodeJS.ProcessEnv,
): string {
  return (
    env[muirSirynPlaywrightHookTestNamespaceEnv] ||
    INSTRUMENTER_CONSTANTS.NAMESPACE
  );
}

export function muirSirynPlaywrightReadRunSettings(
  env: NodeJS.ProcessEnv,
): MuirSirynPlaywrightRunSettings | undefined {
  const raw = env[muirSirynPlaywrightRunSettingsEnv];

  if (raw === undefined) {
    return undefined;
  }

  const refused = `${muirSirynPlaywrightRunSettingsEnv} holds no valid run settings: ${raw}`;
  let settings: unknown;

  try {
    settings = JSON.parse(raw);
  } catch (cause) {
    throw new Error(refused, { cause });
  }

  if (muirSirynPlaywrightIsRecord(settings)) {
    const { outDir, perTest, hitLimit, testIdHosts, pageHelpers } = settings;

    if (
      typeof outDir === 'string' &&
      typeof perTest === 'boolean' &&
      (hitLimit === undefined || typeof hitLimit === 'number') &&
      (testIdHosts === undefined ||
        muirSirynPlaywrightIsStringArray(testIdHosts)) &&
      (pageHelpers === undefined || typeof pageHelpers === 'string')
    ) {
      return {
        outDir,
        perTest,
        ...(hitLimit === undefined ? {} : { hitLimit }),
        ...(testIdHosts === undefined ? {} : { testIdHosts }),
        ...(pageHelpers === undefined ? {} : { pageHelpers }),
      };
    }
  }

  throw new Error(refused);
}
