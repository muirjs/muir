import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import {
  muirTempRoot,
  muirWriteTree,
} from '@muirjs/test-util-mutator-packages';

import { muirProteusStorybookTestMutators } from '../src/index.ts';
import { allInteractionCases, crashCases } from './interaction-cases.ts';
import { inPlay } from './support/case.ts';
import { mutantLinesByFile, runCases } from './support/run-cases.ts';

runCases('MuirProteusStorybookTestInteraction', allInteractionCases);
describe('cases that once crashed the instrumenter', () => {
  runCases('MuirProteusStorybookTestInteraction', crashCases);
});

// Stryker parses a JavaScript file with the project's Babel config, which can keep parentheses as nodes.
test('a click on userEvent in parentheses that the Babel config keeps as a node is removed', async (t) => {
  const root = muirTempRoot(t, 'muir-parentheses-');
  const file = join(root, 'parentheses.stories.js');
  const cwd = process.cwd();

  muirWriteTree(root, {
    'babel.config.json': JSON.stringify({
      parserOpts: { createParenthesizedExpressions: true },
    }),
  });
  process.chdir(root);

  try {
    await muirProteusStorybookTestMutators();
    const lines = await mutantLinesByFile(
      [{ name: file, content: inPlay('await (userEvent).click(button);') }],
      'MuirProteusStorybookTestInteraction',
    );

    assert.deepEqual(lines.get(file), [
      'MuirProteusStorybookTestInteraction ;',
    ]);
  } finally {
    process.chdir(cwd);
  }
});
