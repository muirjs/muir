import type * as csf from '@layzee/storybook-csf';
import type { ProofReason, Proven, Site } from '@layzee/storybook-csf';

type Assignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false;

interface ProvenMembers {
  readonly property: object;
  readonly reason: ProofReason;
}

export function spreadCopy(proven: Proven) {
  return { ...proven };
}

export const literal: Assignable<ProvenMembers, Proven> = false;

export const constructible: 'Proven' extends keyof typeof csf ? true : false =
  false;

export const spread: Assignable<ReturnType<typeof spreadCopy>, Proven> = false;

export const site: Assignable<
  {
    readonly node: object;
    readonly runs: readonly [];
    readonly proofs: readonly ProvenMembers[];
  },
  Site
> = false;
