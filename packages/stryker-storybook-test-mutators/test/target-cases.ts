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
    id: 'target-negative-only',
    title:
      'the target of an interaction whose checks before the next interaction are all negative becomes another target in the file',
    source: inPlay(
      "await expect(canvas.getByRole('tab', { name: 'Profile' })).toBeVisible();",
      "await userEvent.click(canvas.getByRole('tab', { name: 'Billing' }));",
      'await expect(args.onChange).not.toHaveBeenCalled();',
    ),
    expect: [[target, "'Profile'"]],
  },
  {
    id: 'target-cleared-later',
    title:
      'the target of a type that a later clear of the same target undoes becomes another target in the file',
    source: inPlay(
      "await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'a');",
      "await userEvent.clear(canvas.getByRole('textbox', { name: 'Name' }));",
      "await expect(canvas.getByRole('textbox', { name: 'Email' })).toBeVisible();",
    ),
    expect: [
      [target, "'Email'"],
      [target, "'Email'"],
    ],
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
    id: 'target-skip-role',
    title:
      'the role of a role query with no name is not swapped for another role, so it makes no mutant',
    source: inPlay(
      "await userEvent.click(canvas.getByRole('checkbox'));",
      "await expect(canvas.getByRole('switch')).toBeChecked();",
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
    id: 'target-query-by-role',
    title:
      'the name of a queryByRole query an interaction acts on is swapped too',
    source: inPlay(
      "await userEvent.click(canvas.queryByRole('button', { name: 'Save' }));",
      "await expect(canvas.queryByRole('button', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [[target, "'Cancel'"]],
  },
  {
    id: 'target-inside-target',
    title:
      'a query inside the target query, such as the container a within(...) reads, makes no mutant',
    source: inPlay(
      "await userEvent.click(within(canvas.getByRole('dialog', { name: 'Save' })).getByRole('button'));",
      "await expect(canvas.getByRole('dialog', { name: 'Cancel' })).toBeVisible();",
    ),
    expect: [],
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
