import assert from 'node:assert/strict';
import { test } from 'node:test';

import { transformSync, type NodePath } from '@babel/core';

import { sitesIn } from '../src/args.ts';

/** What `sitesIn` throws for a story file whose traversal throws `thrown`, as a deep member chain overflows the stack. */
function sitesInError(thrown: unknown): unknown {
  const errors: unknown[] = [];

  transformSync('export const Story = {};\n', {
    configFile: false,
    babelrc: false,
    filename: 'deep.stories.ts',
    code: false,
    plugins: [
      () => ({
        visitor: {
          Program(path: NodePath) {
            const overflowing = new Proxy(path, {
              get: (target, key, receiver): unknown =>
                key === 'traverse'
                  ? () => {
                      throw thrown;
                    }
                  : Reflect.get(target, key, receiver),
            });

            try {
              sitesIn(overflowing);
            } catch (error) {
              errors.push(error);
            }
          },
        },
      }),
    ],
  });

  return errors[0];
}

test('a story file read that throws names the story file and keeps the error as its cause', () => {
  const deep = new RangeError('Maximum call stack size exceeded');
  const error = sitesInError(deep);

  assert.ok(error instanceof Error);
  assert.match(
    error.message,
    /^@layzee\/stryker-storybook-mutators: could not read the story file .*deep\.stories\.ts: Maximum call stack size exceeded$/,
  );
  assert.equal(error.cause, deep);
});
