<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/proteus-storybook-test

StrykerJS mutators for Storybook story test code: play functions, `beforeEach` and `afterEach`, and the bodies of
`.test()` calls. Mutation testing usually changes the component and checks that a story test fails. These mutators
change the play instead: they remove an interaction, replace a click with a focus, run a check before the
interaction it follows, or remove a spy stub. When the story tests still pass, a step of the play does not affect
what the play checks, or a check is missing.

The package turns Stryker's 17 built-in mutators off and adds 9 of its own: 2 run by default, 0 are opt-in and 7 are
experimental. The package is private and not on npm yet.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1. The install patches internals of that version's instrumenter, and
  warns when `@stryker-mutator/instrumenter` is a version other than 10.1.1.
- Storybook 10.6 or a later 10.x minor, tested on 10.6.5. The mutators read story files as source and import nothing
  from Storybook, so the package declares no `storybook` peer dependency. The `storybook` peer of
  `@muirjs/moira-storybook`, which it depends on, still asks for Storybook.
- Stryker's Vitest runner, `@stryker-mutator/vitest-runner`, with Storybook's Vitest addon,
  `@storybook/addon-vitest`, running the story tests.
- `@muirjs/shadowcat-storybook`, for its CSF ignorer and its `muir-shadowcat-storybook` ignorer and reporter. Its README describes
  the Vitest and Storybook setup that both Stryker configurations share.
- Node.js 22 or later.

## Turn the mutators on

The package turns Stryker's built-in mutators off for every file in the run, components included. Give it a Stryker
configuration whose `mutate` holds only story files, and set the CSF ignorer's play mode to `mutate`, so that it
keeps the mutants in story test code. Mutate the components and story data in a separate configuration, as the
`@muirjs/shadowcat-storybook` README shows.

Call `muirProteusStorybookTestMutators` at the top of the Stryker configuration file and await it:

```ts
// stryker.test-code.config.mjs
import { muirProteusStorybookTestMutators } from '@muirjs/proteus-storybook-test';

await muirProteusStorybookTestMutators();

export default {
  testRunner: 'vitest',
  mutate: ['src/**/*.stories.tsx'],
  appendPlugins: ['@muirjs/shadowcat-storybook', '@muirjs/shadowcat-storybook-vitest'],
  ignorers: ['muir-shadowcat-storybook-csf', 'muir-shadowcat-storybook-vitest'],
  muirShadowcatStorybookCsf: { play: 'mutate' },
  reporters: ['clear-text', 'html', 'muir-shadowcat-storybook'],
};
```

Await the call, so that an error in the install stops the run. The configuration file must be a JavaScript or
TypeScript ES module, because a JSON configuration cannot import a module.

With the play mode left at `ignore`, the CSF ignorer reports every mutant in story test code as Ignored, and the run
kills nothing.

The call prints one line:

```text
@muirjs/proteus-storybook-test: Stryker's 17 built-in mutators are off for every file in this run; 2 MuirProteusStorybookTest mutators on.
```

The call checks that each mutator it installs makes a mutant of a sample, and that no built-in mutator makes one. It
stops the run when either check fails, and names the instrumenter's folder and version when an internal it patches
is missing. A second call replaces the mutators and settings of the first.

### Choose the experimental mutators

The argument turns on mutators beyond the default tier:

```ts
// Two experimental mutators by their names.
await muirProteusStorybookTestMutators({
  experimental: {
    MuirProteusStorybookTestInteractionRepeat: true,
    MuirProteusStorybookTestSpyStub: true,
  },
});

// Every experimental mutator.
await muirProteusStorybookTestMutators({ experimental: true });
```

- `experimental: true` turns on every experimental mutator.
- `experimental: { <experimental name>: true }` turns on one experimental mutator.

The package has no opt-in mutators, so an `extended` key throws.

With opt-in or experimental mutators on, the line names them. For `{ experimental: { MuirProteusStorybookTestSpyStub: true } }`:

```text
@muirjs/proteus-storybook-test: Stryker's 17 built-in mutators are off for every file in this run; 3 MuirProteusStorybookTest mutators on. Opt-in or experimental: MuirProteusStorybookTestSpyStub.
```

The call throws, with a message that starts with the package name, on options that are not a plain object, on an
unknown key, on a value other than `true`, on the name of a default mutator, and on an experimental name outside
`experimental`. The options turn mutators on, never off. To turn one off,
see [Turn a mutator off](#turn-a-mutator-off).

## The mutators

Each mutator's name is the mutator name in Stryker's reports.

An interaction is a call that acts on the rendered story: a user-event call such as `userEvent.click(...)`, a
`fireEvent` call, a composed play such as `Other.play(context)`, or a raw DOM call such as `element.focus()` in story
test code. The interaction mutators take an interaction that stands alone as a statement, or as the expression body
of an arrow. They make no mutant of an interaction in a `beforeEach` or `afterEach`, which sets the story up.

### Default mutators

These run on `await muirProteusStorybookTestMutators()`.

| Mutator                               | What it changes                                                                                                                                                                       | Example                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `MuirProteusStorybookTestInteraction` | Removes an interaction.                                                                                                                                                               | `await userEvent.click(canvas.getByRole('button'));` is removed.                                          |
| `MuirProteusStorybookTestClickFocus`  | Replaces a user-event `click` or `dblClick` with a `focus()` of its target, when the target is a query, an awaited query or a name, and not a text field, label or placeholder query. | `await userEvent.click(canvas.getByRole('switch'));` becomes `await canvas.getByRole('switch').focus();`. |

### Opt-in mutators

None.

### Experimental mutators

These run with `experimental: true`, or each by its name inside `experimental`. They are experimental: each was
measured on few repositories, or none, and its matching rules or its name can still change.

| Mutator                                     | What it changes                                                                                                                                                                                                                      | Example                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `MuirProteusStorybookTestInteractionRepeat` | Runs a user-event `click`, `dblClick` or `keyboard` call, or a `fireEvent.click`, twice. Leaves `{Home}` and `{End}` alone.                                                                                                          | `await userEvent.click(button);` runs twice, so a toggle ends where it started.                                          |
| `MuirProteusStorybookTestInteractionTarget` | Replaces the query an interaction acts on with another one in the same file: the `name` of a `*ByRole` query with a name the file gives the same role, or the text of another query with a value the file passes to the same method. | `canvas.getByRole('button', { name: 'Save' })` becomes `canvas.getByRole('button', { name: 'Cancel' })`.                 |
| `MuirProteusStorybookTestWaitFor`           | Makes a retrying wait check once: calls a `waitFor` callback once, turns a `findBy` or `findAllBy` query into `getBy` or `getAllBy`, and removes a `waitForElementToBeRemoved` statement.                                            | `await canvas.findByText('Saved')` becomes `await canvas.getByText('Saved')`.                                            |
| `MuirProteusStorybookTestAssertionBefore`   | Runs the first `expect` check after an interaction before the interaction too, so a check that already passes before the step shows.                                                                                                 | `await userEvent.click(button); await expect(args.onClick).toHaveBeenCalled();` also runs the `expect` before the click. |
| `MuirProteusStorybookTestSpyStub`           | Removes a spy stub (`mockReturnValue`, `mockResolvedValue`, `mockRejectedValue`, `mockImplementation` or a `Once` form) set at definition time, or as a statement in story test code.                                                | `onSave: fn().mockResolvedValue(note)` becomes `onSave: fn()`.                                                           |
| `MuirProteusStorybookTestSpyStubOutcome`    | Turns a `mockResolvedValue` stub into `mockRejectedValue(new Error('Stryker'))`, and a `mockRejectedValue` stub into `mockResolvedValue(undefined)`, keeping a `Once` form.                                                          | `fn().mockResolvedValue(note)` becomes `fn().mockRejectedValue(new Error('Stryker'))`.                                   |
| `MuirProteusStorybookTestStoryGlobals`      | Removes one property of the `globals` of a story, of the meta or of a `.test()` call's options, for each story that runs a play or a `.test()` call.                                                                                 | `globals: { viewport: { value: 'mobile1' } }` becomes `globals: {}`.                                                     |

`MuirProteusStorybookTestStoryGlobals` makes no mutant of a global set to Storybook 10.6.5's own initial value, such as
`viewport: 'responsive'` or `outline: false`, when nothing in the file may set that global below it. It does not read
the project's `initialGlobals`.

`MuirProteusStorybookTestSpyStub` and `MuirProteusStorybookTestSpyStubOutcome` place mutants at definition-time stubs that the mock reset
erases before the story renders. The `muir-shadowcat-storybook` ignorer of `@muirjs/shadowcat-storybook` reports those mutants as
Ignored, with the reason, so list it in `ignorers` whenever these mutators are on.

### Why a mutator is opt-in or experimental

A mutator moves to the default tier when it has been measured on at least two open-source repositories with at least
10 sites between them, more than half of its triaged survivors point at a missing or weak check, and none of its
kills needs a timeout. A run whose survivors are mostly equivalent sends it back for rework or removal. The
[mutator process](https://github.com/muirjs/muir/blob/main/docs/mutator-process.md#how-a-measured-mutator-ships) has
the details.

| Mutator                                     | Why                                                                                                                                                                                                                          | What would move it                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `MuirProteusStorybookTestInteractionRepeat` | Never measured: 19 sites were counted in one design system and 5 in another. A survivor on an interaction that changes nothing when repeated, such as clicking a selected tab, is equivalent, and no rule tells those apart. | Its first measured run on two repositories.                                                   |
| `MuirProteusStorybookTestInteractionTarget` | On one design system all 11 mutants were killed, each because the swapped query found nothing, which says nothing about the checks.                                                                                          | Swapping only to names that the same story queries, then a measured run.                      |
| `MuirProteusStorybookTestWaitFor`           | A survivor says only that the wait was not needed in that run, and a one-shot check that races the component can be flaky.                                                                                                   | More measured repositories.                                                                   |
| `MuirProteusStorybookTestAssertionBefore`   | No repository yet has a site where it survives, so nothing shows what a survivor means.                                                                                                                                      | A measured run with survivors to triage.                                                      |
| `MuirProteusStorybookTestSpyStub`           | A stub set at definition time makes a mutant that runs every story test, and that cost is unmeasured.                                                                                                                        | A run that measures the cost and the survivors.                                               |
| `MuirProteusStorybookTestSpyStubOutcome`    | On a callback the component does not await, the mutant makes an unhandled rejection that fails the story whatever its checks say, and each such kill waits about a second.                                                   | A measured run: if most kills come from an unhandled rejection, it goes opt-in or is removed. |
| `MuirProteusStorybookTestStoryGlobals`      | Measured on one repository: 30 mutants, 12 survivors, 5 of them pointing at a weak check. No second repository with sites has been found.                                                                                    | A second repository.                                                                          |

## Why Stryker's built-in mutators are off

Stryker's built-in mutators target app code. In play functions their mutants either survive whatever the play
checks, such as an emptied play body or a removed `expect`, or fail whenever their line runs, such as an emptied
role name, which Testing Library matches exactly. An analysis of 2,459 play mutants across three component libraries
(Angular, plain HTML and React) decided each built-in on its own. None of the 17 stays on in story test code:

| Built-in mutator        | Why it is off in story test code                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ArithmeticOperator`    | Changes expected geometry and computed test data, which fails wherever it runs, or a sort comparator, which survives by construction.                              |
| `ArrayDeclaration`      | Empties expected arrays, which fails wherever it runs, or loop data and `arrayContaining([])`, which pass by construction.                                         |
| `ArrowFunction`         | Empties `waitFor` callbacks, which then resolve at once, and array callbacks, which survive or fail wherever they run.                                             |
| `AssignmentOperator`    | Changes local flags and counters, which fails wherever it runs.                                                                                                    |
| `BlockStatement`        | Empties play, step, `waitFor`, loop and `try` bodies, which hold the checks, so the play passes by construction.                                                   |
| `BooleanLiteral`        | Flips expected booleans and query flags, which fails wherever it runs.                                                                                             |
| `CallExpression`        | Removes `expect` and assertion statements, which survive by construction; `MuirProteusStorybookTestInteraction` removes interaction statements.                    |
| `ConditionalExpression` | Forces guards that a passing play never takes, which survive by construction, or that it always takes, which fail.                                                 |
| `EqualityOperator`      | Changes guards and predicates at boundaries that the play never reaches, or that fail wherever they run.                                                           |
| `LogicalOperator`       | Changes fallbacks and predicates, which are equivalent or fail wherever they run.                                                                                  |
| `MethodExpression`      | Changes `trim`, `toLowerCase` and `filter` calls on assertion subjects, which are equivalent or fail wherever they run.                                            |
| `ObjectLiteral`         | Empties query options, which only loosen a query with one candidate, and expected objects or wait options, which pass by construction or fail.                     |
| `OptionalChaining`      | Changes a `null` path that a passing play never takes.                                                                                                             |
| `Regex`                 | Widens or narrows a query pattern, which is equivalent, fails with a multiple-match error, or finds nothing and fails wherever it runs.                            |
| `StringLiteral`         | Empties roles, names and expected text, which Testing Library matches exactly, so the line fails wherever it runs, or negative checks, which pass by construction. |
| `UnaryOperator`         | Flips coordinate signs and negations, which fails wherever it runs.                                                                                                |
| `UpdateOperator`        | Changes loop counters, which hangs or fails wherever it runs.                                                                                                      |

A mutant that fails whenever its line runs is killed by every test that reaches the line, so it shows only that the
line runs, not what the play checks. It costs run time and finds nothing.

The install removes the built-ins by name, for every file in the run. An msw handler file mutated in the same
configuration gets no built-in mutants either; `@muirjs/proteus-msw` keeps the built-ins only in a run without
this package. Mutators from other packages stay on. When the instrumenter holds a mutator that is neither one of the
17 nor from a `@muirjs` package, the install warns that it stays on and that this package has not reviewed it.

## Turn a mutator off

For the whole run, list the mutator in `mutator.excludedMutations`. The names are case sensitive, and Stryker does
not check them, so a misspelt name excludes nothing and logs nothing. Stryker still reports an excluded mutant, as
Ignored.

For one mutant, put a Stryker disable comment with a reason on the line before the statement:

```ts
// Stryker disable next-line MuirProteusStorybookTestInteraction: the click only moves focus, which the next type does too
await userEvent.click(input);
```

A disable comment matches each mutator name exactly, ignoring case only. `MuirProteusStorybookTestSpyStub` and
`MuirProteusStorybookTestSpyStubOutcome` are two names, so silence both with
`// Stryker disable next-line MuirProteusStorybookTestSpyStub,MuirProteusStorybookTestSpyStubOutcome: <reason>` or with `all`.

For a block, use `// Stryker disable <name>: <reason>` and `// Stryker restore <name>`.

## Survivors to expect and limits

The mutators place a mutant unless the story file proves that it changes nothing. Where a survivor changes nothing
that any check could see, disable it with a reason. The `muir-shadowcat-storybook` reporter of `@muirjs/shadowcat-storybook` writes
a ready disable comment for the common shapes below.

### The interaction mutators

- An interaction that a later one makes redundant survives: a click or hover directly before a `type` of the same
  target, which clicks first, or a `type` or `clear` that the next interaction clears. The reporter names these
  `click-before-type` and `cleared-later`.
- An interaction whose following checks are all negative, such as `expect(dialog).not.toBeVisible()`, survives when
  the interaction did nothing the check could see. The reporter names it `negative-only`.
- The mutators match calls by name and by where the receiver comes from, as far as the file shows it. A `userEvent`
  the file does not prove to be user-event's, such as one destructured from a function's own parameter, still gets
  mutants.
- On one open-source design system, every `MuirProteusStorybookTestClickFocus` survivor (3 of 23 placed mutants) was a play that
  clicks and then checks nothing that the click does.
- On the same design system, every `MuirProteusStorybookTestInteractionTarget` mutant (11) was killed, and each kill came from the
  swapped query finding nothing: the name came from another story in the file, which the rendered story lacks (read
  from each story, as the Vitest runner reports no kill reason). Such a kill shows only that the swapped element is
  absent. That is why the mutator is experimental.

### The spy stub mutators

- A removed stub survives when no check reads what the spy returns. The `muir-shadowcat-storybook` reporter lists its line as an
  unchecked stub.
- A surviving outcome mutant shows that no check tells success from failure of that call. Where the removed stub
  was killed or timed out, the reporter lists the line as an outcome-unchecked stub; where it survived, the
  unchecked stub on that line covers both. Turn on `MuirProteusStorybookTestSpyStub` too: without the removal, an outcome
  survivor gets no finding.

### MuirProteusStorybookTestStoryGlobals

- A global whose value equals what the story gets without it survives, such as a meta global that every story sets
  again, or a value equal to the project's own `initialGlobals`.
- A story or meta that the file changes at run time, such as `meta.globals.outline = true`, keeps the mutants of every
  global, since the file cannot show what the change sets.

## License

MIT
