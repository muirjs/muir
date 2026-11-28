import { muirMoiraStorybookIsRecord } from './is-record.ts';

export function muirMoiraStorybookField(
  value: unknown,
  ...keys: readonly string[]
): unknown {
  return keys.reduce<unknown>(
    (found, key) =>
      muirMoiraStorybookIsRecord(found) ? found[key] : undefined,
    value,
  );
}

export function muirMoiraStorybookList(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The path of the file Babel parsed `path`'s tree from, as Stryker's instrumenter gives it, or undefined. */
export function muirMoiraStorybookFileNameOf(
  path: unknown,
): string | undefined {
  const fileName = muirMoiraStorybookField(
    path,
    'hub',
    'file',
    'opts',
    'filename',
  );

  return typeof fileName === 'string' ? fileName : undefined;
}

/**
 * The file name of a path from Stryker's instrumenter, as `muirMoiraStorybookFileNameOf` gives it. Throws when the path
 * carries no Babel File, which happens when the instrumenter's `@babel/traverse` and its `@babel/core`'s are two copies
 * (docs/adr/0014-pin-babel-so-the-instrumenter-shares-one-traverse.md): without the file name nothing could be read.
 */
export function muirMoiraStorybookTraversedFileNameOf(
  packageName: string,
  path: unknown,
): string | undefined {
  if (muirMoiraStorybookField(path, 'hub', 'file') === undefined) {
    throw new Error(
      `${packageName}: Stryker's instrumenter walked a file without Babel's File, so the file name is unknown. ` +
        "This happens when the project's install holds two copies of @babel/traverse, one for " +
        '@stryker-mutator/instrumenter and one for its @babel/core. Run `npm ls @babel/traverse` to see them, then ' +
        'give the instrumenter the copy its @babel/core uses with an npm override in package.json, such as ' +
        '"overrides": { "@stryker-mutator/instrumenter": { "@babel/traverse": "8.1.4" } }, and install again.',
    );
  }

  return muirMoiraStorybookFileNameOf(path);
}
