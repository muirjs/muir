import { type Case, inFactoryFile, inStory } from './support/case.ts';

const args = 'LzStorybookArgs';

export const readCases: readonly Case[] = [
  {
    id: 'play-method',
    title: 'a play written as a method reads args like an arrow',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'async play({ args, canvas }) {',
      '  await expect(canvas.getByText(args.label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'args-as-key-name',
    title:
      'an args member or object key that is not the args object reads nothing',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  await expect(canvas.getByText(other.args)).toBeVisible();',
      "  log({ args: 'none' });",
      '},',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'member-read',
    title: 'a key the play reads as args.<key> stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  await expect(canvas.getByText(args.label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'parameter-destructure',
    title: 'a key the play destructures from args in its parameter stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { label }, canvas }) => {',
      '  await expect(canvas.getByText(label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'rest-destructure',
    title: 'a play that collects the rest of args makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { label, ...rest }, canvas }) => {',
      '  await expect(canvas.getByText(describe(rest))).toBeVisible();',
      '},',
    ),
    expect: [],
  },
  {
    id: 'context-rest',
    title: 'a play that collects the rest of its context makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ canvas, ...context }) => {',
      '  await expect(canvas.getByText(context.args.label)).toBeVisible();',
      '},',
    ),
    expect: [],
  },
  {
    id: 'body-destructure',
    title: 'a key the play destructures from args in its body stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  const { label } = args;',
      '  await expect(canvas.getByText(label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'whole-args',
    title: 'a play that passes args whole makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args, canvas }) => {',
      '  await expect(canvas.getByText(describe(args))).toBeVisible();',
      '},',
    ),
    expect: [],
  },
  {
    id: 'context-member-read',
    title: 'a key the play reads as context.args.<key> stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context) => {',
      '  await expect(context.canvas.getByText(context.args.label)).toBeVisible();',
      '},',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'whole-context',
    title: 'a play that passes its context whole makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context) => {',
      '  await Base.play(context);',
      '},',
    ),
    expect: [],
  },
  {
    id: 'context-default',
    title: 'a context parameter with a default makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context = {}) => { context.args.label; },',
    ),
    expect: [],
  },
  {
    id: 'pattern-default',
    title:
      'a destructured context parameter with a default makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args } = {}) => { args.label; },',
    ),
    expect: [],
  },
  {
    id: 'rest-parameter',
    title: 'a rest parameter makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (...context) => { context[0].args.label; },',
    ),
    expect: [],
  },
  {
    id: 'arguments',
    title: 'a play that reads arguments makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async function () { arguments[0].args.label; },',
    ),
    expect: [],
  },
  {
    id: 'args-default',
    title: 'a key read through args with a default in the pattern stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args = {} }) => { args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'args-pattern-default',
    title: 'a key destructured from args with a default in the pattern stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { label } = {} }) => { label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'string-key-member-read',
    title: 'a quoted key the play reads as args.<key> stays',
    source: inStory(
      "args: { 'label': 'a', disabled: true },",
      'play: async ({ args }) => { args.label; },',
    ),
    expect: [[args, "{ 'label': 'a' }"]],
  },
  {
    id: 'string-computed-member-read',
    title: "a key the play reads as args['<key>'] stays",
    source: inStory(
      "args: { label: 'a', disabled: true },",
      "play: async ({ args }) => { args['label']; },",
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'number-computed-member-read',
    title: 'a numeric key the play reads as args[<number>] stays',
    source: inStory(
      "args: { 0: 'a', disabled: true },",
      'play: async ({ args }) => { args[0]; },',
    ),
    expect: [[args, "{ 0: 'a' }"]],
  },
  {
    id: 'string-key-destructure',
    title: 'a key the play destructures with quotes stays, and only that key',
    source: inStory(
      "args: { 'aria-label': 'a', title: 'b', disabled: true },",
      "play: async ({ args: { 'aria-label': label } }) => { label; },",
    ),
    expect: [
      [args, "{ 'aria-label': 'a', disabled: true }"],
      [args, "{ 'aria-label': 'a', title: 'b' }"],
      [args, "{ 'aria-label': 'a' }"],
    ],
  },
  {
    id: 'shadowed-args',
    title: 'a read of an inner variable that shadows args reads no key',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args }) => {',
      '  const f = (args) => args.label;',
      '},',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'initial-args-read',
    title: 'a key the play reads as initialArgs.<key> stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ initialArgs }) => { initialArgs.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'context-key-read',
    title:
      'a key the play reads as context.args.<key> from its context key stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ context }) => { context.args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'step-callback-read',
    title: 'a key a step callback reads from the context step passes it stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      "play: async ({ step }) => { await step('s', async ({ args }) => { args.label; }); },",
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'step-member-callback-read',
    title:
      'a key a step callback reads stays when the play calls step on its context',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      "play: async (context) => { await context.step('s', async ({ args }) => { args.label; }); },",
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'other-call-callback',
    title:
      'a key read by a callback passed to a call other than step is removed, as that call does not pass the context',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async () => { items.map(({ args }) => args.label); },',
    ),
    expect: [
      [args, '{ disabled: true }'],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'this-parameter',
    title:
      'a key the play reads through the context parameter after a TypeScript this parameter stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async function (this: void, { args }) { args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'args-alias',
    title: 'a key the play reads through a variable that holds args stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args }) => { const a = args; a.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'context-args-alias',
    title:
      'a key the play reads through a variable that holds context.args stays',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async (context) => { const args = context.args; args.label; },',
    ),
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'computed-pattern-key',
    title:
      'a play that destructures args with a computed key makes every key stay',
    source: inStory(
      "args: { label: 'a', disabled: true },",
      'play: async ({ args: { [key]: value } }) => { value; },',
    ),
    expect: [],
  },
  {
    id: 'meta-key-play-reads',
    title: 'a meta key that the play of a story taking it reads stays',
    source:
      "export default { title: 'Button', args: { label: 'a', size: 's' } };\n" +
      'export const Primary = { play: async ({ args }) => { log(args.label); } };\n',
    expect: [[args, "{ label: 'a' }"]],
  },
  {
    id: 'meta-key-read-where-given',
    title:
      'a meta key read only by a story that gives the key itself is removed, as that play reads the story value',
    source:
      "export default { title: 'Button', args: { label: 'a', size: 's' } };\n" +
      "export const Long = { args: { label: 'b' }, play: async ({ args }) => { log(args.label); } };\n" +
      'export const Other = { play: async () => {} };\n',
    expect: [
      [args, "{ size: 's' }"],
      [args, "{ label: 'a' }"],
    ],
  },
  {
    id: 'meta-key-test-reads',
    title:
      'a meta key that a .test() function of a story taking it reads stays',
    source: inFactoryFile(
      "const meta = preview.meta({ title: 'Button', args: { label: 'a', size: 's' } });",
      'export const Primary = meta.story({});',
      "Primary.test('t', async ({ args }) => { log(args.size); });",
    ),
    expect: [[args, "{ size: 's' }"]],
  },
  {
    id: 'meta-args-spread-into-story',
    title:
      "a meta key that a story spreads from the meta's args and its play reads stays",
    source:
      "const meta = { title: 'Button', args: { label: 'a', size: 's' } };\n" +
      'export default meta;\n' +
      'export const Primary = { args: { ...meta.args, disabled: true }, play: async ({ args }) => { log(args.label); } };\n',
    expect: [
      [args, "{ label: 'a' }"],
      [args, '{ ...meta.args }'],
    ],
  },
];
