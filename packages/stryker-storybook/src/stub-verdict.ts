import { chainUpTo } from '@layzee/storybook-core';

import {
  classifyStubs,
  type ClassifiedStub,
  type StoryFile,
  type StubVerdict,
} from './reset-setting.ts';
import type { StorybookProject } from './storybook-project.ts';

export const storybookPluginName = 'lz-storybook';

/** The mutator whose surviving mutants make unchecked stubs: it removes a stub, where `LzStorybookSpyStubOutcome` only flips how a stub settles. */
export const spyStubName = 'LzStorybookSpyStub';

export type ReasonVerdict =
  | Exclude<StubVerdict, 'kept'>
  | 'once-not-rewritten'
  | 'chain-not-rewritten';

export interface ReasonSite extends Omit<ClassifiedStub, 'verdict' | 'once'> {
  readonly verdict: ReasonVerdict;
}

const reasons: Readonly<Record<ReasonVerdict, string>> = {
  erased:
    'the mock reset runs before the story renders, so this stub never takes effect',
  'order-dependent':
    'another story in this file resets mocks before it renders, which erases this stub when that story renders first',
  unknown:
    "the file's parameters.test cannot be read without running it, so whether the mock reset erases this stub is unknown",
  'once-not-rewritten':
    'the mock transformer does not rewrite *Once stubs, so the mock reset still erases this stub',
  'chain-not-rewritten':
    'the mock transformer rewrites a stub only when it is the first of its chain, so the mock reset still erases this stub',
};

const fix =
  'pass the implementation to fn(), as in fn(() => value), or set the stub in beforeEach';

/** The reason for a chain whose stubs have different verdicts and none is kept, since its ignore covers them all. */
export const unrewrittenChainReason = reasonText(
  'chain-not-rewritten',
  'the mock transformer rewrites neither a *Once stub nor a stub after the first of its chain, so the mock reset still erases every stub of this chain',
);

export const uncheckedFinding = {
  verdict: 'unchecked',
  reason: 'no test fails without this stub, so no play checks what it changes',
  fix: 'assert in the play what the stubbed value changes',
} as const;

export interface SpyStubReason {
  readonly verdict: ReasonVerdict;
  readonly reason: string;
  readonly fix: string;
}

/** A node the lz-storybook ignorer ignores: a stub call with every stub before it in its chain, or only its arguments. */
export interface StubIgnore {
  readonly start: number;
  readonly end: number;
  readonly covers: 'call' | 'arguments';
  readonly reason: string;
}

export function reasonSites(
  file: StoryFile,
  { previewTest, testTags, transformer }: StorybookProject,
): readonly ReasonSite[] {
  const { stubs } = classifyStubs(file, previewTest, testTags);

  return siteReasons(stubs, transformer);
}

/** Stryker ignores the whole subtree of an ignored node, so a stub call is ignored only when no stub before it in its chain is kept. */
export function stubIgnores(
  file: StoryFile,
  { previewTest, testTags, transformer }: StorybookProject,
): readonly StubIgnore[] {
  const { stubs } = classifyStubs(file, previewTest, testTags);
  const sites = siteReasons(stubs, transformer);

  return sites.map(({ start, end, verdict }) => {
    const chain = chainUpTo({ start, end }, sites);

    if (chain.length < chainUpTo({ start, end }, stubs).length) {
      return {
        start,
        end,
        covers: 'arguments',
        reason: spyStubReason(verdict),
      };
    }

    return {
      start,
      end,
      covers: 'call',
      reason: chain.every((site) => site.verdict === verdict)
        ? spyStubReason(verdict)
        : unrewrittenChainReason,
    };
  });
}

function siteReasons(
  stubs: readonly ClassifiedStub[],
  transformer: StorybookProject['transformer'],
): readonly ReasonSite[] {
  return stubs.flatMap(({ once, verdict, ...site }): readonly ReasonSite[] => {
    if (verdict === 'kept') {
      return [];
    }

    if (transformer !== 'seen') {
      return [{ ...site, verdict }];
    }

    if (once) {
      return [{ ...site, verdict: 'once-not-rewritten' }];
    }

    return chainUpTo(site, stubs).length > 1
      ? [{ ...site, verdict: 'chain-not-rewritten' }]
      : [];
  });
}

export function describeVerdict(verdict: ReasonVerdict): SpyStubReason {
  return { verdict, reason: reasons[verdict], fix };
}

export function spyStubReason(verdict: ReasonVerdict): string {
  return reasonText(verdict, reasons[verdict]);
}

function reasonText(verdict: ReasonVerdict, reason: string): string {
  return `${storybookPluginName}: ${verdict}: ${reason}; ${fix}`;
}
