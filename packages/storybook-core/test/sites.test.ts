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
});
