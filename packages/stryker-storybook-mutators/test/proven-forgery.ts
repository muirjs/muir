// A mutator skips a property only through a Proven that @layzee/storybook-csf mints (ADR 0006). Each export below
// states that a value made outside storybook-csf is no Proven, so the typecheck target fails when one would be.
// Object.assign({}, proven, { property }) types as a Proven; ESLint's prefer-object-spread rejects that form.
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

/** A literal with the public members of Proven lacks its `#` fields. */
export const literal: Assignable<ProvenMembers, Proven> = false;

/** Proven is exported as a type only, so there is no class to construct. */
export const constructible: 'Proven' extends keyof typeof csf ? true : false =
  false;

/** A spread copy drops the `#` fields. */
export const spread: Assignable<ReturnType<typeof spreadCopy>, Proven> = false;

/** A Site carries only the proofs that sitesOf minted. */
export const site: Assignable<
  {
    readonly node: object;
    readonly runs: readonly [];
    readonly proofs: readonly ProvenMembers[];
  },
  Site
> = false;
