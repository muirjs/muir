import { field, stubMethodOf } from '@layzee/storybook-csf';

import { parseProgram } from './parse.ts';
import {
  classifyStubs,
  type ClassifiedStub,
  type StoryFile,
  type StubVerdict,
} from './reset-setting.ts';
import type { StorybookProject } from './storybook-project.ts';

export const storybookPluginName = 'lz-storybook';

export const spyStubName = 'LzStorybookSpyStub';

/**
 * An `LzStorybookSpyStub` outcome mutant, which makes a resolved stub reject or a rejected one resolve and so still
 * calls a stub method, where a removal mutant leaves the stub's receiver or `;`. Whether a check reads the stub is the
 * removal mutant's to tell.
 */
export function isOutcomeMutant(
  replacement: string | undefined,
  fileName: string,
): boolean {
  const [statement] =
    replacement === undefined ? [] : parseProgram(replacement, fileName).body;

  return (
    stubMethodOf(
      field(statement, 'expression', 'callee', 'property', 'name'),
    ) !== undefined
  );
}

export type ReasonVerdict = Exclude<StubVerdict, 'kept'> | 'once-not-rewritten';

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
};

const fix =
  'pass the implementation to fn(), as in fn(() => value), or set the stub in beforeEach';

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

export function reasonSites(
  file: StoryFile,
  { previewTest, testTags, transformer }: StorybookProject,
): readonly ReasonSite[] {
  return classifyStubs(file, previewTest, testTags).stubs.flatMap(
    ({ once, verdict, ...site }): readonly ReasonSite[] => {
      if (verdict === 'kept') {
        return [];
      }

      if (transformer === 'seen') {
        return once ? [{ ...site, verdict: 'once-not-rewritten' }] : [];
      }

      return [{ ...site, verdict }];
    },
  );
}

export function describeVerdict(verdict: ReasonVerdict): SpyStubReason {
  return { verdict, reason: reasons[verdict], fix };
}

export function spyStubReason(verdict: ReasonVerdict): string {
  return `${storybookPluginName}: ${verdict}: ${reasons[verdict]}; ${fix}`;
}
