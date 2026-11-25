import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readNamingStoryFile } from '../src/story-file-read.ts';

const pathIn = (filename: string) => ({
  hub: { file: { opts: { filename } } },
});

test('a read gives its value', () => {
  assert.equal(
    readNamingStoryFile('@muirjs/example', pathIn('a.stories.ts'), () => 1),
    1,
  );
});

test('a read that throws names the story file and keeps the error as its cause', () => {
  const deep = new RangeError('Maximum call stack size exceeded');

  assert.throws(
    () =>
      readNamingStoryFile('@muirjs/example', pathIn('deep.stories.ts'), () => {
        throw deep;
      }),
    (error) =>
      error instanceof Error &&
      error.message ===
        '@muirjs/example: could not read the story file deep.stories.ts: Maximum call stack size exceeded' &&
      error.cause === deep,
  );
});

test('a read that throws in a file with no name says so without a path', () => {
  assert.throws(
    () =>
      readNamingStoryFile('@muirjs/example', {}, () => {
        throw new RangeError('deep');
      }),
    { message: '@muirjs/example: could not read a story file: deep' },
  );
});

test('a read that throws a value other than an error names it as text', () => {
  assert.throws(
    () =>
      readNamingStoryFile('@muirjs/example', pathIn('a.stories.ts'), () => {
        throw 'odd';
      }),
    {
      message:
        '@muirjs/example: could not read the story file a.stories.ts: odd',
    },
  );
});
