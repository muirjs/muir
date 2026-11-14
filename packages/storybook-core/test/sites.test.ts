import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sitesOf } from '../src/sites.ts';
import { bodyOf } from './support/parse-module.ts';

describe('sitesOf', () => {
  it('gives no site for args that are not an object literal, such as the result of a call', () => {
    assert.deepEqual(
      sitesOf(
        bodyOf(
          "import { makeArgs } from './make-args';",
          "export default { title: 'a/b' };",
          'export const A = { args: makeArgs(), play: async () => {} };',
        ),
        'args',
        'Button.stories.ts',
      ),
      [],
    );
  });

  it('proves a property in a file that does not import itself', () => {
    assert.deepEqual(
      sitesOf(
        bodyOf(
          "import * as other from './Other.stories';",
          "export default { title: 'a/b', args: { label: 'a' } };",
          "export const A = { args: { label: 'a' }, play: async () => {} };",
        ),
        'args',
        'Button.stories.ts',
      ).map(({ proofs }) => proofs.map(({ reason }) => reason)),
      [['same-as-below'], []],
    );
  });

  it('proves nothing in a file that imports itself, as a write through the import changes what a story runs with', () => {
    assert.deepEqual(
      sitesOf(
        bodyOf(
          "import * as self from './Button.stories';",
          "export default { title: 'a/b', args: { label: 'a' } };",
          "export const A = { args: { label: 'a' }, play: async () => {} };",
        ),
        'args',
        'Button.stories.ts',
      ).map(({ proofs }) => proofs),
      [[], []],
    );
  });

  it('keeps every site but proves nothing when the file name is not known', () => {
    assert.deepEqual(
      sitesOf(
        bodyOf(
          "export default { title: 'a/b', args: { label: 'a' } };",
          "export const A = { args: { label: 'a' }, play: async () => {} };",
        ),
        'args',
        undefined,
      ).map(({ proofs }) => proofs),
      [[], []],
    );
  });

  it('gives the globals of a meta a run for a played story made from another meta', () => {
    assert.deepEqual(
      sitesOf(
        bodyOf(
          "import preview from '../.storybook/preview';",
          "import { Base } from './Other.stories';",
          "const meta = preview.meta({ title: 'a/b', globals: { theme: 'dark' } });",
          'export const A = Base.extend({ play: async () => {} });',
        ),
        'globals',
        'Button.stories.ts',
      ).map(({ runs }) => runs.map(({ owner }) => owner)),
      [['meta']],
    );
  });
});

describe('MetaRun keyFrom', () => {
  /** What each run of the meta's `args` answers for `key`, in the order `sitesOf` lists them. */
  function keyFromOfMetaRuns(
    key: string,
    ...lines: readonly string[]
  ): readonly unknown[] {
    return sitesOf(bodyOf(...lines), 'args', 'Button.stories.ts').flatMap(
      ({ runs }) =>
        runs.flatMap((run) => (run.owner === 'meta' ? [run.keyFrom(key)] : [])),
    );
  }

  it('says a played story takes a key it does not give from the meta', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "export default { title: 'a/b', args: { label: 'a' } };",
        'export const A = { play: async () => {} };',
      ),
      ['meta'],
    );
  });

  it('says a story that gives a key in its own args takes it from elsewhere', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "export default { title: 'a/b', args: { label: 'a' } };",
        "export const A = { args: { label: 'b' }, play: async () => {} };",
      ),
      ['elsewhere'],
    );
  });

  it('says a story takes a key its .extend() base gives from elsewhere', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import preview from '../.storybook/preview';",
        "const meta = preview.meta({ title: 'a/b', args: { label: 'a' } });",
        "export const A = meta.story({ args: { label: 'b' } });",
        'export const B = A.extend({ play: async () => {} });',
      ),
      ['elsewhere'],
    );
  });

  it('cannot tell where a story whose args are an imported object takes a key from', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import { shared } from './shared';",
        "export default { title: 'a/b', args: { label: 'a' } };",
        'export const A = { args: shared, play: async () => {} };',
      ),
      ['unknown'],
    );
  });

  it('cannot tell where a story takes a key from that a spread it cannot resolve may set', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import { shared } from './shared';",
        "export default { title: 'a/b', args: { label: 'a' } };",
        "export const A = { args: { ...shared, size: 's' }, play: async () => {} };",
      ),
      ['unknown'],
    );
  });

  it('cannot tell where a story the file writes takes a key from', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "export default { title: 'a/b', args: { label: 'a' } };",
        'export const A = { play: async () => {} };',
        "A.args = { size: 's' };",
      ),
      ['unknown'],
    );
  });

  it("says a story that spreads the meta's args takes a key it does not give itself from the meta", () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "const meta = { title: 'a/b', args: { label: 'a' } };",
        'export default meta;',
        "export const A = { args: { ...meta.args, size: 's' }, play: async () => {} };",
      ),
      ['meta'],
    );
  });

  it('says a factory story takes every key of a meta it is not made from from elsewhere', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import preview from '../.storybook/preview';",
        "const a = preview.meta({ title: 'a', args: { label: 'a' } });",
        "const b = preview.meta({ title: 'b', args: { label: 'b' } });",
        'export const A = a.story({ play: async () => {} });',
      ),
      ['meta', 'elsewhere'],
    );
  });

  it('says an .extend() story takes a key from the meta its base is made from', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import preview from '../.storybook/preview';",
        "const meta = preview.meta({ title: 'a/b', args: { label: 'a' } });",
        "export const A = meta.story({ args: { size: 's' } });",
        'export const B = A.extend({ play: async () => {} });',
      ),
      ['meta'],
    );
  });

  it('cannot tell where an .extend() story takes a key from when the file writes its base', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import preview from '../.storybook/preview';",
        "const meta = preview.meta({ title: 'a/b', args: { label: 'a' } });",
        "export const A = meta.story({ args: { size: 's' } });",
        'A.input.args = {};',
        'export const B = A.extend({ play: async () => {} });',
      ),
      ['unknown'],
    );
  });

  it('cannot tell where a factory story made through another name for the meta takes a key from', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import preview from '../.storybook/preview';",
        "const meta = preview.meta({ title: 'a/b', args: { label: 'a' } });",
        'const m = meta;',
        "export const A = m.story({ args: { label: 'b' }, play: async () => {} });",
      ),
      ['unknown'],
    );
  });

  it('cannot tell that a story gives a key itself in a file that imports itself, as a write through the import may remove it', () => {
    assert.deepEqual(
      keyFromOfMetaRuns(
        'label',
        "import * as self from './Button.stories';",
        "export default { title: 'a/b', args: { label: 'a' } };",
        "export const A = { args: { label: 'b' }, play: async () => {} };",
      ),
      ['unknown'],
    );
  });
});
