// The hints read the interaction sites from the LzStorybookInteraction mutants in the report, so every case runs the
// real instrumenter with the real test mutators.
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { lzStorybookTestMutators } from '@layzee/stryker-storybook-test-mutators';
import type { schema } from '@stryker-mutator/api/core';

import {
  interactionHints,
  interactionMutatorNames,
  type ReportFiles,
} from '../src/interaction-hints.ts';
import { inPlay, interactionHintCases } from './interaction-hint-cases.ts';
import { instrument } from './support/instrument.ts';

const fixtures = fileURLToPath(new URL('fixtures/', import.meta.url));
const file = 'src/Form.stories.tsx';

/** A report of `source` in which the `listed` mutants have `status`, the others are Killed, or Ignored when Stryker ignores them. */
async function reportOf(
  source: string,
  listed: readonly (readonly [string, number])[],
  status: schema.MutantStatus = 'Survived',
): Promise<ReportFiles> {
  const { mutants } = await instrument(
    join(fixtures, 'no-main', file),
    source,
    [],
  );

  return {
    [file]: {
      source,
      mutants: mutants.map(({ mutatorName, line, location, ignoreReason }) => ({
        mutatorName,
        location,
        status: statusOf(ignoreReason, mutatorName, line),
      })),
    },
  };

  function statusOf(
    ignoreReason: string | undefined,
    mutatorName: string,
    line: number,
  ): schema.MutantStatus {
    if (ignoreReason !== undefined) {
      return 'Ignored';
    }

    return listed.some(([name, at]) => name === mutatorName && at === line)
      ? status
      : 'Killed';
  }
}

const [negativeOnly] = interactionHintCases;

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
        interactionHints(report, [], failOnWarning).map(
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
            [],
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
              ({ mutatorName, line: at, ignoreReason }) =>
                at === line &&
                ignoreReason === undefined &&
                names.includes(mutatorName) &&
                survived.some(
                  ([name, survivedAt]) =>
                    name === mutatorName && survivedAt === at,
                ),
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

    assert.deepEqual(interactionHints(report, [], failOnWarning), []);
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
        [],
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

  it('warns once and gives the file no hint when an interaction survivor lies in no LzStorybookInteraction mutant', async () => {
    assert.ok(negativeOnly !== undefined);

    const { [file]: placed } = await reportOf(negativeOnly.source, [
      ['LzStorybookClickFocus', 5],
      ['LzStorybookInteractionRepeat', 5],
    ]);
    const warnings: string[] = [];

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
        [],
        (message) => warnings.push(message),
      ),
      [],
    );
    assert.deepEqual(warnings, [
      '@layzee/stryker-storybook: src/Form.stories.tsx has a surviving interaction mutant outside every LzStorybookInteraction mutant, so lz-storybook gave it no interaction hints',
    ]);
  });

  it('says once that a file a line-range mutate pattern names gets no hint', async () => {
    assert.ok(negativeOnly !== undefined);

    const warnings: string[] = [];

    assert.deepEqual(
      interactionHints(
        await reportOf(negativeOnly.source, negativeOnly.survived),
        ['src/**/*.ts', `${file}:5-6`],
        (message) => warnings.push(message),
      ),
      [],
    );
    assert.deepEqual(warnings, [
      `@layzee/stryker-storybook: the mutate pattern ${file}:5-6 gives ${file} a line range, so lz-storybook gave it no interaction hints: an interaction outside the range has no LzStorybookInteraction mutant to end a hint's window`,
    ]);
  });

  it('gives no hint for a file a line-range pattern names by its absolute path', async () => {
    assert.ok(negativeOnly !== undefined);

    const warnings: string[] = [];

    assert.deepEqual(
      interactionHints(
        await reportOf(negativeOnly.source, negativeOnly.survived),
        [`${resolve(file)}:1-20`],
        (message) => warnings.push(message),
      ),
      [],
    );
    assert.equal(warnings.length, 1, warnings.join('\n'));
  });

  it('reads no file without a surviving interaction mutant', async () => {
    assert.ok(negativeOnly !== undefined);

    const { [file]: killed } = await reportOf(negativeOnly.source, []);

    assert.ok(killed !== undefined);
    assert.deepEqual(
      interactionHints(
        { [file]: { ...killed, source: 'export const = ;' } },
        [],
        failOnWarning,
      ),
      [],
    );
  });
});
