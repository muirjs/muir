import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';

import { muirProteusJsxPackageName } from './package-name.ts';

export function muirProteusJsxListOption(
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
      `${muirProteusJsxPackageName}: ${key}.${field} must be ${expected}, not ${JSON.stringify(own)}.`,
    );
  }

  return list;
}
