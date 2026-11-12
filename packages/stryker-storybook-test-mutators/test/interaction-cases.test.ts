import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { crashCases, interactionCases } from './interaction-cases.ts';
import { inPlay } from './support/case.ts';
import { mutantsOf, runCases } from './support/run-cases.ts';
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
    const mutants = await mutantsOf([
      { name: file, content: inPlay('await (userEvent).click(button);') },
    ]);

    assert.deepEqual(
      mutants
        .filter(({ mutatorName }) => mutatorName === 'LzStorybookInteraction')
        .map(({ replacement }) => replacement),
      [';'],
    );
  } finally {
    process.chdir(cwd);
  }
});
