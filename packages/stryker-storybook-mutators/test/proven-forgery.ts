import type * as csf from '@layzee/storybook-core';
import type { ProofReason, Proven, Site } from '@layzee/storybook-core';

type Assignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false;

interface ProvenMembers {
  readonly property: object;
  readonly reason: ProofReason;
}

export function spreadCopy(proven: Proven) {
  return { ...proven };
}

export const literalIsNotProven: Assignable<ProvenMembers, Proven> = false;

export const provenIsNotConstructible: 'Proven' extends keyof typeof csf
  ? true
  : false = false;

export const spreadCopyIsNotProven: Assignable<
  ReturnType<typeof spreadCopy>,
  Proven
> = false;

export const siteWithLiteralProofsIsNotSite: Assignable<
  {
    readonly node: object;
    readonly runs: readonly [];
    readonly proofs: readonly ProvenMembers[];
  },
  Site
> = false;
