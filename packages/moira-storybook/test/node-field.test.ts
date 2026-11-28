import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirMoiraStorybookFileNameOf,
  muirMoiraStorybookTraversedFileNameOf,
} from '../src/node-field.ts';

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

describe('traversedFileNameOf', () => {
  it('refuses a path that carries no File, naming the second copy of @babel/traverse that causes it', () => {
    assert.throws(
      () =>
        muirMoiraStorybookTraversedFileNameOf('@muirjs/shadowcat-storybook', {
          node: { type: 'Program' },
        }),
      {
        message:
          "@muirjs/shadowcat-storybook: Stryker's instrumenter walked a file without Babel's File, so the file name " +
          "is unknown. This happens when the project's install holds two copies of @babel/traverse, one for " +
          '@stryker-mutator/instrumenter and one for its @babel/core. Run `npm ls @babel/traverse` to see them, then ' +
          'give the instrumenter the copy its @babel/core uses with an npm override in package.json, such as ' +
          '"overrides": { "@stryker-mutator/instrumenter": { "@babel/traverse": "8.1.4" } }, and install again.',
      },
    );
  });
});
