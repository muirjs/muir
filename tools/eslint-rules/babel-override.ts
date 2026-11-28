import { muirIsRecord } from './stryker-report.ts';

/** The `@babel/traverse` version that a `package.json`'s npm overrides give `@stryker-mutator/instrumenter`. */
export function instrumenterTraverseOverride(
  manifest: unknown,
): string | undefined {
  const overrides = muirIsRecord(manifest) ? manifest['overrides'] : undefined;
  const instrumenter = muirIsRecord(overrides)
    ? overrides['@stryker-mutator/instrumenter']
    : undefined;
  const version = muirIsRecord(instrumenter)
    ? instrumenter['@babel/traverse']
    : undefined;

  return typeof version === 'string' ? version : undefined;
}

/** The override as the `@muirjs/shadowcat-storybook` README and the `@muirjs/moira-storybook` error write it. */
export function instrumenterOverrideSnippet(version: string): string {
  return `"overrides": { "@stryker-mutator/instrumenter": { "@babel/traverse": "${version}" } }`;
}
