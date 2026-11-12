import { resolve } from 'node:path';

import type { schema } from '@stryker-mutator/api/core';

import {
  interactionShapeReader,
  type InteractionShape,
} from './interaction-shapes.ts';
import { packageName } from './package-name.ts';
import { parseProgram } from './parse.ts';
import { storybookPluginName } from './stub-verdict.ts';

export const interactionMutatorNames = [
  'LzStorybookInteraction',
  'LzStorybookClickFocus',
  'LzStorybookInteractionRepeat',
  'LzStorybookInteractionTarget',
  'LzStorybookAssertionBefore',
] as const;

type InteractionMutatorName = (typeof interactionMutatorNames)[number];

/**
 * `LzStorybookInteraction` places a mutant at every interaction outside a `beforeEach` or `afterEach`, and Stryker
 * keeps a mutant it ignores in the report as Ignored, so the ranges of its mutants, whatever their status, are the
 * interactions the test mutators read.
 */
const siteMutatorName: InteractionMutatorName = 'LzStorybookInteraction';

export interface InteractionHint {
  readonly file: string;
  readonly line: number;
  readonly shape: InteractionShape;
  readonly mutatorNames: readonly InteractionMutatorName[];
  readonly reason: string;
  readonly fix: string;
  readonly comment: string;
}

export type ReportMutant = Pick<
  schema.MutantResult,
  'mutatorName' | 'status' | 'location'
>;

export type ReportFiles = Readonly<
  Record<
    string,
    Pick<schema.FileResult, 'source'> & {
      readonly mutants: readonly ReportMutant[];
    }
  >
>;

/** A surviving interaction mutant, with the shape of the interaction it belongs to. */
interface ShapedSurvivor {
  readonly mutant: ReportMutant;
  readonly name: InteractionMutatorName;
  readonly shape: InteractionShape;
}

/**
 * One hint per line and shape of the surviving interaction mutants in `files`; `warn` names each file that gets none
 * for a reason the run should show.
 */
export function interactionHints(
  files: ReportFiles,
  mutate: readonly string[],
  warn: (message: string) => void,
): readonly InteractionHint[] {
  return Object.entries(files).flatMap(([file, { source, mutants }]) => {
    const survivors = mutants.flatMap((mutant) => {
      const name = survivingName(mutant);

      return name === undefined ? [] : [{ mutant, name }];
    });

    if (survivors.length === 0) {
      return [];
    }

    const rangePattern = mutate.find((pattern) =>
      namesWithLineRange(pattern, file),
    );

    if (rangePattern !== undefined) {
      warn(
        `${packageName}: the mutate pattern ${rangePattern} gives ${file} a line range, so lz-storybook gave it no interaction hints: an interaction outside the range has no ${siteMutatorName} mutant to end a hint's window`,
      );

      return [];
    }

    const program = parsed(source, file, warn);

    if (program === undefined) {
      return [];
    }

    const sites = mutants
      .filter(({ mutatorName }) => mutatorName === siteMutatorName)
      .map(({ location }) => location);
    const shapesAt = interactionShapeReader(program, sites);
    const placed = survivors.map(({ mutant, name }) => {
      const site = siteHolding(sites, mutant.location.start);

      return {
        mutant,
        name,
        site,
        shapes: site === undefined ? undefined : shapesAt(site),
      };
    });

    if (placed.some(({ site }) => site === undefined)) {
      warn(
        `${packageName}: ${file} has a surviving interaction mutant outside every ${siteMutatorName} mutant, so lz-storybook gave it no interaction hints`,
      );

      return [];
    }

    if (placed.some(({ shapes }) => shapes === undefined)) {
      warn(
        `${packageName}: ${file} has an ${siteMutatorName} mutant whose range no node of the parsed file has, so lz-storybook gave it no interaction hints`,
      );

      return [];
    }

    return groupedHints(
      file,
      mutants,
      placed.flatMap(({ mutant, name, shapes: [shape] = [] }) =>
        shape === undefined ? [] : [{ mutant, name, shape }],
      ),
    );
  });
}

/** The interaction mutator name of a mutant that survived. */
function survivingName({
  mutatorName,
  status,
}: ReportMutant): InteractionMutatorName | undefined {
  return status === 'Survived'
    ? interactionMutatorNames.find((name) => name === mutatorName)
    : undefined;
}

// StrykerJS 10.1.1 core, src/fs/mutate-pattern-constants.ts
const mutationRange = /(.*?):((\d+)(?::(\d+))?-(\d+)(?::(\d+))?)$/;

/** StrykerJS 10.1.1 refuses a line range on a glob (src/config/options-validator.ts), so a ranged pattern names one file. */
function namesWithLineRange(pattern: string, file: string): boolean {
  const path = mutationRange.exec(pattern)?.[1];

  return path !== undefined && resolve(path) === resolve(file);
}

function parsed(
  source: string,
  file: string,
  warn: (message: string) => void,
): ReturnType<typeof parseProgram> | undefined {
  try {
    return parseProgram(source, file);
  } catch (error) {
    warn(
      `${packageName}: Babel could not parse ${file}, so lz-storybook gave no interaction hints for it: ${error instanceof Error ? error.message : String(error)}`,
    );

    return undefined;
  }
}

/** The innermost site whose range holds `position`, the one that starts last: a target literal lies inside its interaction. */
function siteHolding(
  ranges: readonly schema.Location[],
  position: schema.Position,
): schema.Location | undefined {
  const holding = ranges.filter(
    ({ start, end }) => !isBefore(position, start) && !isBefore(end, position),
  );

  return holding.find(({ start }) =>
    holding.every((other) => !isBefore(start, other.start)),
  );
}

function isBefore(first: schema.Position, second: schema.Position): boolean {
  return (
    first.line < second.line ||
    (first.line === second.line && first.column < second.column)
  );
}

/** The survivors that share a line and a shape. */
interface HintGroup {
  readonly line: number;
  readonly shape: InteractionShape;
  readonly members: readonly ShapedSurvivor[];
}

/** One hint per line and shape, naming only the mutators whose every placed mutant on that line is in it. */
function groupedHints(
  file: string,
  mutants: readonly ReportMutant[],
  shaped: readonly ShapedSurvivor[],
): readonly InteractionHint[] {
  const groups = new Map<string, HintGroup>();
  shaped.forEach((survivor) => {
    const line = survivor.mutant.location.start.line;
    const key = `${line} ${survivor.shape}`;
    groups.set(key, {
      line,
      shape: survivor.shape,
      members: [...(groups.get(key)?.members ?? []), survivor],
    });
  });

  return [...groups.values()].flatMap(({ line, shape, members }) => {
    // A next-line comment disables every mutant of a named mutator that starts on its line.
    const names = interactionMutatorNames.filter(
      (name) =>
        members.some((member) => member.name === name) &&
        mutants
          .filter(
            ({ mutatorName, status, location }) =>
              mutatorName === name &&
              status !== 'Ignored' &&
              location.start.line === line,
          )
          .every((mutant) =>
            members.some((member) => member.mutant === mutant),
          ),
    );

    return names.length === 0 ? [] : [hintOf(file, line, shape, names)];
  });
}

const shapeTexts: Readonly<
  Record<
    InteractionShape,
    { readonly reason: string; readonly fix: string; readonly short: string }
  >
> = {
  'negative-only': {
    reason:
      'every check after this interaction up to the next one is negative, so the play also passes when the interaction does nothing',
    fix: 'if the control is meant to ignore it, such as a disabled one, disable the mutant, otherwise add a check that the interaction makes true',
    short: 'every check up to the next interaction is negative',
  },
  'click-before-type': {
    reason:
      "the type in the next statement clicks the same target first (user-event 14's type does, unless given skipClick), so this click repeats it",
    fix: 'disable the mutant or remove the click, unless the click itself must do something, then add a check for that before the type',
    short: 'the next type clicks the same target first',
  },
  'cleared-later': {
    reason:
      'the next interaction clears the same target with no check between them, so nothing reads what this one leaves',
    fix: 'disable the mutant if no handler records the input, otherwise add a check of what it records before the clear',
    short: 'the next interaction clears the same target before any check',
  },
};

function hintOf(
  file: string,
  line: number,
  shape: InteractionShape,
  mutatorNames: readonly InteractionMutatorName[],
): InteractionHint {
  const { reason, fix, short } = shapeTexts[shape];

  return {
    file,
    line,
    shape,
    mutatorNames,
    reason,
    fix,
    comment: `// Stryker disable next-line ${mutatorNames.join(', ')}: ${storybookPluginName}: ${shape}: ${short}`,
  };
}
