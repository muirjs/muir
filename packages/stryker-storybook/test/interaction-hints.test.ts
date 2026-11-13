// The hints name a mutator only when every mutant of it placed on the line survived, so every case runs the real
// instrumenter with the real test mutators.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { csfShapes, interactionsOf } from '@layzee/storybook-core';
import { lzStorybookTestMutators } from '@layzee/stryker-storybook-test-mutators';
import type { schema } from '@stryker-mutator/api/core';

import {
  interactionHints,
  interactionMutatorNames,
  type ReportFiles,
} from '../src/interaction-hints.ts';
import { shapesOf } from '../src/interaction-shapes.ts';
import { parseProgram } from '../src/parse.ts';
import {
  inPlay,
  interactionHintCases,
  survives,
  type Survivor,
} from './interaction-hint-cases.ts';
import { instrument } from './support/instrument.ts';

const fixtures = fileURLToPath(new URL('fixtures/', import.meta.url));
const file = 'src/Form.stories.tsx';

/** A report of `source` in which the `listed` mutants have `status`, the others are Killed, or Ignored when Stryker ignores them; a listed mutant the test mutators do not place throws. */
async function reportOf(
  source: string,
  listed: readonly Survivor[],
  status: schema.MutantStatus = 'Survived',
): Promise<ReportFiles> {
  const { mutants } = await instrument(
    join(fixtures, 'no-main', file),
    source,
    [],
  );
  const unplaced = listed.filter(
    (survivor) =>
      !mutants.some(({ mutatorName, location }) =>
        survives([survivor], mutatorName, location.start),
      ),
  );

  if (unplaced.length > 0) {
    throw new Error(
      `no mutant is placed at the listed ${JSON.stringify(unplaced)}`,
    );
  }

  return {
    [file]: {
      source,
      mutants: mutants.map(({ mutatorName, location, ignoreReason }) => ({
        mutatorName,
        location,
        status: statusOf(ignoreReason, mutatorName, location.start),
      })),
    },
  };

  function statusOf(
    ignoreReason: string | undefined,
    mutatorName: string,
    start: schema.Position,
  ): schema.MutantStatus {
    if (ignoreReason !== undefined) {
      return 'Ignored';
    }

    return survives(listed, mutatorName, start) ? status : 'Killed';
  }
}

const [negativeOnly] = interactionHintCases;
const endsAtNextInteraction = interactionHintCases.find(
  ({ id }) => id === 'ends-at-next-interaction',
);

function failOnWarning(message: string): never {
  throw new Error(`unexpected warning: ${message}`);
}

describe('interactionHints', () => {
  before(async () => {
    await lzStorybookTestMutators({
      LzStorybookInteractionRepeat: true,
      experimental: { LzStorybookAssertionBefore: true },
    });
  });

  interactionHintCases.forEach(({ id, title, source, survived, expect }) => {
    it(`${id}: ${title}`, async () => {
      const report = await reportOf(source, survived);

      assert.deepEqual(
        interactionHints(report, failOnWarning).map(
          ({ line, shape, mutatorNames }) => [line, shape, mutatorNames],
        ),
        expect,
      );
    });
  });

  describe('a pasted comment', () => {
    interactionHintCases.forEach(({ id, source, survived, expect }) => {
      expect.forEach(([line, shape, names]) => {
        it(`${id}: the comment for line ${line} ignores exactly the survivors the case names there, with its reason`, async () => {
          const hint = interactionHints(
            await reportOf(source, survived),
            failOnWarning,
          ).find(
            (candidate) => candidate.line === line && candidate.shape === shape,
          );

          assert.ok(hint !== undefined);

          const lines = source.split('\n');
          const indent = /^\s*/.exec(lines[line - 1] ?? '')?.[0] ?? '';
          const commented = [
            ...lines.slice(0, line - 1),
            `${indent}${hint.comment}`,
            ...lines.slice(line - 1),
          ].join('\n');
          const reason = hint.comment.slice(hint.comment.indexOf(': ') + 2);
          const { mutants: before } = await instrument(
            join(fixtures, 'no-main', file),
            source,
            [],
          );
          const { mutants: after } = await instrument(
            join(fixtures, 'no-main', file),
            commented,
            [],
          );

          const named = before
            .filter(
              ({ mutatorName, line: at, location, ignoreReason }) =>
                at === line &&
                ignoreReason === undefined &&
                names.includes(mutatorName) &&
                survives(survived, mutatorName, location.start),
            )
            .map(({ mutatorName, line: at }) => [mutatorName, at]);

          assert.notDeepEqual(named, []);
          assert.deepEqual(
            after
              .filter(({ ignoreReason }) => ignoreReason === reason)
              .map(({ mutatorName, line: at }) => [
                mutatorName,
                at > line ? at - 1 : at,
              ]),
            named,
          );
        });
      });
    });
  });

  it('finds at most one shape at each interaction of every case', () => {
    const overlaps = interactionHintCases.flatMap(({ id, source }) => {
      const program = parseProgram(source, file);
      const interactions = interactionsOf(program, csfShapes(program));

      return interactions.all.flatMap((interaction, index) => {
        const shapes = shapesOf(interaction, interactions);

        return shapes.length > 1
          ? [`${id} interaction ${index} ${shapes.join(', ')}`]
          : [];
      });
    });

    assert.deepEqual(overlaps, []);
  });

  it('makes at least one mutant of each interaction mutator name, so the list matches the test mutators', async () => {
    const { mutants } = await instrument(
      join(fixtures, 'no-main', file),
      inPlay(
        "await userEvent.click(canvas.getByRole('button', { name: 'Open' }));",
        'await expect(args.onOpen).toHaveBeenCalled();',
        "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      ),
      [],
    );

    assert.deepEqual(
      interactionMutatorNames.filter(
        (name) => !mutants.some(({ mutatorName }) => mutatorName === name),
      ),
      [],
    );
  });

  it('gives no hint for a NoCoverage mutant, which no test runs', async () => {
    assert.ok(negativeOnly !== undefined);

    const report = await reportOf(
      negativeOnly.source,
      negativeOnly.survived,
      'NoCoverage',
    );

    assert.deepEqual(interactionHints(report, failOnWarning), []);
  });

  it('warns once and gives no hint for a file that Babel cannot parse', async () => {
    assert.ok(negativeOnly !== undefined);

    const { [file]: parsed } = await reportOf(
      negativeOnly.source,
      negativeOnly.survived,
    );
    const warnings: string[] = [];

    assert.ok(parsed !== undefined);
    assert.deepEqual(
      interactionHints(
        { [file]: { ...parsed, source: 'export const = ;' } },
        (message) => warnings.push(message),
      ),
      [],
    );
    assert.equal(warnings.length, 1, warnings.join('\n'));
    assert.match(
      warnings[0] ?? '',
      /^@layzee\/stryker-storybook: Babel could not parse src\/Form\.stories\.tsx, so lz-storybook gave no interaction hints for it: /,
    );
  });

  it('warns with its file and position about a survivor that lies in no interaction, and gives it no hint', async () => {
    assert.ok(negativeOnly !== undefined);

    const { [file]: placed } = await reportOf(negativeOnly.source, [
      ['LzStorybookInteraction', 5],
    ]);
    const warnings: string[] = [];

    assert.ok(placed !== undefined);
    assert.deepEqual(
      interactionHints(
        {
          [file]: {
            ...placed,
            mutants: placed.mutants.map((mutant) =>
              mutant.status === 'Survived'
                ? {
                    ...mutant,
                    location: {
                      start: { line: 1, column: 1 },
                      end: { line: 1, column: 2 },
                    },
                  }
                : mutant,
            ),
          },
        },
        (message) => warnings.push(message),
      ),
      [],
    );
    assert.deepEqual(warnings, [
      '@layzee/stryker-storybook: src/Form.stories.tsx:1:1 has a surviving interaction mutant outside every interaction, so lz-storybook gave it no interaction hint',
    ]);
  });

  it('gives a hint for a survivor whose interaction has no LzStorybookInteraction mutant, as a column range that cuts the interaction leaves out', async () => {
    assert.ok(negativeOnly !== undefined);

    const { [file]: placed } = await reportOf(negativeOnly.source, [
      ['LzStorybookClickFocus', 5],
      ['LzStorybookInteractionRepeat', 5],
    ]);

    assert.ok(placed !== undefined);
    assert.deepEqual(
      interactionHints(
        {
          [file]: {
            ...placed,
            mutants: placed.mutants.filter(
              ({ mutatorName }) => mutatorName !== 'LzStorybookInteraction',
            ),
          },
        },
        failOnWarning,
      ).map(({ line, shape, mutatorNames }) => [line, shape, mutatorNames]),
      [
        [
          5,
          'negative-only',
          ['LzStorybookClickFocus', 'LzStorybookInteractionRepeat'],
        ],
      ],
    );
  });

  it('gives hints in a file that a line-range mutate pattern names, read up to an interaction outside the range', async () => {
    assert.ok(endsAtNextInteraction !== undefined);

    const { [file]: placed } = await reportOf(
      endsAtNextInteraction.source,
      endsAtNextInteraction.survived,
    );

    assert.ok(placed !== undefined);
    assert.deepEqual(
      interactionHints(
        {
          [file]: {
            ...placed,
            mutants: placed.mutants.filter(
              ({ location }) => location.end.line <= 6,
            ),
          },
        },
        failOnWarning,
      ).map(({ line, shape, mutatorNames }) => [line, shape, mutatorNames]),
      endsAtNextInteraction.expect,
    );
  });

  it('reads no file without a surviving interaction mutant', async () => {
    assert.ok(negativeOnly !== undefined);

    const { [file]: killed } = await reportOf(negativeOnly.source, []);

    assert.ok(killed !== undefined);
    assert.deepEqual(
      interactionHints(
        { [file]: { ...killed, source: 'export const = ;' } },
        failOnWarning,
      ),
      [],
    );
  });
});
