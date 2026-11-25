import {
  csfShapes,
  field,
  type Interaction,
  interactionsOf,
  type StoryInteractions,
} from '@layzee/storybook-core';
import type { schema } from '@stryker-mutator/api/core';

import { type InteractionShape, shapesOf } from './interaction-shapes.ts';
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
 * One hint per line and shape of the surviving interaction mutants in `files`; `warn` names each file or survivor that
 * gets none for a reason the run should show.
 */
export function interactionHints(
  files: ReportFiles,
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

    const interactions = interactionsOfSource(source, file, warn);

    if (interactions === undefined) {
      return [];
    }

    const statements = interactions.all.flatMap((interaction) => {
      const location = locationOf(interaction.node);

      return location === undefined ? [] : [{ interaction, location }];
    });
    const shaped = survivors.flatMap(({ mutant, name }) => {
      const statement = statementHolding(statements, mutant.location.start);

      if (statement === undefined) {
        const { line, column } = mutant.location.start;
        warn(
          `${packageName}: ${file}:${line}:${column} has a surviving interaction mutant outside every interaction, so lz-storybook gave it no interaction hint`,
        );

        return [];
      }

      const [shape] = shapesOf(statement.interaction, interactions);

      return shape === undefined ? [] : [{ mutant, name, shape }];
    });

    return groupedHints(file, mutants, shaped);
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

/** The interactions of `source`; `undefined`, after a warning naming `file`, when Babel cannot parse it or reading it fails. */
function interactionsOfSource(
  source: string,
  file: string,
  warn: (message: string) => void,
): StoryInteractions | undefined {
  let program: ReturnType<typeof parseProgram>;

  try {
    program = parseProgram(source, file);
  } catch (error) {
    warn(
      `${packageName}: Babel could not parse ${file}, so lz-storybook gave no interaction hints for it: ${error instanceof Error ? error.message : String(error)}`,
    );

    return undefined;
  }

  return skippedOnRangeError(
    () => interactionsOf(program, csfShapes(program)),
    (message) =>
      warn(
        `${packageName}: lz-storybook could not read the interactions of ${file}, so it gave no interaction hints for it: ${message}`,
      ),
  );
}

/**
 * What `read` gives, or `undefined` once `warn` has the message of any `RangeError` it throws: a crafted deep file
 * overflows the stack with one, but a reader bug such as `'x'.repeat(-1)` is skipped the same way. Any other error
 * propagates.
 */
export function skippedOnRangeError<T>(
  read: () => T,
  warn: (message: string) => void,
): T | undefined {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    warn(error.message);

    return undefined;
  }
}

/** An interaction with the range of its statement in the report. */
interface InteractionStatement {
  readonly interaction: Interaction;
  readonly location: schema.Location;
}

/** The innermost statement whose range holds `position`, the one that starts last: a target literal lies inside its interaction. */
function statementHolding(
  statements: readonly InteractionStatement[],
  position: schema.Position,
): InteractionStatement | undefined {
  const holding = statements.filter(
    ({ location: { start, end } }) =>
      !isBefore(position, start) && !isBefore(end, position),
  );

  return holding.find(({ location: { start } }) =>
    holding.every((other) => !isBefore(start, other.location.start)),
  );
}

function isBefore(first: schema.Position, second: schema.Position): boolean {
  return (
    first.line < second.line ||
    (first.line === second.line && first.column < second.column)
  );
}

/** The report's 1-based range of an interaction's statement, whose Babel columns are 0-based; `undefined` for a statement with no `loc`. */
function locationOf(node: Interaction['node']): schema.Location | undefined {
  const start = field(node, 'loc', 'start');
  const end = field(node, 'loc', 'end');
  const startLine = field(start, 'line');
  const startColumn = field(start, 'column');
  const endLine = field(end, 'line');
  const endColumn = field(end, 'column');

  return typeof startLine === 'number' &&
    typeof startColumn === 'number' &&
    typeof endLine === 'number' &&
    typeof endColumn === 'number'
    ? {
        // Stryker disable next-line ArithmeticOperator: a survivor starts at its interaction statement's start or at a node at least two columns inside it, so moving the first column two to the left lets no other survivor in
        start: { line: startLine, column: startColumn + 1 },
        // Stryker disable next-line ArithmeticOperator: a survivor starts at an interaction statement's start or at a node that ends before the statement's closing parenthesis, so moving the last column two to the left lets none out
        end: { line: endLine, column: endColumn + 1 },
      }
    : undefined;
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
