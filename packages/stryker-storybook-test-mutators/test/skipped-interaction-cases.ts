import { backstopCases } from './backstop-cases.ts';
import { bindingRuleCases } from './binding-rule-cases.ts';
import { clickBeforeTypeCases } from './click-before-type-cases.ts';
import { contextRuleCases } from './context-rule-cases.ts';
import { type Case, inPlay } from './support/case.ts';

const interaction = 'LzStorybookInteraction';

const hookCases: readonly Case[] = [
  {
    id: 'skip-before-each',
    title: 'an interaction in a beforeEach makes no mutant',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(button);\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-after-each-method',
    title: 'an interaction in an afterEach method makes no mutant',
    source: `export default {\n  async afterEach() {\n    button.blur();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-before-each-cleanup',
    title:
      'an interaction in the cleanup function a beforeEach returns makes no mutant',
    source: `export const Story = {\n  beforeEach: () => () => {\n    button.blur();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-before-each-array',
    title: 'an interaction in a beforeEach given in an array makes no mutant',
    source: `export const Story = {\n  beforeEach: [\n    async ({ userEvent }) => {\n      await userEvent.click(button);\n    },\n  ],\n};\n`,
    expect: [],
  },
  {
    id: 'skip-after-each-array',
    title: 'an interaction in an afterEach given in an array makes no mutant',
    source: `export default {\n  afterEach: [\n    () => {\n      button.blur();\n    },\n  ],\n};\n`,
    expect: [],
  },
  {
    id: 'skip-named-before-each',
    title:
      'an interaction in a function declared in the file and given as a beforeEach makes no mutant',
    source: `async function setup({ userEvent }) {\n  await userEvent.click(button);\n}\nexport default {\n  beforeEach: setup,\n};\n`,
    expect: [],
  },
  {
    id: 'skip-named-arrow-before-each',
    title:
      'an interaction in an arrow held in a local and given as a beforeEach makes no mutant',
    source: `const setup = async ({ userEvent }) => {\n  await userEvent.click(button);\n};\nexport default {\n  beforeEach: setup,\n};\n`,
    expect: [],
  },
  {
    id: 'before-each-wrapped',
    title:
      'an interaction in a beforeEach that a call wraps is removed, as only a hook given inline or as a function declared in the file is skipped',
    source: `export const Story = {\n  beforeEach: withUser(async ({ userEvent }) => {\n    await userEvent.click(button);\n  }),\n};\n`,
    expect: [[interaction, ';']],
  },
];

const negativeOnlyCases: readonly Case[] = [
  {
    id: 'skip-negative-only',
    title:
      'an interaction whose checks before the next interaction are all negative makes no mutant',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'negative-and-positive',
    title: 'an interaction followed by a positive check is removed',
    source: inPlay(
      'await userEvent.click(button);',
      'await expect(args.onClick).not.toHaveBeenCalledTimes(2);',
      'await expect(args.onClick).toHaveBeenCalled();',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'computed-expect-not-negative',
    title:
      'an expect(...) given as the key of a computed member rather than called through a matcher chain is no negative check, so the interaction is removed',
    source: inPlay(
      'await userEvent.click(button);',
      'await matchers[expect(args.onClick)].not;',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-until-next-interaction',
    title:
      'the checks that decide a skip end at the next interaction, so only the last of two clicks is skipped',
    source: inPlay(
      'await userEvent.click(first);',
      'await userEvent.click(second);',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-until-step-interaction',
    title:
      'the checks that decide a skip end at a step holding an interaction, so only the click in the step is skipped',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await userEvent.click(first);\n    await step('Second', async () => {\n      await userEvent.click(second);\n    });\n    await expect(args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-until-context-step-interaction',
    title:
      'the checks that decide a skip end at a context.step holding an interaction, so only the click in the step is skipped',
    source: `export const Story = {\n  play: async (context) => {\n    await context.userEvent.click(first);\n    await context.step('Second', async () => {\n      await context.userEvent.click(second);\n    });\n    await expect(context.args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-until-step-defining-interaction',
    title:
      'the checks that decide a skip end at a step that defines a function holding an interaction, as the step may call it',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await userEvent.click(first);\n    await step('Second', async () => {\n      const clickSecond = async () => {\n        await userEvent.click(second);\n      };\n      await clickSecond();\n    });\n    await expect(args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'negative-only-until-if-with-interaction',
    title:
      'the checks that decide a skip end at an if statement that holds an interaction, so only the click in the if is skipped',
    source: inPlay(
      'await userEvent.click(button);',
      'if (open) {',
      '  await userEvent.click(close);',
      '}',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'positive-after-if-with-interaction',
    title:
      'a positive check after an if statement that holds an interaction keeps an earlier interaction followed by a negative check, as the if may not run',
    source: inPlay(
      'await userEvent.click(a);',
      'await expect(args.onA).not.toHaveBeenCalled();',
      'if (c) {',
      '  await userEvent.click(b);',
      '}',
      'await expect(args.onB).toHaveBeenCalled();',
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'positive-after-function-with-interaction',
    title:
      'a positive check after a function defined with an interaction in it keeps an earlier interaction followed by a negative check',
    source: inPlay(
      'await userEvent.click(a);',
      'await expect(args.onA).not.toHaveBeenCalled();',
      'const later = async () => {',
      '  await userEvent.click(b);',
      '};',
      'await expect(args.onB).toHaveBeenCalled();',
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'positive-after-function-declaration-with-interaction',
    title:
      'a positive check after a function declaration with an interaction in it keeps an earlier interaction followed by a negative check',
    source: inPlay(
      'await userEvent.click(a);',
      'await expect(args.onA).not.toHaveBeenCalled();',
      'async function later() {',
      '  await userEvent.click(b);',
      '}',
      'await expect(args.onB).toHaveBeenCalled();',
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'positive-in-wait-for-with-interaction',
    title:
      'a positive check in a waitFor callback that holds an interaction keeps an earlier interaction followed by a negative check',
    source: inPlay(
      'await userEvent.click(a);',
      'await expect(args.onA).not.toHaveBeenCalled();',
      'await waitFor(async () => {',
      '  await userEvent.click(retry);',
      '  await expect(args.onB).toHaveBeenCalled();',
      '});',
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'negative-only-ends-at-local-function',
    title:
      'the checks that decide a skip end with a function that is no step callback, so negative checks after it skip nothing',
    source: inPlay(
      'const open = async () => {',
      '  await userEvent.click(button);',
      '};',
      'await open();',
      'await expect(args.onClick).not.toHaveBeenCalled();',
    ),
    expect: [[interaction, ';']],
  },
  {
    id: 'negative-only-after-step',
    title:
      'an interaction in a step whose checks before the next interaction in the play are all negative makes no mutant',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await step('Click', async () => {\n      await userEvent.click(button);\n    });\n    await expect(args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'negative-only-after-context-step',
    title:
      'an interaction in a context.step whose checks before the next interaction in the play are all negative makes no mutant',
    source: `export const Story = {\n  play: async (context) => {\n    await context.step('Click', async () => {\n      await context.userEvent.click(button);\n    });\n    await expect(context.args.onClick).not.toHaveBeenCalled();\n  },\n};\n`,
    expect: [],
  },
  {
    id: 'skip-negative-only-in-step',
    title:
      'an interaction followed only by a step of negative checks makes no mutant',
    source: `export const Story = {\n  play: async ({ step, userEvent }) => {\n    await userEvent.click(button);\n    await step('Check', async () => {\n      await expect(args.onClick).not.toHaveBeenCalled();\n    });\n  },\n};\n`,
    expect: [],
  },
];

const clearedLaterCases: readonly Case[] = [
  {
    id: 'skip-type-cleared-later',
    title:
      'a type that a later clear of the same target undoes before any check makes no mutant',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'await userEvent.clear(input);',
      "await userEvent.type(input, 'b');",
      "await expect(input).toHaveValue('b');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'skip-clear-cleared-later',
    title:
      'a clear that a later clear of the same target repeats before any check makes no mutant',
    source: inPlay(
      'await userEvent.clear(input);',
      'await userEvent.clear(input);',
      "await userEvent.type(input, 'b');",
      "await expect(input).toHaveValue('b');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'skip-type-cleared-later-past-statements',
    title:
      'a type that a later clear of the same target undoes, past a statement that reads nothing such as a sleep, makes no mutant',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'await sleep(10);',
      'await userEvent.clear(input);',
      "await userEvent.type(input, 'b');",
      "await expect(input).toHaveValue('b');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-checked-before-clear',
    title: 'a type checked before a later clear of the same target is removed',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      "await expect(input).toHaveValue('a');",
      'await userEvent.clear(input);',
      "await expect(input).toHaveValue('');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-used-before-clear',
    title:
      'a type that another interaction uses before a later clear of the same target is removed',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'await userEvent.click(submit);',
      'await userEvent.clear(input);',
      "await expect(args.onSubmit).toHaveBeenCalledWith('a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-used-in-step-before-clear',
    title:
      'a type that an interaction in a step uses before a later clear of the same target is removed',
    source: `export const Story = {\n  play: async ({ args, step, userEvent }) => {\n    await userEvent.type(input, 'a');\n    await step('Submit', async () => {\n      await userEvent.click(submit);\n    });\n    await userEvent.clear(input);\n    await expect(args.onSubmit).toHaveBeenCalledWith('a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-used-in-step-function-before-clear',
    title:
      'a type that a step may use through a function it defines before a later clear of the same target is removed',
    source: `export const Story = {\n  play: async ({ args, step, userEvent }) => {\n    await userEvent.type(input, 'a');\n    await step('Submit', async () => {\n      const submitForm = async () => {\n        await userEvent.click(submit);\n      };\n      await submitForm();\n    });\n    await userEvent.clear(input);\n    await expect(args.onSubmit).toHaveBeenCalledWith('a');\n  },\n};\n`,
    expect: [
      [interaction, ';'],
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-used-in-wait-for-before-clear',
    title:
      'a type that an interaction in a waitFor callback uses before a later clear of the same target is removed',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'await waitFor(async () => {',
      '  await userEvent.click(submit);',
      '});',
      'await userEvent.clear(input);',
      "await expect(args.onSubmit).toHaveBeenCalledWith('a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-used-in-if-before-clear',
    title:
      'a type that an interaction in an if statement uses before a later clear of the same target is removed',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      'if (submitting) {',
      '  await userEvent.click(submit);',
      '}',
      'await userEvent.clear(input);',
      "await expect(args.onSubmit).toHaveBeenCalledWith('a');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
  {
    id: 'type-typed-again',
    title:
      'a type followed by another type of the same target is removed, as the second type adds to it',
    source: inPlay(
      "await userEvent.type(input, 'a');",
      "await userEvent.type(input, 'b');",
      "await expect(input).toHaveValue('ab');",
    ),
    expect: [
      [interaction, ';'],
      [interaction, ';'],
    ],
  },
];

export const skippedInteractionCases: readonly Case[] = [
  ...hookCases,
  ...negativeOnlyCases,
  ...clickBeforeTypeCases,
  ...bindingRuleCases,
  ...contextRuleCases,
  ...backstopCases,
  ...clearedLaterCases,
];
