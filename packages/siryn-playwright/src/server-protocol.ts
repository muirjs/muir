import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  muirSirynPlaywrightFieldOf,
  muirSirynPlaywrightIsRecord,
  muirSirynPlaywrightIsStringArray,
} from './is-record.ts';
import type { MuirSirynPlaywrightRunSettings } from './protocol.ts';

/** Tells the server hook, in the processes global setup starts, the folder that holds its control file. */
export const muirSirynPlaywrightServerDirEnv = 'MUIR_SIRYN_PLAYWRIGHT_SERVER';
/** The header the worker hook adds to a test's requests to the webServer. */
export const muirSirynPlaywrightTestIdHeader = 'x-muir-stryker-test';

export const muirSirynPlaywrightControlFile = 'control.json';
export const muirSirynPlaywrightHookedPrefix = 'hooked-';
export const muirSirynPlaywrightServerSnapshotPrefix = 'server-';
/** A per-test coverage key for a request that came without a test id header, followed by its arrival time. */
export const muirSirynPlaywrightUntaggedPrefix = 'muir-stryker-untagged@';

export interface MuirSirynPlaywrightServerControl
  extends MuirSirynPlaywrightRunSettings {
  readonly activeMutant?: string | undefined;
  readonly issuedTestIds?: readonly string[];
}

export function muirSirynPlaywrightParseServerControl(
  raw: string | undefined,
): MuirSirynPlaywrightServerControl | undefined {
  let value: unknown;

  try {
    value = raw === undefined ? undefined : JSON.parse(raw);
  } catch {
    // value stays undefined and reads as no control below.
  }

  if (!muirSirynPlaywrightIsRecord(value)) {
    return undefined;
  }

  const {
    outDir,
    perTest,
    activeMutant,
    hitLimit,
    issuedTestIds,
    testIdHosts,
  } = value;

  if (
    typeof outDir !== 'string' ||
    typeof perTest !== 'boolean' ||
    (activeMutant !== undefined && typeof activeMutant !== 'string') ||
    (hitLimit !== undefined && typeof hitLimit !== 'number') ||
    (issuedTestIds !== undefined &&
      !muirSirynPlaywrightIsStringArray(issuedTestIds)) ||
    (testIdHosts !== undefined &&
      !muirSirynPlaywrightIsStringArray(testIdHosts))
  ) {
    return undefined;
  }

  return {
    outDir,
    perTest,
    activeMutant,
    hitLimit,
    ...(issuedTestIds === undefined ? {} : { issuedTestIds }),
    ...(testIdHosts === undefined ? {} : { testIdHosts }),
  };
}

export function muirSirynPlaywrightWriteFileAtomic(
  dir: string,
  name: string,
  text: string,
) {
  const temp = path.join(dir, `${name}.${randomUUID()}`);
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, path.join(dir, name));
}

export function muirSirynPlaywrightWriteServerControl(
  dir: string,
  control: MuirSirynPlaywrightServerControl,
) {
  muirSirynPlaywrightWriteFileAtomic(
    dir,
    muirSirynPlaywrightControlFile,
    JSON.stringify(control),
  );
}

export function muirSirynPlaywrightReadServerControlText(
  dir: string,
): string | undefined {
  try {
    return fs.readFileSync(
      path.join(dir, muirSirynPlaywrightControlFile),
      'utf8',
    );
  } catch (error) {
    if (muirSirynPlaywrightFieldOf(error, 'code') === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

export function muirSirynPlaywrightReadServerControl(
  dir: string,
): MuirSirynPlaywrightServerControl | undefined {
  return muirSirynPlaywrightParseServerControl(
    muirSirynPlaywrightReadServerControlText(dir),
  );
}

export function muirSirynPlaywrightAnyHooked(dir: string): boolean {
  return fs
    .readdirSync(dir)
    .some((file) => file.startsWith(muirSirynPlaywrightHookedPrefix));
}

export function muirSirynPlaywrightForgetHooked(dir: string) {
  fs.readdirSync(dir)
    .filter((file) => file.startsWith(muirSirynPlaywrightHookedPrefix))
    .forEach((file) => fs.rmSync(path.join(dir, file)));
}

const localhostAliases: ReadonlySet<string> = new Set([
  '127.0.0.1',
  '[::1]',
  '0.0.0.0',
  '[::]',
]);

export function muirSirynPlaywrightHostKey(url: URL): string {
  const host = localhostAliases.has(url.hostname) ? 'localhost' : url.hostname;
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');

  return `${host}:${port}`;
}

export function muirSirynPlaywrightUntaggedKey(arrivedAt: number): string {
  return `${muirSirynPlaywrightUntaggedPrefix}${arrivedAt}`;
}

export function muirSirynPlaywrightUntaggedArrival(
  key: string,
): number | undefined {
  const arrivedAt = key.slice(muirSirynPlaywrightUntaggedPrefix.length);

  return key.startsWith(muirSirynPlaywrightUntaggedPrefix) &&
    /^\d+$/.test(arrivedAt)
    ? Number(arrivedAt)
    : undefined;
}
