import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const copies: readonly string[] = ['compose-skips.ts'];

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('copied test support', () => {
  copies.forEach((file) => {
    it(`test/support/${file} is a byte copy of the Storybook mutators' file`, () => {
      assert.equal(
        read(`support/${file}`),
        read(`../../stryker-storybook-mutators/test/support/${file}`),
        `test/support/${file} differs from packages/stryker-storybook-mutators/test/support/${file}; make the same change in both`,
      );
    });
  });
});
