import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const copies = [
  {
    file: 'stub-shape.ts',
    source: '../../storybook-csf/src/stub-shape.ts',
  },
  {
    file: 'stryker-record.ts',
    source: '../../storybook-csf/src/stryker-record.ts',
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
        `src/${file} differs from packages/storybook-csf/src/${file}; copy the owner's file over it`,
      );
    });
  });
});
