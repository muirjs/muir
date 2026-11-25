import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  inPlay,
  interactionsIn,
  type KindCase,
} from './support/interactions.ts';
import { inPlayWith } from './support/story-source.ts';

const importUserEvent = "import { userEvent } from 'storybook/test';\n";

const writeCases: readonly KindCase[] = [
  {
    title:
      'a click on an imported userEvent after an array pattern assigns its click is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '[userEvent.click] = [fake];', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on a namespace import's userEvent after the play assigns its click is of unproven origin",
    source: `import * as t from 'storybook/test';\n${inPlayWith(['canvas'], 't.userEvent.click = fake;', "await t.userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on import('storybook/test')'s userEvent after a write to a member of an unbound name is a user-event 14 click",
    source: inPlayWith(
      ['canvas'],
      'window.flag = true;',
      "await (await import('storybook/test')).userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a local aliasing it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], 'const u = userEvent;', 'u.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on context.userEvent after the play writes a member of args destructured from the context is a user-event 14 click',
    source: `export const Story = {\n  play: async (context) => {\n    const { args } = context;\n    args.value = 'x';\n    await context.userEvent.click(context.canvas.getByRole('a'));\n  },\n};\n`,
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      'a click on context.userEvent after the play assigns the click of a userEvent destructured from the context is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    const { userEvent } = context;\n    userEvent.click = fake;\n    await context.userEvent.click(context.canvas.getByRole('a'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on a local aliasing an imported userEvent after the play assigns the import's click is of unproven origin",
    source: `${importUserEvent}${inPlayWith(['canvas'], 'userEvent.click = fake;', 'const u = userEvent;', "await u.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on context.userEvent after an array pattern assigns it is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    [context.userEvent] = [fake];\n    await context.userEvent.click(context.canvas.getByRole('a'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after an object pattern assigns its click is of unproven origin",
    source: inPlay(
      '({ click: userEvent.click } = { click: fake });',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on context.userEvent after a for...of head assigns it is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    for (context.userEvent of [fake]) {}\n    await context.userEvent.click(context.canvas.getByRole('a'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on a userEvent destructured from the context after a for...in head assigns its click is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    const { userEvent } = context;\n    for (userEvent.click in { fake }) {}\n    await userEvent.click(context.canvas.getByRole('a'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on context.userEvent after the play assigns the click of a local holding context.userEvent is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    const u = context.userEvent;\n    u.click = fake;\n    await context.userEvent.click(context.canvas.getByRole('a'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on a namespace import's userEvent after the play assigns the click of a local holding it is of unproven origin",
    source: `import * as t from 'storybook/test';\n${inPlayWith(['canvas'], 'const u = t.userEvent;', 'u.click = fake;', "await t.userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on an imported userEvent after the play assigns the click of a namespace import's userEvent of the same module is of unproven origin",
    source: `import * as t from 'storybook/test';\n${importUserEvent}${inPlayWith(['canvas'], 't.userEvent.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a second named import of the same module is of unproven origin',
    source: `import { userEvent as ue } from 'storybook/test';\n${importUserEvent}${inPlayWith(['canvas'], 'ue.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a local that may hold it by a conditional is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], 'const u = flag ? userEvent : x;', 'u.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a local that may hold it by a logical or is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], 'const u = x || userEvent;', 'u.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a local that may hold it by a nullish coalescing is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], 'const u = userEvent ?? x;', 'u.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a local holding it by a sequence is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], 'const u = (0, userEvent);', 'u.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a conditional that may hold it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(flag ? userEvent : x).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a logical or that may hold it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(x || userEvent).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a sequence ending in it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(0, userEvent).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a conditional whose arm is a sequence ending in it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(flag ? (0, userEvent) : x).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a logical or whose right is a conditional that may hold it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(a || (flag ? userEvent : x)).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a conditional that may hold its setup() call is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(flag ? userEvent.setup() : x).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of an assignment of it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(a = userEvent).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a sequence ending in a logical or whose right is a conditional that may hold it is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(0, a || (flag ? userEvent : x)).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of the second of two vars that hold each other is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], 'var first = flag ? userEvent : second;', 'var second = first;', 'second.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a setup() instance is of unproven origin, since a write refuses every receiver of its origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], 'const user = userEvent.setup();', 'user.click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on an imported userEvent after the play assigns the click of its setup() call's result is of unproven origin",
    source: `${importUserEvent}${inPlayWith(['canvas'], 'userEvent.setup().click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on context.userEvent after the play assigns a member of the context under a computed key is of unproven origin',
    source: `export const Story = {\n  play: async (context) => {\n    context[key] = fake;\n    await context.userEvent.click(context.canvas.getByRole('a'));\n  },\n};\n`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play writes a member of the last of 40 locals that each give the one before or itself is of unproven origin',
    source: `${importUserEvent}${inPlayWith(
      ['canvas'],
      'const u0 = userEvent;',
      ...Array.from(
        { length: 40 },
        (_, i) => `const u${i + 1} = u${i} || u${i};`,
      ),
      'u40.x = 1;',
      "await userEvent.click(canvas.getByRole('a'));",
    )}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after the play assigns the click of a choice whose alternate is that userEvent is of unproven origin",
    source: inPlay(
      '(flag ? driver : userEvent).click = fake;',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after the play assigns the click of a logical expression whose left side is that userEvent is of unproven origin",
    source: inPlay(
      '(userEvent || driver).click = fake;',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after the play assigns the click of a sequence whose last of three values is something else is a user-event 14 click",
    source: inPlay(
      '(log(), userEvent, driver).click = fake;',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
  {
    title:
      "a click on the play context's userEvent after the play assigns the click of a ??= whose right side is that userEvent is of unproven origin",
    source: inPlay(
      '(driver ??= userEvent).click = fake;',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after the play assigns the click of a ||= whose right side is that userEvent is of unproven origin",
    source: inPlay(
      '(driver ||= userEvent).click = fake;',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after the play assigns the click of a &&= whose right side is that userEvent is of unproven origin",
    source: inPlay(
      '(driver &&= userEvent).click = fake;',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click unproven'],
  },
  {
    title:
      'a click on an imported userEvent after the play assigns the click of a ??= whose target is that userEvent is of unproven origin',
    source: `${importUserEvent}${inPlayWith(['canvas'], '(userEvent ??= driver).click = fake;', "await userEvent.click(canvas.getByRole('a'));")}`,
    expect: ['userEvent click unproven'],
  },
  {
    title:
      "a click on the play context's userEvent after the play assigns the click of a += whose right side is that userEvent is a user-event 14 click",
    source: inPlay(
      '(label += userEvent).click = fake;',
      "await userEvent.click(canvas.getByRole('a'));",
    ),
    expect: ['userEvent click userEvent14'],
  },
];

describe('interactionsOf origins after a member write', () => {
  writeCases.forEach(({ title, source, expect }) => {
    it(title, () => {
      assert.deepEqual(interactionsIn(source), [expect, expect]);
    });
  });
});
