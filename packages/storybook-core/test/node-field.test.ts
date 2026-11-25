import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fileNameOf } from '../src/node-field.ts';

describe('fileNameOf', () => {
  it("gives the file name Babel's File holds for a path", () => {
    assert.equal(
      fileNameOf({
        hub: { file: { opts: { filename: 'Button.stories.ts' } } },
      }),
      'Button.stories.ts',
    );
  });

  it('gives undefined for a path whose File has no file name', () => {
    assert.equal(fileNameOf({ hub: { file: { opts: {} } } }), undefined);
  });

  it('gives undefined for a file name that is not a string', () => {
    assert.equal(
      fileNameOf({ hub: { file: { opts: { filename: 1 } } } }),
      undefined,
    );
  });
});
