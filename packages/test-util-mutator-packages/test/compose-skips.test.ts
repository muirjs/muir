import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import { propertyKey } from '@layzee/storybook-core';

import {
  type Case,
  type ComposeSkips,
  composeSkips,
  type HarnessContext,
  type Skip,
} from '../src/compose-skips.ts';

interface Run {
  /** Each row's failure, or `undefined` for a row that passed. */
  readonly rows: ReadonlyMap<string, string | undefined>;
  /** Each row's notes, as `<row>: <note>`. */
  readonly notes: readonly string[];
  readonly diagnostics: readonly string[];
  /** The message of the run's own last check that failed, if one did. */
  readonly error: string | undefined;
}

/** A mutator that skips every property named `key`, with `reason`. */
function skipsOfKey(
  key: string,
  reason = 'same-as-below',
): ComposeSkips['skipsOf'] {
  return (program) => {
    const skips = new Map<unknown, readonly Skip[]>();

    program.traverse({
      ObjectProperty(path) {
        if (propertyKey(path.node) === key) {
          skips.set(path.parent, [
            ...(skips.get(path.parent) ?? []),
            { property: path.node, reason },
          ]);
        }
      },
    });

    return skips;
  };
}

/** Runs the harness's test on a context that records what each row and the run report. */
async function run(
  options: Pick<ComposeSkips, 'cases'> & Partial<ComposeSkips>,
): Promise<Run> {
  const tests: ((t: HarnessContext) => Promise<void>)[] = [];
  composeSkips(
    {
      skipsOf: skipsOfKey('label'),
      layer: 'args',
      same: isDeepStrictEqual,
      unloadable: new Map(),
      reasonsRowsMustCut: [],
      ...options,
    },
    (_name, fn) => tests.push(fn),
  );
  const [test] = tests;
  assert.ok(test);
  const afters: (() => void)[] = [];
  const rows = new Map<string, string | undefined>();
  const notes: string[] = [];
  const diagnostics: string[] = [];
  const context: HarnessContext = {
    after: (fn) => afters.push(fn),
    diagnostic: (message) => {
      diagnostics.push(message);
    },
    test: async (name, fn) => {
      rows.set(name, undefined);

      try {
        fn({
          diagnostic: (note) => {
            notes.push(`${name}: ${note}`);
          },
        });
      } catch (error) {
        rows.set(name, error instanceof Error ? error.message : String(error));
      }
    },
  };
  let error: string | undefined;

  try {
    await test(context);
  } catch (thrown) {
    error = thrown instanceof Error ? thrown.message : String(thrown);
  } finally {
    afters.reverse().forEach((fn) => fn());
  }

  return { rows, notes, diagnostics, error };
}

const same: Case = {
  id: 'same',
  source:
    "export default { title: 'a', args: { label: 'x' } };\nexport const Story = { args: { label: 'x' } };\n",
};

describe('composeSkips', () => {
  it('passes a row where removing each skipped property leaves every story the same, and counts what it checked', async () => {
    const { rows, diagnostics, error } = await run({
      cases: [same],
      reasonsRowsMustCut: ['same-as-below'],
    });

    assert.deepEqual([...rows], [['same', undefined]]);
    assert.deepEqual(diagnostics, [
      'rows composed: 1 of 1',
      'proofs checked: same-as-below 2',
      'properties cut: 2 compose the same, 0 compose differently',
      'unloadable rows: 0 with proofs (), 0 without',
    ]);
    assert.equal(error, undefined);
  });

  it('fails a row where removing a skipped property changes a story, naming the property, the story and both values', async () => {
    const { rows, diagnostics } = await run({
      cases: [
        {
          id: 'changes',
          source:
            "export default { title: 'a' };\nexport const Story = { args: { label: 'x' } };\n",
        },
      ],
    });

    assert.deepEqual(
      [...rows],
      [
        [
          'changes',
          "changes: removing label (same-as-below) changes the args of Story: with it { label: 'x' }, without it {}",
        ],
      ],
    );
    assert.ok(
      diagnostics.includes(
        'properties cut: 0 compose the same, 1 compose differently',
      ),
    );
  });

  it('fails a row whose file stops loading without a skipped property', async () => {
    const { rows } = await run({
      cases: [
        {
          id: 'stops',
          source:
            "export default { title: 'a' };\nexport const Story = { args: { label: 'x' } };\nif (Story.args.label === undefined) {\n  throw new Error('label gone');\n}\n",
        },
      ],
    });

    assert.deepEqual(
      [...rows],
      [
        [
          'stops',
          'stops: removing label (same-as-below) stops the file loading: label gone',
        ],
      ],
    );
  });

  it('fails a row with proofs that cannot load, unless the unloadable list names it, where it only notes the error', async () => {
    const broken: Case = {
      id: 'broken',
      source:
        "export default { title: 'a' };\nexport const Story = { args: { label: 'x' } };\nthrow new Error('no import');\n",
    };
    const unlisted = await run({ cases: [same, broken] });
    const listed = await run({
      cases: [same, broken],
      unloadable: new Map([['broken', 'it throws on import']]),
    });

    assert.equal(
      unlisted.rows.get('broken'),
      'broken has 1 proofs but cannot load: no import',
    );
    assert.equal(listed.rows.get('broken'), undefined);
    assert.deepEqual(listed.notes, ['broken: cannot load: no import']);
    assert.deepEqual(
      listed.diagnostics.filter((line) => /^(rows|unloadable)/.test(line)),
      [
        'rows composed: 1 of 2',
        'unloadable rows: 1 with proofs (broken), 0 without',
      ],
    );
  });

  it('passes a row with no proof that cannot load, and fails it when the unloadable list names it', async () => {
    const empty: Case = {
      id: 'empty',
      source: "export default { title: 'a' };\nthrow new Error('no import');\n",
    };
    const unlisted = await run({ cases: [same, empty] });
    const listed = await run({
      cases: [same, empty],
      unloadable: new Map([['empty', 'it throws on import']]),
    });

    assert.equal(unlisted.rows.get('empty'), undefined);
    assert.ok(
      unlisted.diagnostics.includes(
        'unloadable rows: 0 with proofs (), 1 without',
      ),
    );
    assert.equal(
      listed.rows.get('empty'),
      'empty is listed as unloadable but has no proof',
    );
  });

  it('fails a row the unloadable list names that loads', async () => {
    const { rows } = await run({
      cases: [same, { ...same, id: 'loads' }],
      unloadable: new Map([['loads', 'a reason']]),
    });

    assert.equal(
      rows.get('loads'),
      'loads is listed as unloadable (a reason) but loads',
    );
  });

  it('fails the run when the unloadable list names a row no case has', async () => {
    const { error } = await run({
      cases: [same],
      unloadable: new Map([['gone', 'a reason']]),
    });

    assert.match(
      error ?? '',
      /^the unloadable list names rows no case table has/,
    );
  });

  it('fails the run when no row cuts a property, and checks no proof', async () => {
    const { diagnostics, error } = await run({
      cases: [{ id: 'none', source: "export default { title: 'a' };\n" }],
    });

    assert.ok(diagnostics.includes('proofs checked: none'));
    assert.match(error ?? '', /^no row cut a property the mutator skips/);
  });

  it('fails the run when a proof reason the rows must cut is cut by none', async () => {
    const { error } = await run({
      cases: [same],
      reasonsRowsMustCut: ['same-as-below', 'overridden'],
    });

    assert.match(error ?? '', /^proof reasons no row cut/);
  });
});
