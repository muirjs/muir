import { muirIsRecord } from './stryker-report.ts';

/** What `pattern` first matches in each `||` alternative of a version range. */
function startsOf(range: unknown, pattern: RegExp): string[] {
  return typeof range === 'string'
    ? range
        .split('||')
        .flatMap((alternative) => pattern.exec(alternative)?.[0] ?? [])
    : [];
}

/**
 * The npm dist-tags a release moves to this version of a package, besides `latest`: `stryker-<major>` per StrykerJS
 * major of its peer range, `node-<major>` per Node.js major of its engines when its name has the `node` technology,
 * and `playwright-<major>.<minor>` for the Playwright Test release its peer range starts at.
 */
export function muirDistTags(manifest: unknown): string[] {
  if (!muirIsRecord(manifest)) {
    throw new TypeError('The manifest is not an object.');
  }

  const { name, engines, peerDependencies: peers } = manifest;
  const nodeRange =
    typeof name === 'string' &&
    name.split('-').includes('node') &&
    muirIsRecord(engines)
      ? engines['node']
      : undefined;
  const peerRange = (peer: string): unknown =>
    muirIsRecord(peers) ? peers[peer] : undefined;

  return [
    ...startsOf(peerRange('@stryker-mutator/core'), /\d+/).map(
      (major) => `stryker-${major}`,
    ),
    ...startsOf(nodeRange, /\d+/).map((major) => `node-${major}`),
    ...startsOf(peerRange('@playwright/test'), /\d+\.\d+/).map(
      (release) => `playwright-${release}`,
    ),
  ];
}
