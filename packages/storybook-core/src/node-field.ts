import { isRecord } from './is-record.ts';

export function field(value: unknown, ...keys: readonly string[]): unknown {
  return keys.reduce<unknown>(
    (found, key) => (isRecord(found) ? found[key] : undefined),
    value,
  );
}

export function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The path of the file Babel parsed `path`'s tree from, as Stryker's instrumenter gives it, or undefined. */
export function fileNameOf(path: unknown): string | undefined {
  const fileName = field(path, 'hub', 'file', 'opts', 'filename');

  return typeof fileName === 'string' ? fileName : undefined;
}
