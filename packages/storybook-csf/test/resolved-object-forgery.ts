import type * as resolvedValues from '../src/resolved-values.ts';
import type { Layer, ResolvedObject } from '../src/resolved-values.ts';

type Assignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false;

interface ResolvedObjectMembers {
  readonly node: object;
  readonly lastWinsProperties: readonly unknown[];
  layerOf(key: string | number): Layer;
}

export function spreadCopy(resolved: ResolvedObject) {
  return { ...resolved };
}

export const literalIsNotLayer: Assignable<ResolvedObjectMembers, Layer> =
  false;

export const resolvedObjectIsNotConstructible: 'ResolvedObject' extends keyof typeof resolvedValues
  ? true
  : false = false;

export const spreadCopyIsNotLayer: Assignable<
  ReturnType<typeof spreadCopy>,
  Layer
> = false;
