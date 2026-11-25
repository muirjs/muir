import type * as csf from '@muirjs/moira-storybook';
import type {
  MuirMoiraStorybookProofReason,
  MuirMoiraStorybookProven,
  MuirMoiraStorybookSite,
} from '@muirjs/moira-storybook';

type Assignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false;

interface ProvenMembers {
  readonly property: object;
  readonly reason: MuirMoiraStorybookProofReason;
}

export function spreadCopy(proven: MuirMoiraStorybookProven) {
  return { ...proven };
}

export const literalIsNotProven: Assignable<
  ProvenMembers,
  MuirMoiraStorybookProven
> = false;

export const provenIsNotConstructible: 'Proven' extends keyof typeof csf
  ? true
  : false = false;

export const spreadCopyIsNotProven: Assignable<
  ReturnType<typeof spreadCopy>,
  MuirMoiraStorybookProven
> = false;

export const siteWithLiteralProofsIsNotSite: Assignable<
  {
    readonly node: object;
    readonly runs: readonly [];
    readonly proofs: readonly ProvenMembers[];
  },
  MuirMoiraStorybookSite
> = false;
