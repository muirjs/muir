import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import { field, isRecord, propertyKey } from '@layzee/storybook-core';

import {
  type Case,
  type ComposeSkips,
  composeSkips,
  type HarnessContext,
  type Skip,
} from '../src/compose-skips.ts';

interface Run {
  /** The name the harness registers its test under. */
  readonly name: string;
  /** Each row's failure, or `undefined` for a row that passed. */
  readonly rows: ReadonlyMap<string, string | undefined>;
  /** Each row's notes, as `<row>: <note>`. */
  readonly notes: readonly string[];
  readonly diagnostics: readonly string[];
  /** The message of the run's own last check that failed, if one did. */
  readonly error: string | undefined;
  /** The layer of each story composed with every property, once for each property cut. */
  readonly composed: readonly unknown[];
}

/** A mutator that skips every property named by a key of `reasons`, with one proof for each of its reasons. */
function skipsOfKeys(
  reasons: Readonly<Record<string, readonly string[]>>,
): ComposeSkips['skipsOf'] {
  return (program) => {
    const skips = new Map<unknown, readonly Skip[]>();

    program.traverse({
      ObjectProperty(path) {
        const key = propertyKey(path.node);
        const proofs = typeof key === 'string' ? (reasons[key] ?? []) : [];

        if (proofs.length > 0) {
          skips.set(path.parent, [
            ...(skips.get(path.parent) ?? []),
            ...proofs.map((reason) => ({ property: path.node, reason })),
          ]);
        }
      },
    });

    return skips;
  };
}

/** A mutator that skips every property named `key`, with `reason`. */
function skipsOfKey(
  key: string,
  reason = 'same-as-below',
): ComposeSkips['skipsOf'] {
  return skipsOfKeys({ [key]: [reason] });
}

/**
 * Runs the harness's test on a context that records what each row and the run report. `whileRegistered` runs as
 * the first row's result is reported, while the harness's module hook is in place.
 */
async function run(
  options: Pick<ComposeSkips, 'cases'> & Partial<ComposeSkips>,
  whileRegistered?: () => Promise<void>,
): Promise<Run> {
  const tests: { name: string; fn: (t: HarnessContext) => Promise<void> }[] =
    [];
  const composed: unknown[] = [];
  const { same = isDeepStrictEqual } = options;
  composeSkips(
    {
      skipsOf: skipsOfKey('label'),
      layer: 'args',
      unloadable: new Map(),
      reasonsRowsMustCut: [],
      ...options,
      same: (withProperty, withoutProperty) => {
        composed.push(withProperty);

        return same(withProperty, withoutProperty);
      },
    },
    (name, fn) => tests.push({ name, fn }),
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
      if (rows.size === 0) {
        await whileRegistered?.();
      }

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
    await test.fn(context);
  } catch (thrown) {
    error = thrown instanceof Error ? thrown.message : String(thrown);
  } finally {
    afters.reverse().forEach((fn) => fn());
  }

  return { name: test.name, rows, notes, diagnostics, error, composed };
}

function file(...lines: readonly string[]): string {
  return `${lines.join('\n')}\n`;
}

const same: Case = {
  id: 'same',
  source:
    "export default { title: 'a', args: { label: 'x' } };\nexport const Story = { args: { label: 'x' } };\n",
};

describe('composeSkips', () => {
  it('passes a row where removing each skipped property leaves every story the same, and counts what it checked', async () => {
    const { name, rows, notes, diagnostics, error } = await run({
      cases: [same],
      reasonsRowsMustCut: ['same-as-below'],
    });

    assert.equal(
      name,
      'removing a property the mutator skips leaves every composed story the same',
    );
    assert.deepEqual([...rows], [['same', undefined]]);
    assert.deepEqual(notes, []);
    assert.deepEqual(diagnostics, [
      'rows composed: 1 of 1',
      'proofs checked: same-as-below 2',
      'properties cut: 2 compose the same, 0 compose differently',
      'unloadable rows: 0 with proofs (), 0 without',
    ]);
    assert.equal(error, undefined);
  });

  it('fails a row where removing a skipped property changes a story, naming the property, the story and both values on one line', async () => {
    const { rows, diagnostics } = await run({
      cases: [
        {
          id: 'changes',
          source:
            "export default { title: 'a' };\nexport const Story = { args: { label: { a: { b: { c: 'a value that runs past eighty characters on its own line' } } } } };\n",
        },
      ],
    });

    assert.deepEqual(
      [...rows],
      [
        [
          'changes',
          "changes: removing label (same-as-below) changes the args of Story: with it { label: { a: { b: { c: 'a value that runs past eighty characters on its own line' } } } }, without it {}",
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
    const { rows, diagnostics } = await run({
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
    assert.ok(
      diagnostics.includes(
        'properties cut: 0 compose the same, 1 compose differently',
      ),
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
      cases: [same, broken, { ...broken, id: 'also' }],
      unloadable: new Map([
        ['broken', 'it throws on import'],
        ['also', 'it throws on import'],
      ]),
    });

    assert.equal(
      unlisted.rows.get('broken'),
      'broken has 1 proofs but cannot load: no import',
    );
    assert.equal(listed.rows.get('broken'), undefined);
    assert.deepEqual(listed.notes, [
      'broken: cannot load: no import',
      'also: cannot load: no import',
    ]);
    assert.deepEqual(
      listed.diagnostics.filter((line) => /^(rows|unloadable)/.test(line)),
      [
        'rows composed: 1 of 3',
        'unloadable rows: 2 with proofs (broken, also), 0 without',
      ],
    );
    assert.equal(listed.error, undefined);
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
    assert.deepEqual(unlisted.notes, []);
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

  it('fails a row the unloadable list names that loads, and cuts nothing in it', async () => {
    const { rows, notes, diagnostics } = await run({
      cases: [same, { ...same, id: 'loads' }],
      unloadable: new Map([['loads', 'a reason']]),
    });

    assert.equal(
      rows.get('loads'),
      'loads is listed as unloadable (a reason) but loads',
    );
    assert.deepEqual(notes, []);
    assert.deepEqual(diagnostics, [
      'rows composed: 2 of 2',
      'proofs checked: same-as-below 2',
      'properties cut: 2 compose the same, 0 compose differently',
      'unloadable rows: 0 with proofs (), 0 without',
    ]);
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

  it('names every reason of a cut property, and counts each reason it checked', async () => {
    const { rows, diagnostics, error } = await run({
      cases: [
        {
          id: 'both',
          source:
            "export default { title: 'a', args: { label: 'x', other: 1 } };\nexport const Story = { args: { label: 'x', other: 1 } };\n",
        },
        {
          id: 'changes',
          source:
            "export default { title: 'a' };\nexport const Story = { args: { label: 'x' } };\n",
        },
      ],
      skipsOf: skipsOfKeys({
        label: ['same-as-below', 'overridden'],
        other: ['overridden'],
      }),
      reasonsRowsMustCut: ['overridden'],
    });

    assert.deepEqual(
      [...rows],
      [
        ['both', undefined],
        [
          'changes',
          "changes: removing label (same-as-below, overridden) changes the args of Story: with it { label: 'x' }, without it {}",
        ],
      ],
    );
    assert.ok(
      diagnostics.includes('proofs checked: same-as-below 3, overridden 5'),
    );
    assert.equal(error, undefined);
  });

  it('passes the run when each proof reason the rows must cut is cut for one property, not for all', async () => {
    const { error } = await run({
      cases: [
        {
          id: 'both',
          source:
            "export default { title: 'a', args: { label: 'x', other: 1 } };\nexport const Story = { args: { label: 'x', other: 1 } };\n",
        },
      ],
      skipsOf: skipsOfKeys({
        label: ['same-as-below'],
        other: ['overridden'],
      }),
      reasonsRowsMustCut: ['same-as-below', 'overridden'],
    });

    assert.equal(error, undefined);
  });

  it('stands in a stub for each import and free name, which a story can call, spread, iterate and read the file’s keys from', async () => {
    const globals = Object.getOwnPropertyNames(globalThis);
    const { rows, composed } = await run({
      cases: [
        {
          id: 'stubs',
          source: file(
            "import Button from './button';",
            "import { make, list, defaults } from '../shared/data';",
            "import { fn } from 'virtual:spies?raw';",
            "import * as everything from './everything';",
            "export default { title: 'a', component: Button, args: { label: 'x' } };",
            'export const Story = {',
            '  args: {',
            "    label: 'x',",
            '    spread: { ...defaults },',
            '    called: make(),',
            '    claimed: make().label.label,',
            '    unclaimed: make().other,',
            '    items: [...list],',
            '    free: undeclared,',
            '    alsoFree: alsoUndeclared,',
            '    max: Math.max(1, 2),',
            '    tuple: [1, 2] as const,',
            '    spy: fn,',
            '    button: Button,',
            '    everything,',
            '  },',
            '};',
          ),
        },
      ],
    });

    assert.deepEqual([...rows], [['stubs', undefined]]);
    const [args] = composed;
    assert.ok(isRecord(args));
    const { spread, called, claimed, unclaimed, items, free, alsoFree } = args;
    assert.ok(isRecord(spread));
    assert.deepEqual(Object.keys(spread), [
      'args',
      'globals',
      'title',
      'component',
      'label',
      'spread',
      'called',
      'claimed',
      'unclaimed',
      'items',
      'free',
      'alsoFree',
      'max',
      'tuple',
      'spy',
      'button',
      'everything',
    ]);
    assert.equal(new Set(Object.values(spread)).size, 1);
    assert.equal(typeof called, 'function');
    assert.equal(claimed, called);
    assert.equal(unclaimed, undefined);
    assert.deepEqual(items, []);
    assert.equal(
      new Set([
        called,
        free,
        alsoFree,
        args['spy'],
        args['button'],
        ...Object.values(spread),
      ]).size,
      6,
    );
    assert.equal(args['max'], 2);
    assert.deepEqual(args['tuple'], [1, 2]);
    const { everything } = args;
    assert.ok(isRecord(everything));
    assert.deepEqual(Object.keys(everything), []);
    assert.deepEqual(Object.getOwnPropertyNames(globalThis), globals);
  });

  it('composes a factory story and each of its .test() children', async () => {
    const { rows } = await run({
      cases: [
        {
          id: 'factory',
          source: file(
            "import preview from '../.storybook/preview';",
            "const meta = preview.meta({ title: 'a' });",
            "export const Story = meta.story({ args: { label: 'x' } });",
            "Story.test('first', () => {});",
            "Story.test('second', () => {});",
          ),
        },
      ],
    });

    assert.deepEqual(
      [...rows],
      [
        [
          'factory',
          [
            "factory: removing label (same-as-below) changes the args of Story: with it { label: 'x' }, without it {}",
            "factory: removing label (same-as-below) changes the args of Story .test() 1: with it { label: 'x' }, without it {}",
            "factory: removing label (same-as-below) changes the args of Story .test() 2: with it { label: 'x' }, without it {}",
          ].join('\n'),
        ],
      ],
    );
  });

  it('composes the globals layer when asked to', async () => {
    const { rows, composed } = await run({
      cases: [
        {
          id: 'globals',
          source:
            "export default { title: 'a', globals: { theme: 'dark' } };\nexport const Story = { globals: { theme: 'dark' } };\n",
        },
      ],
      skipsOf: skipsOfKey('theme'),
      layer: 'globals',
    });

    assert.deepEqual([...rows], [['globals', undefined]]);
    assert.equal(Reflect.get(Object(composed[0]), 'theme'), 'dark');
  });

  it('lets a stub stand in for the args and globals of a meta, and never for a key Storybook reads while composing', async () => {
    const { rows, composed } = await run({
      cases: [
        {
          id: 'meta',
          source: file(
            "import { shared, story } from './shared';",
            "export default { title: 'a', id: 'a', play: async () => {}, tags: ['t'], ...shared };",
            "export const Story = { parameters: { label: 'x' } };",
            "export const Spread = { args: { label: 'x' }, ...story };",
          ),
        },
      ],
    });

    assert.deepEqual([...rows], [['meta', undefined]]);
    const [args] = composed;
    assert.ok(isRecord(args));
    assert.deepEqual(Object.keys(args), [
      'args',
      'globals',
      'title',
      'parameters',
      'label',
    ]);
  });

  it('reads each case under its id as a story file name', async () => {
    const names: unknown[] = [];
    const skips = skipsOfKey('label');
    await run({
      cases: [same],
      skipsOf: (program) => {
        names.push(
          basename(String(field(program, 'hub', 'file', 'opts', 'filename'))),
        );

        return skips(program);
      },
    });

    assert.deepEqual(names, ['same.stories.ts']);
  });

  it('leaves an import from outside its temporary folder to Node.js while its module hook is in place', async () => {
    const outside = 'data:text/javascript,export default "outside"';
    const imported: unknown[] = [];
    await run({ cases: [same] }, async () => {
      const module: unknown = await import(outside);
      imported.push(field(module, 'default'));
    });

    assert.deepEqual(imported, ['outside']);
  });
});
