import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { field, list } from '../src/node-field.ts';
import { sitesOf } from '../src/sites.ts';

function bodyOf(...lines: readonly string[]): readonly unknown[] {
  return list(
    field(
      parse(lines.join('\n'), {
        sourceType: 'module',
        plugins: ['typescript'],
      }),
      'program',
      'body',
    ),
  );
}

describe('sitesOf', () => {
  it('gives no site for args that are no object literal, such as the result of a call', () => {
    assert.deepEqual(
      sitesOf(
        bodyOf(
          "import { makeArgs } from './make-args';",
          "export default { title: 'a/b' };",
          'export const A = { args: makeArgs(), play: async () => {} };',
        ),
        'args',
      ),
      [],
    );
  });
});
