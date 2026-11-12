// A line-range `--mutate` leaves the Program out of the range, so Stryker first calls a mutator below it. These cases
// call a mutator at a statement first, replace an earlier node with a mutant switch as Stryker does on leaving a
// statement, then call it at a later node: what the mutator read of the file must be the file before the switch.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSync, traverse, types, type NodePath } from '@babel/core';

import { interactionMutator } from '../src/interaction-mutators.ts';
import type { LzStorybookTestMutator } from '../src/mutator.ts';
import { spyStubMutator, spyStubOutcomeMutator } from '../src/spy-stub.ts';
import { storyGlobalsMutator } from '../src/story-globals.ts';

interface StoryFile {
  /** The path of the node of `type` that starts where `text` first starts in the source. */
  readonly at: (text: string, type: types.Node['type']) => NodePath;
}

function parse(source: string): StoryFile {
  const file = parseSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'case.stories.ts',
    parserOpts: { plugins: ['typescript'] },
  });
  assert.ok(file);
  const paths: NodePath[] = [];

  traverse(file, {
    enter(path) {
      paths.push(path);
    },
  });

  return {
    at(text, type) {
      const found = paths.find(
        ({ node }) => node.type === type && node.start === source.indexOf(text),
      );
      assert.ok(found, `no ${type} at ${text}`);

      return found;
    },
  };
}

function mutantTypes(
  mutator: LzStorybookTestMutator,
  path: NodePath,
): readonly string[] {
  return [...mutator.mutate(path, types)].map(({ type }) => type);
}

/** Wraps the `init` of the variable declared at `path` in `stryMutAct_9fa48("0") ? {} : init`. */
function placeSwitch({ node }: NodePath): void {
  const declaration =
    node.type === 'ExportNamedDeclaration' ? node.declaration : node;
  assert.ok(declaration?.type === 'VariableDeclaration');
  const [declarator] = declaration.declarations;
  assert.ok(declarator?.init);
  declarator.init = types.conditionalExpression(
    types.callExpression(types.identifier('stryMutAct_9fa48'), [
      types.stringLiteral('0'),
    ]),
    types.objectExpression([]),
    declarator.init,
  );
}

const factoryStubStatement = [
  "import preview from '../.storybook/preview';",
  "import { save } from './save';",
  '',
  "const meta = preview.meta({ title: 'Probe' });",
  '',
  'export const Story = meta.story({});',
  '',
  "Story.test('saves', async () => {",
  '  mocked(save).mockResolvedValue(1);',
  '});',
  '',
].join('\n');

test('LzStorybookSpyStub removes a stub statement after a mutant is placed earlier in a line-range run', () => {
  const file = parse(factoryStubStatement);
  const story = file.at('export const Story', 'ExportNamedDeclaration');
  const mutator = spyStubMutator();

  mutantTypes(mutator, story);
  placeSwitch(story);

  assert.deepEqual(
    mutantTypes(mutator, file.at('mocked(save)', 'ExpressionStatement')),
    ['EmptyStatement'],
  );
});

test('LzStorybookSpyStubOutcome flips a stub after a mutant is placed earlier in a line-range run', () => {
  const file = parse(factoryStubStatement);
  const story = file.at('export const Story', 'ExportNamedDeclaration');
  const mutator = spyStubOutcomeMutator();

  mutantTypes(mutator, story);
  placeSwitch(story);

  assert.deepEqual(
    mutantTypes(mutator, file.at('mocked(save)', 'CallExpression')),
    ['CallExpression'],
  );
});

test('LzStorybookInteraction removes a raw DOM interaction after a mutant is placed earlier in a line-range run', () => {
  const file = parse(
    [
      "import preview from '../.storybook/preview';",
      '',
      "const meta = preview.meta({ title: 'Probe' });",
      '',
      'export const Story = meta.story({});',
      '',
      "Story.test('clicks', async ({ canvas }) => {",
      "  canvas.getByRole('button').click();",
      "  await expect(canvas.getByText('Saved')).toBeVisible();",
      '});',
      '',
    ].join('\n'),
  );
  const story = file.at('export const Story', 'ExportNamedDeclaration');
  const mutator = interactionMutator();

  mutantTypes(mutator, story);
  placeSwitch(story);

  assert.deepEqual(
    mutantTypes(
      mutator,
      file.at("canvas.getByRole('button').click", 'ExpressionStatement'),
    ),
    ['EmptyStatement'],
  );
});

test('LzStorybookStoryGlobals mutates story globals after a mutant is placed earlier in a line-range run', () => {
  const file = parse(
    [
      "const meta = { title: 'Probe', parameters: { viewport: { defaultViewport: 'mobile1' } } };",
      'export default meta;',
      '',
      "export const Story = { globals: { viewport: { value: 'responsive' } }, play: async () => {} };",
      '',
    ].join('\n'),
  );
  const meta = file.at('const meta', 'VariableDeclaration');
  const mutator = storyGlobalsMutator();

  mutantTypes(mutator, meta);
  placeSwitch(meta);

  assert.deepEqual(
    mutantTypes(mutator, file.at('{ viewport: { value', 'ObjectExpression')),
    ['ObjectExpression'],
  );
});
