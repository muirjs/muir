import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sitesOf } from '../src/sites.ts';
import { bodyOf } from './support/body-of.ts';

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
      ),
      [],
    );
  });
});
