import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirMoiraStorybookFileNameOf } from '../src/node-field.ts';

describe('fileNameOf', () => {
  it("gives the file name Babel's File holds for a path", () => {
    assert.equal(
      muirMoiraStorybookFileNameOf({
        hub: { file: { opts: { filename: 'Button.stories.ts' } } },
      }),
      'Button.stories.ts',
    );
  });

  it('gives undefined for a path whose File has no file name', () => {
    assert.equal(
      muirMoiraStorybookFileNameOf({ hub: { file: { opts: {} } } }),
      undefined,
    );
  });

  it('gives undefined for a file name that is not a string', () => {
    assert.equal(
      muirMoiraStorybookFileNameOf({
        hub: { file: { opts: { filename: 1 } } },
      }),
      undefined,
    );
  });
});
