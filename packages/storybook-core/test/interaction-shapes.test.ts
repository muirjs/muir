import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csfShapes } from '../src/csf.ts';
import {
  type Interaction,
  interactionsOf,
  type StoryInteractions,
} from '../src/interactions.ts';
import { programsOf } from './support/parse-module.ts';

interface ShapeCase {
  /** The id of the reporter's interaction hint case this ports, when it ports one. */
  readonly id?: string;
  readonly title: string;
  readonly source: string;
  /** Each interaction's shapes, in source order. */
  readonly expect: readonly (readonly Shape[])[];
}

/** The play of a story whose context gives `args`, `canvas`, `step` and `userEvent`, running `statements`. */
function inPlay(...statements: readonly string[]): string {
  return [
    "export default { title: 'Form' };",
    '',
    'export const Form = {',
    '  play: async ({ args, canvas, step, userEvent }) => {',
    ...statements.map((statement) => `    ${statement}`),
    '  },',
    '};',
    '',
  ].join('\n');
}

function methodOf(interaction: Interaction | undefined): string | undefined {
  return interaction?.kind === 'userEvent' || interaction?.kind === 'fireEvent'
    ? interaction.method
    : undefined;
}

function isNegativeOnly({ following: { checks, end } }: Interaction): boolean {
  return (
    checks.length > 0 &&
    checks.every((check) => check.negative) &&
    end.by !== 'maybe'
  );
}

/** The reader's part of click-before-type: whether the type's options may skip the click stays the reporter's own reading. */
function isClickBeforeType(
  interaction: Interaction,
  interactions: StoryInteractions,
): boolean {
  const { end } = interaction.following;
  const next =
    end.by === 'interaction' && end.adjacent && end.sameTarget
      ? interactions.at(end.node)
      : undefined;

  return (
    interaction.kind === 'userEvent' &&
    ['click', 'hover'].includes(interaction.method ?? '') &&
    next?.kind === 'userEvent' &&
    next.method === 'type' &&
    next.origin === 'userEvent14'
  );
}

function isClearedLater(
  interaction: Interaction,
  interactions: StoryInteractions,
): boolean {
  const { checks, end } = interaction.following;
  const later =
    end.by === 'interaction' && end.sameList && end.sameTarget
      ? interactions.at(end.node)
      : undefined;

  return (
    ['type', 'clear'].includes(methodOf(interaction) ?? '') &&
    methodOf(later) === 'clear' &&
    checks.length === 0
  );
}

/** The lz-storybook reporter's interaction shapes, each with its test over what `interactionsOf` gives. */
const shapeTests = [
  ['negative-only', isNegativeOnly],
  ['click-before-type', isClickBeforeType],
  ['cleared-later', isClearedLater],
] as const;

type Shape = (typeof shapeTests)[number][0];

/** The shapes of each interaction of `source`, once per parse. */
function shapesIn(source: string): readonly (readonly (readonly Shape[])[])[] {
  return programsOf(source).map((program) => {
    const interactions = interactionsOf(program, csfShapes(program));

    return interactions.all.map((interaction) =>
      shapeTests.flatMap(([shape, holds]) =>
        holds(interaction, interactions) ? [shape] : [],
      ),
    );
  });
}

const shapeCases: readonly ShapeCase[] = [
  {
    id: 'negative-only',
    title:
      'an interaction whose following checks are all negative is negative-only',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    expect: [['negative-only']],
  },
  {
    id: 'no-check',
    title: 'an interaction with no following check has no shape',
    source: inPlay("await userEvent.click(canvas.getByRole('button'));"),
    expect: [[]],
  },
  {
    id: 'negative-and-positive',
    title:
      'an interaction whose following checks include a positive one has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect(canvas.getByRole('status')).toBeVisible();",
    ),
    expect: [[]],
  },
  {
    id: 'positive-soft-check',
    title:
      'an interaction whose following checks include a positive expect.soft one has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect.soft(canvas.getByRole('status')).toBeVisible();",
    ),
    expect: [[]],
  },
  {
    id: 'positive-element-check',
    title:
      'an interaction whose following checks include a positive expect.element one has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect.element(canvas.getByRole('status')).toBeVisible();",
    ),
    expect: [[]],
  },
  {
    id: 'positive-poll-check',
    title:
      'an interaction whose following checks include a positive expect.poll one has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await expect.poll(() => canvas.getByRole('status')).toBeVisible();",
    ),
    expect: [[]],
  },
  {
    id: 'positive-find-by',
    title:
      'an interaction followed by a findBy query, which fails when nothing is found, has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await canvas.findByRole('dialog');",
    ),
    expect: [[]],
  },
  {
    id: 'positive-find-all-by',
    title:
      'an interaction followed by a findAllBy query, which fails when nothing is found, has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await canvas.findAllByRole('row');",
    ),
    expect: [[]],
  },
  {
    id: 'positive-get-by',
    title:
      'an interaction followed by a getBy query statement, which throws when nothing is found, has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "canvas.getByRole('dialog');",
    ),
    expect: [[]],
  },
  {
    id: 'positive-destructured-find-by',
    title:
      'an interaction followed by a findBy query destructured from canvas has no shape',
    source: inPlay(
      'const { findByText } = canvas;',
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await findByText('Saved');",
    ),
    expect: [[]],
  },
  {
    id: 'ends-at-next-interaction',
    title:
      'the following checks end at the next interaction, whose own checks may be positive',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "await userEvent.click(canvas.getByRole('checkbox'));",
      'await expect(args.onChange).toHaveBeenCalled();',
    ),
    expect: [['negative-only'], []],
  },
  {
    id: 'past-step-callback',
    title:
      'the following checks run past the end of a step callback that holds the interaction',
    source: inPlay(
      "await step('save', async () => { await userEvent.click(canvas.getByRole('button')); });",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    expect: [['negative-only']],
  },
  {
    id: 'check-after-if-with-interaction',
    title:
      'an interaction whose only check comes after an if that holds an interaction has no shape, as the if ends its following checks, while the interaction in the if is negative-only',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      "if (args.open) { await userEvent.click(canvas.getByRole('checkbox')); }",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    expect: [[], ['negative-only']],
  },
  {
    id: 'positive-check-after-if-with-interaction',
    title:
      'an interaction whose negative checks stand before an if that holds an interaction has no shape, as that if may or may not run one',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "if (args.open) { await userEvent.click(canvas.getByRole('checkbox')); }",
      "await expect(canvas.getByRole('status')).toBeVisible();",
    ),
    expect: [[], []],
  },
  {
    id: 'click-before-type',
    title:
      'a click directly before a type of the same target, quoted differently, is click-before-type',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      'await userEvent.type(canvas.getByRole("textbox"), \'Ada\');',
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'hover-before-type',
    title:
      'a hover directly before a type of the same target is click-before-type',
    source: inPlay(
      "await userEvent.hover(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'click-before-type-elsewhere',
    title: 'a click before a type of another target has no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'type-skips-click',
    title:
      "a click before a type given skipClick is click-before-type as far as the reader goes, and the reporter's maySkipClick reads the options",
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { skipClick: true });",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'type-options-variable',
    title:
      "a click before a type whose options come from a variable is click-before-type as far as the reader goes, and the reporter's maySkipClick reads the options",
    source: inPlay(
      'const options = { skipClick: true };',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', options);",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'type-options-spread',
    title:
      "a click before a type whose options hold a spread is click-before-type as far as the reader goes, and the reporter's maySkipClick reads the options",
    source: inPlay(
      'const options = { skipClick: true };',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { delay: 0, ...options });",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'type-skips-click-quoted',
    title:
      "a click before a type given a quoted skipClick key is click-before-type as far as the reader goes, and the reporter's maySkipClick reads the options",
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { 'skipClick': true });",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'type-options-computed-key',
    title:
      "a click before a type whose options have a computed key is click-before-type as far as the reader goes, and the reporter's maySkipClick reads the options",
    source: inPlay(
      "const option = 'skipClick';",
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { [option]: true });",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'type-options-getter',
    title:
      "a click before a type whose options have a skipClick getter is click-before-type as far as the reader goes, and the reporter's maySkipClick reads the options",
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { get skipClick() { return true; } });",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'type-options-proto',
    title:
      "a click before a type whose options set a prototype is click-before-type as far as the reader goes, and the reporter's maySkipClick reads the options",
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { __proto__: { skipClick: true } });",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'type-keeps-click',
    title:
      'a click before a type given skipClick: false, which clicks, is click-before-type',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada', { skipClick: false });",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'vitest-browser-type',
    title:
      "a click before a type on Vitest browser's userEvent, whose type does not click, has no shape",
    source: [
      "import { userEvent } from 'vitest/browser';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      "    await userEvent.click(canvas.getByRole('textbox'));",
      "    await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '  },',
      '};',
      '',
    ].join('\n'),
    expect: [[], []],
  },
  {
    id: 'storybook-test-type',
    title:
      "a click before a type on storybook/test's userEvent, which is user-event 14, is click-before-type",
    source: [
      "import { userEvent } from 'storybook/test';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      "    await userEvent.click(canvas.getByRole('textbox'));",
      "    await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '  },',
      '};',
      '',
    ].join('\n'),
    expect: [['click-before-type'], []],
  },
  {
    id: 'local-function-user-event-type',
    title:
      "a click before a type on a userEvent destructured from a local function's parameter, which may be Vitest browser's, has no shape",
    source: [
      "import { userEvent as vitestUserEvent } from 'vitest/browser';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      '    const fill = async ({ userEvent }) => {',
      "      await userEvent.click(canvas.getByRole('textbox'));",
      "      await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '    };',
      '    await fill({ userEvent: vitestUserEvent });',
      '  },',
      '};',
      '',
    ].join('\n'),
    expect: [[], []],
  },
  {
    id: 'local-play-property-user-event-type',
    title:
      "a click before a type on a userEvent destructured from a local object's play property, which may be Vitest browser's, has no shape, nor has the call of that play",
    source: [
      "import { userEvent as vitestUserEvent } from 'vitest/browser';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      '    const steps = { play: async ({ userEvent }) => {',
      "      await userEvent.click(canvas.getByRole('textbox'));",
      "      await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '    } };',
      '    await steps.play({ userEvent: vitestUserEvent });',
      '  },',
      '};',
      '',
    ].join('\n'),
    expect: [[], [], []],
  },
  {
    id: 'meta-play-type',
    title:
      "a click before a type on the userEvent of the meta's play context is click-before-type",
    source: [
      "export default { title: 'Form', play: async ({ canvas, userEvent }) => {",
      "  await userEvent.click(canvas.getByRole('textbox'));",
      "  await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '} };',
      'export const Form = {};',
      '',
    ].join('\n'),
    expect: [['click-before-type'], []],
  },
  {
    id: 'computed-play-key-user-event-type',
    title:
      'a click before a type in a function under a computed key, which need not be play, has no shape',
    source: [
      "const play = 'x';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  [play]: async ({ canvas, userEvent }) => {',
      "    await userEvent.click(canvas.getByRole('textbox'));",
      "    await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '  },',
      '};',
      '',
    ].join('\n'),
    expect: [[], []],
  },
  {
    id: 'for-of-user-event-shadows-context',
    title:
      "a click before a type on a userEvent that a for...of head declares, which shadows the play context's, has no shape",
    source: inPlay(
      'for (const userEvent of [vitestUserEvent]) {',
      "  await userEvent.click(canvas.getByRole('textbox'));",
      "  await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '}',
    ),
    expect: [[], []],
  },
  {
    id: 'for-head-user-event-shadows-context',
    title:
      "a click before a type on a userEvent that a for head declares, which shadows the play context's, has no shape",
    source: inPlay(
      'for (let userEvent = vitestUserEvent, i = 0; i < 1; i += 1) {',
      "  await userEvent.click(canvas.getByRole('textbox'));",
      "  await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '}',
    ),
    expect: [[], []],
  },
  {
    id: 'catch-user-event-shadows-context',
    title:
      "a click before a type on a userEvent that a catch parameter declares, which shadows the play context's, has no shape",
    source: inPlay(
      'try {',
      '  throw vitestUserEvent;',
      '} catch (userEvent) {',
      "  await userEvent.click(canvas.getByRole('textbox'));",
      "  await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '}',
    ),
    expect: [[], []],
  },
  {
    id: 'switch-case-user-event-shadows-context',
    title:
      "a click before a type on a userEvent that an earlier case of the same switch declares, which shadows the play context's, has no shape",
    source: inPlay(
      'switch (args.step) {',
      '  case 0:',
      '    const userEvent = vitestUserEvent;',
      '  case 1:',
      "    await userEvent.click(canvas.getByRole('textbox'));",
      "    await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '}',
    ),
    expect: [[], []],
  },
  {
    id: 'reassigned-context-user-event-type',
    title:
      "a click before a type on the play context's userEvent after the play assigns it another value has no shape",
    source: inPlay(
      'userEvent = vitestUserEvent;',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'for-of-head-reassigns-context-user-event-type',
    title:
      "a click before a type on the play context's userEvent after a for...of head assigns it another value has no shape",
    source: inPlay(
      'for (userEvent of [vitestUserEvent]) {}',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'nested-var-reassigns-context-user-event-type',
    title:
      "a click before a type on the play context's userEvent after a var in a nested block assigns it another value has no shape",
    source: inPlay(
      'if (args.step) {',
      '  var userEvent = vitestUserEvent;',
      '}',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'for-of-pattern-reassigns-context-user-event-type',
    title:
      "a click before a type on the play context's userEvent after a for...of head destructures another value into it has no shape",
    source: inPlay(
      'for ({ userEvent } of [{ userEvent: vitestUserEvent }]) {}',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'for-in-head-reassigns-context-user-event-type',
    title:
      "a click before a type on the play context's userEvent after a for...in head assigns it another value has no shape",
    source: inPlay(
      'for (userEvent in { vitestUserEvent }) {}',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'update-reassigns-context-user-event-type',
    title:
      "a click before a type on the play context's userEvent after an update expression gives it another value has no shape",
    source: inPlay(
      'if (args.step) {',
      '  userEvent++;',
      '}',
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'vitest-browser-import-expression-type',
    title:
      "a click before a type on Vitest browser's userEvent from an import expression has no shape",
    source: inPlay(
      "const { userEvent: ue } = await import('vitest/browser');",
      "await ue.click(canvas.getByRole('textbox'));",
      "await ue.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'vitest-browser-import-expression-shadows-context',
    title:
      "a click before a type on Vitest browser's userEvent from an import expression that shadows the play context's has no shape",
    source: inPlay(
      "await step('fill', async () => {",
      "  const { userEvent } = await import('vitest/browser');",
      "  await userEvent.click(canvas.getByRole('textbox'));",
      "  await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      '});',
    ),
    expect: [[], []],
  },
  {
    id: 'vitest-browser-setup-type',
    title:
      "a click before a type on a setup() local of Vitest browser's userEvent has no shape",
    source: [
      "import { userEvent } from 'vitest/browser';",
      "export default { title: 'Form' };",
      'export const Form = {',
      '  play: async ({ canvas }) => {',
      '    const user = userEvent.setup();',
      "    await user.click(canvas.getByRole('textbox'));",
      "    await user.type(canvas.getByRole('textbox'), 'Ada');",
      '  },',
      '};',
      '',
    ].join('\n'),
    expect: [[], []],
  },
  {
    id: 'fire-event-click-before-type',
    title:
      'a fireEvent click before a type has no shape, as the type repeats only a user-event click',
    source: inPlay(
      "await fireEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [[], []],
  },
  {
    id: 'cleared-later',
    title:
      'a type that the next interaction clears with no check between them is cleared-later',
    source: inPlay(
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      "await userEvent.clear(canvas.getByRole('textbox'));",
    ),
    expect: [['cleared-later'], []],
  },
  {
    id: 'checked-before-clear',
    title: 'a type that a check reads before the clear has no shape',
    source: inPlay(
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      "await expect(canvas.getByRole('textbox')).toHaveValue('Ada');",
      "await userEvent.clear(canvas.getByRole('textbox'));",
    ),
    expect: [[], []],
  },
  {
    id: 'two-hints',
    title:
      'a click before a type is click-before-type and the type that the next interaction clears is cleared-later',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox'));",
      "await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
      "await userEvent.clear(canvas.getByRole('textbox'));",
    ),
    expect: [['click-before-type'], ['cleared-later'], []],
  },
  {
    id: 'several-mutators',
    title:
      'an interaction whose following checks are all negative is negative-only, whichever mutators survive on it',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    expect: [['negative-only']],
  },
  {
    id: 'target-on-later-line',
    title:
      'an interaction whose target stands on a later line than the interaction starts is negative-only when its following checks are all negative',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Open' }));",
      'await userEvent.click(',
      "  canvas.getByRole('button', { name: 'Save' }),",
      ');',
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    expect: [[], ['negative-only']],
  },
  {
    id: 'shared-line',
    title:
      'two interactions on one line have a shape each: the click before the type is click-before-type, and the type has none',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox')); await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [['click-before-type'], []],
  },
  {
    id: 'shared-line-no-name-left',
    title:
      'the type that shares a line with the click before it has no shape, so the line holds a mutant with no shape',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('textbox')); await userEvent.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [['click-before-type'], []],
  },
  {
    title:
      'an interaction whose negative checks are followed by an if that holds an interaction and then by negative checks only is no longer negative-only, as the if may or may not run one (behaviour change 8)',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'await expect(args.onSave).not.toHaveBeenCalled();',
      "if (args.open) { await userEvent.click(canvas.getByRole('checkbox')); }",
      'await expect(args.onClose).not.toHaveBeenCalled();',
    ),
    expect: [[], ['negative-only']],
  },
  {
    title:
      'an interaction whose following checks past a function declaration that holds an interaction are all negative is negative-only, as declaring a function runs nothing (behaviour change 10)',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button'));",
      'function openMenu() { userEvent.click(menu); }',
      'await expect(args.onSave).not.toHaveBeenCalled();',
    ),
    expect: [['negative-only'], []],
  },
  {
    title:
      "a click before a type on a local that aliases the play context's userEvent is click-before-type, as the alias is user-event 14 (behaviour change 6)",
    source: inPlay(
      'const user = userEvent;',
      "await user.click(canvas.getByRole('textbox'));",
      "await user.type(canvas.getByRole('textbox'), 'Ada');",
    ),
    expect: [['click-before-type'], []],
  },
];

describe('interactionsOf as the reporter reads its interaction shapes', () => {
  shapeCases.forEach(({ id, title, source, expect }) => {
    it(id === undefined ? title : `${title} (${id})`, () => {
      assert.deepEqual(shapesIn(source), [expect, expect]);
    });
  });
});
