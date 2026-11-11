import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const copies = [
  {
    file: 'csf.ts',
    source: '../../stryker-storybook/src/csf.ts',
  },
  {
    file: 'is-record.ts',
    source: '../../stryker-storybook/src/is-record.ts',
  },
  {
    file: 'node-field.ts',
    source: '../../stryker-storybook/src/node-field.ts',
  },
];

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('copied files', () => {
  copies.forEach(({ file, source }) => {
    it(`src/${file} is a byte copy of its owner's file`, () => {
      assert.equal(
        read(`../src/${file}`),
        read(source),
        `src/${file} differs from packages/stryker-storybook/src/${file}; copy the owner's file over it`,
      );
    });
  });
});
