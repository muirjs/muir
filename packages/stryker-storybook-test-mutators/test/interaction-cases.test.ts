import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { lzStorybookTestMutators } from '../src/index.ts';
import { crashCases, interactionCases } from './interaction-cases.ts';
import { inPlay } from './support/case.ts';
import { mutantLinesByFile, runCases } from './support/run-cases.ts';
import { tempRoot, writeTree } from './support/temp-tree.ts';

runCases('LzStorybookInteraction', interactionCases);
describe('cases that once crashed the instrumenter', () => {
  runCases('LzStorybookInteraction', crashCases);
});

// Stryker parses a JavaScript file with the project's Babel config, which can keep parentheses as nodes.
test('a click on userEvent in parentheses that the Babel config keeps as a node is removed', async (t) => {
  const root = tempRoot(t, 'lz-parentheses-');
  const file = join(root, 'parentheses.stories.js');
  const cwd = process.cwd();

  writeTree(root, {
    'babel.config.json': JSON.stringify({
      parserOpts: { createParenthesizedExpressions: true },
    }),
  });
  process.chdir(root);

  try {
    await lzStorybookTestMutators();
    const lines = await mutantLinesByFile(
      [{ name: file, content: inPlay('await (userEvent).click(button);') }],
      'LzStorybookInteraction',
    );

    assert.deepEqual(lines.get(file), ['LzStorybookInteraction ;']);
  } finally {
    process.chdir(cwd);
  }
});
