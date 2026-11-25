import type * as resolvedValues from '../src/resolved-values.ts';
import type {
  MuirMoiraStorybookLayer,
  MuirMoiraStorybookResolvedObject,
} from '../src/resolved-values.ts';

type Assignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false;

interface ResolvedObjectMembers {
  readonly node: object;
  readonly lastWinsProperties: readonly unknown[];
  layerOf(key: string | number): MuirMoiraStorybookLayer;
}

export function spreadCopy(resolved: MuirMoiraStorybookResolvedObject) {
  return { ...resolved };
}

export const literalIsNotLayer: Assignable<
  ResolvedObjectMembers,
  MuirMoiraStorybookLayer
> = false;

export const resolvedObjectIsNotConstructible: 'ResolvedObject' extends keyof typeof resolvedValues
  ? true
  : false = false;

export const spreadCopyIsNotResolvedObject: Assignable<
  ReturnType<typeof spreadCopy>,
  MuirMoiraStorybookResolvedObject
> = false;
