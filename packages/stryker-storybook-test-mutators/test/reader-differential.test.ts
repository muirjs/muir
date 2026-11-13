// Core's interaction reader resolves names through its own scope model. This test runs it and the same kind rules
// read through Babel's `path.scope` over every story source in the case files, plus shapes that stress scope, and
// checks that the two agree on which calls are interactions, of which kind and method, apart from the behaviour
// changes listed below.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import { parseSync, traverse } from '@babel/core';
import { csfShapes, field, interactionsOf } from '@layzee/storybook-core';

import { assertionBeforeCases } from './assertion-before-cases.ts';
import { clickFocusCases } from './click-focus-cases.ts';
import { allInteractionCases, crashCases } from './interaction-cases.ts';
import { repeatCases } from './repeat-cases.ts';
import { spyStubCases } from './spy-stub-cases.ts';
import { spyStubOutcomeCases } from './spy-stub-outcome-cases.ts';
import {
  storyGlobalsCases,
  storyGlobalsCrashCases,
} from './story-globals-cases.ts';
import { storyGlobalsDefaultCases } from './story-globals-default-cases.ts';
import { interactionKindAt } from './support/babel-scope-reader.ts';
import { type Case, inPlay } from './support/case.ts';
import { targetCases } from './target-cases.ts';
import { waitForCases } from './wait-for-cases.ts';

type Source = Pick<Case, 'id' | 'source'>;

const userEventAs = (name: string): string =>
  `import { userEvent as ${name} } from 'storybook/test';\n`;

const scopeSources: readonly Source[] = [
  {
    id: 'scope-block-shadow',
    source: `${userEventAs('ue')}${inPlay('{', '  const ue = createDriver();', '  await ue.click(inner);', '}', 'await ue.click(outer);')}`,
  },
  {
    id: 'scope-block-shadow-of-setup',
    source: `${userEventAs('ue')}${inPlay('{', '  const ue = createDriver();', '  await ue.click(inner);', '}', 'const user = ue.setup();', 'await user.click(outer);')}`,
  },
  {
    id: 'scope-catch-parameter',
    source: `${userEventAs('ue')}${inPlay('try {', '  await ue.click(first);', '} catch (ue) {', '  await ue.click(second);', '}', 'await ue.click(third);')}`,
  },
  {
    id: 'scope-function-parameter-named-user-event',
    source: inPlay(
      'const clickWith = async (userEvent) => {',
      '  await userEvent.click(button);',
      '};',
      'await clickWith(createDriver());',
    ),
  },
  {
    id: 'scope-function-parameter-shadows-import',
    source: `${userEventAs('ue')}${inPlay('const clickWith = async (ue) => {', '  await ue.click(inner);', '};', 'await ue.click(outer);')}`,
  },
  {
    id: 'scope-var-hoisted-from-block',
    source: `${userEventAs('ue')}${inPlay('await ue.click(first);', 'if (flag) {', '  var ue = createDriver();', '}')}`,
  },
  {
    id: 'scope-var-hoisted-from-for-head',
    source: `${userEventAs('ue')}${inPlay('await ue.click(first);', 'for (var ue of drivers) {}')}`,
  },
  {
    id: 'scope-var-hoisted-setup',
    source: `${userEventAs('ue')}${inPlay('await user.click(first);', '{', '  var user = ue.setup();', '}')}`,
  },
  {
    id: 'scope-later-let',
    source: `${userEventAs('ue')}${inPlay('await ue.click(first);', 'let ue = createDriver();')}`,
  },
  {
    id: 'scope-later-let-setup',
    source: `${userEventAs('ue')}${inPlay('await user.click(first);', 'let user = ue.setup();')}`,
  },
  {
    id: 'scope-for-of-const-head',
    source: `${userEventAs('ue')}${inPlay('for (const ue of drivers) {', '  await ue.click(inner);', '}', 'await ue.click(outer);')}`,
  },
  {
    id: 'scope-destructured-context-renamed',
    source: `export const Story = {\n  play: async ({ canvas, userEvent: ue }) => {\n    await ue.click(canvas.getByRole('button'));\n  },\n};\n`,
  },
  {
    id: 'scope-destructured-context-rest',
    source: `export const Story = {\n  play: async ({ canvas, ...rest }) => {\n    await rest.userEvent.click(canvas.getByRole('button'));\n  },\n};\n`,
  },
  {
    id: 'scope-context-destructured-in-body',
    source: `export const Story = {\n  play: async (context) => {\n    const { userEvent: ue } = context;\n    await ue.click(button);\n  },\n};\n`,
  },
  {
    id: 'scope-destructured-context-shadowed-in-block',
    source: `export const Story = {\n  play: async ({ userEvent: ue }) => {\n    {\n      const ue = createDriver();\n      await ue.click(inner);\n    }\n    await ue.click(outer);\n  },\n};\n`,
  },
];

const caseSources: readonly Source[] = [
  ...storyGlobalsCases,
  ...storyGlobalsDefaultCases,
  ...storyGlobalsCrashCases,
  ...assertionBeforeCases,
  ...clickFocusCases,
  ...allInteractionCases,
  ...crashCases,
  ...repeatCases,
  ...spyStubCases,
  ...spyStubOutcomeCases,
  ...targetCases,
  ...waitForCases,
  {
    id: 'parenthesized-user-event',
    source: inPlay('await (userEvent).click(button);'),
  },
];

const contextDestructuredInPlay =
  'a userEvent destructured from the play context in the play body';

/** The sources where the readers differ by a behaviour change of core's reader, with the change. */
const expectedDifferences: ReadonlyMap<string, string> = new Map([
  ['assertion-before-string-key', 'a string-literal computed key'],
  ['assertion-before-unknown-key', 'a computed key that is no string literal'],
  ['click-focus-string-key', 'a string-literal computed key'],
  ['click-focus-skip-unknown-key', 'a computed key that is no string literal'],
  ['user-event-alias', 'a local bound to a user-event itself'],
  ['context-user-event-destructured-in-play', contextDestructuredInPlay],
  ['user-event-string-key', 'a string-literal computed key'],
  ['user-event-unknown-key', 'a computed key that is no string literal'],
  ['composed-context-step', 'context.step(label, Other.play)'],
  ['repeat-string-key', 'a string-literal computed key'],
  ['repeat-skip-unknown-key', 'a computed key that is no string literal'],
  ['target-string-key', 'a string-literal computed key'],
  ['target-unknown-key', 'a computed key that is no string literal'],
  ['scope-context-destructured-in-body', contextDestructuredInPlay],
]);

/** Each interaction as `<site start> <kind> <method>`, in source order. */
function interactionLines(source: string): {
  readonly babel: readonly string[];
  readonly core: readonly string[];
} {
  const file = parseSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'case.stories.ts',
    parserOpts: { plugins: ['typescript'] },
  });
  assert.ok(file);
  const shapes = csfShapes(file.program);
  const babel: string[] = [];

  traverse(file, {
    enter(path) {
      const interaction = interactionKindAt(path, shapes.testCode);

      if (interaction !== undefined) {
        babel.push(
          `${path.node.start} ${interaction.kind} ${'method' in interaction ? interaction.method : undefined}`,
        );
      }
    },
  });

  const core = interactionsOf(file.program, shapes).all.map(
    (interaction) =>
      `${String(field(interaction.node, 'start'))} ${interaction.kind} ${'method' in interaction ? interaction.method : undefined}`,
  );

  return { babel, core };
}

test("core's reader and the rules read through Babel's scope agree on every interaction, apart from the expected differences", () => {
  const sources = [...caseSources, ...scopeSources];
  const differences = sources.flatMap(({ id, source }) => {
    const { babel, core } = interactionLines(source);

    return isDeepStrictEqual(babel, core) ? [] : [{ id, babel, core }];
  });

  assert.deepEqual(
    differences.filter(({ id }) => !expectedDifferences.has(id)),
    [],
  );
  assert.deepEqual(
    differences.map(({ id }) => id),
    [...expectedDifferences.keys()],
  );
});
