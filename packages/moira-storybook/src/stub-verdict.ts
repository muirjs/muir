import {
  muirMoiraStorybookClassifyStubs,
  type MuirMoiraStorybookClassifiedStub,
  type MuirMoiraStorybookStoryFile,
  type MuirMoiraStorybookStubVerdict,
} from './reset-setting.ts';
import type { MuirMoiraStorybookProject } from './storybook-project.ts';
import {
  muirMoiraStorybookChainUpTo,
  muirMoiraStorybookMockTransformerRewrite,
  type MuirMoiraStorybookStubRewrite,
} from './stub-shape.ts';

export const muirMoiraStorybookShadowcatPluginName = 'muir-shadowcat-storybook';

/** The mutator whose surviving mutants make unchecked stubs: it removes a stub, where `MuirProteusStorybookTestSpyStubOutcome` only flips how a stub settles. */
export const muirMoiraStorybookSpyStubName = 'MuirProteusStorybookTestSpyStub';

/** The mutator that flips how a stub settles; its surviving mutants make outcome-unchecked stubs where the stub's removal is detected. */
export const muirMoiraStorybookSpyStubOutcomeName =
  'MuirProteusStorybookTestSpyStubOutcome';

export type MuirMoiraStorybookReasonVerdict =
  | Exclude<MuirMoiraStorybookStubVerdict, 'kept'>
  | Exclude<MuirMoiraStorybookStubRewrite, 'rewritten'>;

export interface MuirMoiraStorybookReasonSite
  extends Omit<MuirMoiraStorybookClassifiedStub, 'verdict'> {
  readonly verdict: MuirMoiraStorybookReasonVerdict;
}

const reasons: Readonly<Record<MuirMoiraStorybookReasonVerdict, string>> = {
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
  'spy-arguments-not-rewritten':
    'the mock transformer does not rewrite a stub whose spy call takes arguments, as in fn(impl), since the rewrite would replace them, so the mock reset still erases this stub',
};

const fix =
  'pass the implementation to fn(), as in fn(() => value), or return the value from the function fn() already takes, or set the stub in beforeEach';

/** The reason for a chain whose stubs have different verdicts and none is kept, since its ignore covers them all. */
export const muirMoiraStorybookUnrewrittenChainReason = reasonText(
  'chain-not-rewritten',
  'the mock transformer rewrites none of the stubs of this chain, so the mock reset still erases every one of them',
);

export const muirMoiraStorybookUncheckedFinding = {
  verdict: 'unchecked',
  reason: 'no test fails without this stub, so no play checks what it changes',
  fix: 'assert in the play what the stubbed value changes',
} as const;

export const muirMoiraStorybookOutcomeUncheckedFinding = {
  verdict: 'outcome-unchecked',
  reason:
    'a test fails or hangs without this stub, but none fails when it settles the other way, so no play checks what its outcome changes',
  fix: 'assert in the play what the story shows for this outcome, such as its success or error message',
} as const;

export interface MuirMoiraStorybookSpyStubReason {
  readonly verdict: MuirMoiraStorybookReasonVerdict;
  readonly reason: string;
  readonly fix: string;
}

/** A node the muir-shadowcat-storybook ignorer ignores: a stub call with everything before it in its chain (the spy call, every stub and any `mockName` or `mockClear` call, with their arguments), or only its arguments. */
export interface MuirMoiraStorybookStubIgnore {
  /** Where the stub call starts, also when only its arguments are ignored. */
  readonly start: number;
  /** Where the stub call ends, also when only its arguments are ignored. */
  readonly end: number;
  readonly covers: 'call' | 'arguments';
  readonly reason: string;
}

export function muirMoiraStorybookReasonSites(
  file: MuirMoiraStorybookStoryFile,
  { previewTest, testTags, transformer }: MuirMoiraStorybookProject,
): readonly MuirMoiraStorybookReasonSite[] {
  const { stubs } = muirMoiraStorybookClassifyStubs(
    file,
    previewTest,
    testTags,
  );

  return siteReasons(stubs, transformer);
}

/** Stryker ignores the whole subtree of an ignored node, so a stub call is ignored only when no stub before it in its chain is kept and its spy call takes no arguments; otherwise only its own arguments are. */
export function muirMoiraStorybookStubIgnores(
  file: MuirMoiraStorybookStoryFile,
  { previewTest, testTags, transformer }: MuirMoiraStorybookProject,
): readonly MuirMoiraStorybookStubIgnore[] {
  const { stubs } = muirMoiraStorybookClassifyStubs(
    file,
    previewTest,
    testTags,
  );
  const sites = siteReasons(stubs, transformer);

  return sites.map((site) => {
    const { start, end, verdict } = site;
    const chain = muirMoiraStorybookChainUpTo(site, sites);

    // Ignoring the call would also hide the spy call's arguments, which the story runs after the mock reset.
    if (
      chain.length < muirMoiraStorybookChainUpTo(site, stubs).length ||
      site.spyCallHasArguments
    ) {
      return {
        start,
        end,
        covers: 'arguments',
        reason: muirMoiraStorybookSpyStubReason(verdict),
      };
    }

    return {
      start,
      end,
      covers: 'call',
      reason: chain.every((other) => other.verdict === verdict)
        ? muirMoiraStorybookSpyStubReason(verdict)
        : muirMoiraStorybookUnrewrittenChainReason,
    };
  });
}

function siteReasons(
  stubs: readonly MuirMoiraStorybookClassifiedStub[],
  transformer: MuirMoiraStorybookProject['transformer'],
): readonly MuirMoiraStorybookReasonSite[] {
  return stubs.flatMap(
    ({ verdict, ...site }): readonly MuirMoiraStorybookReasonSite[] => {
      if (verdict === 'kept') {
        return [];
      }

      if (transformer !== 'seen') {
        return [{ ...site, verdict }];
      }

      const rewrite = muirMoiraStorybookMockTransformerRewrite(site);

      return rewrite === 'rewritten' ? [] : [{ ...site, verdict: rewrite }];
    },
  );
}

export function muirMoiraStorybookDescribeVerdict(
  verdict: MuirMoiraStorybookReasonVerdict,
): MuirMoiraStorybookSpyStubReason {
  return { verdict, reason: reasons[verdict], fix };
}

export function muirMoiraStorybookSpyStubReason(
  verdict: MuirMoiraStorybookReasonVerdict,
): string {
  return reasonText(verdict, reasons[verdict]);
}

function reasonText(
  verdict: MuirMoiraStorybookReasonVerdict,
  reason: string,
): string {
  return `${muirMoiraStorybookShadowcatPluginName}: ${verdict}: ${reason}; ${fix}`;
}
