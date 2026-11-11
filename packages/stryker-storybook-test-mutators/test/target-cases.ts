import { type Case, inPlay } from './support/case.ts';

const target = 'LzStorybookInteractionTarget';

export const targetCases: readonly Case[] = [
  {
    id: 'target-role-name',
    title:
      'the name of a role query an interaction acts on becomes the name the same role query takes elsewhere in the file',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));",
    ),
    expect: [
      [target, "'Cancel'"],
      [target, "'Save'"],
    ],
  },
  {
    id: 'target-check-subject',
    title:
      'a query that no interaction acts on, such as the subject of a check, gives its value but makes no mutant',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-skip-negative-only',
    title:
      'an interaction whose following checks are all negative makes no mutant',
    source: inPlay(
      "await expect(canvas.getByRole('tab', { name: 'Profile' })).toBeVisible();",
      "await userEvent.click(canvas.getByRole('tab', { name: 'Billing' }));",
      'await expect(args.onChange).not.toHaveBeenCalled();',
    ),
    expect: [],
  },
  {
    id: 'target-text',
    title:
      'the text of a text query an interaction acts on becomes the text the same query takes elsewhere in the file',
    source: inPlay(
      "await userEvent.click(canvas.getByText('Bold'));",
      "await expect(canvas.getByText('Italic')).toBeVisible();",
    ),
    expect: [[target, "'Italic'"]],
  },
  {
    id: 'target-awaited-find-by-role',
    title:
      'the name of an awaited findByRole query an interaction acts on becomes the name another findByRole query of that role takes',
    source: inPlay(
      "await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));",
      "await expect(await canvas.findByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-other-role',
    title: 'a name that a query of another role takes is no replacement',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await expect(canvas.getByRole('link', { name: 'Home' })).toBeVisible();",
    ),
    expect: [],
  },
  {
    id: 'target-get-and-find-by-role',
    title:
      'the name of a getByRole query becomes the name a findByRole query of the same role takes',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { name: 'Save' }));",
      "await expect(await canvas.findByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-role-variable',
    title:
      'a role query whose role is no string literal makes no mutant, as its role is unknown',
    source: inPlay(
      'await userEvent.click(canvas.getByRole(role, { name: "One" }));',
      'await userEvent.click(canvas.getByRole(other, { name: "Two" }));',
    ),
    expect: [],
  },
  {
    id: 'target-quoted-name-key',
    title: "a role query's name under a quoted key is swapped too",
    source: inPlay(
      "await userEvent.click(canvas.getByRole('button', { 'name': 'Save' }));",
      "await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));",
    ),
    expect: [
      [target, "'Cancel'"],
      [target, "'Save'"],
    ],
  },
  {
    id: 'target-step-body',
    title:
      'the target query of an interaction that is the expression body of a step is swapped too',
    source: `export const Story = {\n  play: async ({ canvas, step, userEvent }) => {\n    await step('Save', () => userEvent.click(canvas.getByRole('button', { name: 'Save' })));\n    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible();\n  },\n};\n`,
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-optional-call',
    title: 'the target query of a userEvent?.click is swapped too',
    source: inPlay(
      "await userEvent?.click(canvas.getByRole('button', { name: 'Save' }));",
      "await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-fire-event',
    title: 'the target of a fireEvent call is swapped too',
    source: inPlay(
      "await fireEvent.click(canvas.getByTestId('save'));",
      "await expect(canvas.getByTestId('cancel')).toBeVisible();",
    ),
    expect: [[target, "'cancel'"]],
  },
  {
    id: 'target-skip-before-each',
    title: 'an interaction in a beforeEach makes no mutant',
    source: `export const Story = {\n  beforeEach: async ({ userEvent }) => {\n    await userEvent.click(canvas.getByTestId('save'));\n  },\n  play: async ({ canvas }) => {\n    await expect(canvas.getByTestId('cancel')).toBeVisible();\n  },\n};\n`,
    expect: [],
  },
];
