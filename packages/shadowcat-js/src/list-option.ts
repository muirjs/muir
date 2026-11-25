import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';

/** Reads the list `options[key][field]` of an ignorer's options, or `fallback` when it is not set; throws, naming `packageName`, when it is not a list of items `isItem` accepts. */
export function muirShadowcatJsListOption(
  packageName: string,
  options: object,
  key: string,
  field: string,
  fallback: readonly string[],
  isItem: (item: unknown) => item is string,
  expected: string,
): readonly string[] {
  const own = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(options, key),
    field,
  );
  const list: unknown = own === undefined ? fallback : own;

  if (!Array.isArray(list) || !list.every(isItem)) {
    throw new Error(
      `${packageName}: ${key}.${field} must be ${expected}, not ${JSON.stringify(own)}.`,
    );
  }

  return list;
}
