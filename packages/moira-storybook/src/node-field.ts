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
