# @muirjs/proteus-storybook

StrykerJS mutators for Storybook story data: the `args` a story renders with. In many component libraries, the
story files are app code, so a run of the components can mutate them too. `LzStorybookArgs` removes one arg at a
time from a story that runs a play function or a `.test()` call. When the story tests still pass, no check depends on
that arg.

The package keeps Stryker's 17 built-in mutators on and adds 1 of its own: 0 run by default, 1 is opt-in and 0 are
experimental. So `await lzStorybookMutators()` with no options adds no mutator. The package is private and not on npm
yet.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1. The install patches internals of that version's instrumenter, and
  warns when `@stryker-mutator/instrumenter` is a version other than 10.1.1.
- Storybook 10.6 or a later 10.x minor, tested on 10.6.5. The mutator reads story files as source and imports nothing
  from Storybook, so the package declares no `storybook` peer dependency.
- Stryker's Vitest runner, `@stryker-mutator/vitest-runner`, with Storybook's Vitest addon,
  `@storybook/addon-vitest`, running the story tests.
- `@muirjs/shadowcat-storybook`, for its CSF ignorer and its `lz-storybook` ignorer and reporter. Its README describes
  the Vitest and Storybook setup that both Stryker configurations share.
- Node.js 22 or later.

## Turn the mutators on

Use this package in the Stryker configuration that mutates the components, with the story files in `mutate` and the
CSF ignorer's play mode left at its default, `ignore`. That mode keeps the mutants of story test code out of this run
and leaves the `args` to this package. Mutate story test code in a separate configuration, with
`@muirjs/proteus-storybook-test`.

Call `lzStorybookMutators` at the top of the Stryker configuration file, await it, and turn `LzStorybookArgs` on by
its name:

```ts
// stryker.config.mjs
import { lzStorybookMutators } from '@muirjs/proteus-storybook';

await lzStorybookMutators({ LzStorybookArgs: true });

export default {
  testRunner: 'vitest',
  mutate: ['src/**/*.tsx', '!src/**/*.test.tsx'],
  appendPlugins: ['@muirjs/shadowcat-storybook'],
  ignorers: ['lz-storybook-csf', 'lz-storybook'],
  reporters: ['clear-text', 'html', 'lz-storybook'],
};
```

Await the call, so that an error in the install stops the run. The configuration file must be a JavaScript or
TypeScript ES module, because a JSON configuration cannot import a module.

Without options the call prints this line and adds no mutator:

```text
@muirjs/proteus-storybook: 0 LzStorybook mutators on, beside Stryker's built-in mutators.
```

With `LzStorybookArgs` on, the line names it:

```text
@muirjs/proteus-storybook: 1 LzStorybook mutators on, beside Stryker's built-in mutators. Opt-in or experimental: LzStorybookArgs.
```

The call checks that each mutator it installs makes a mutant of a sample, and stops the run when one does not. It
names the instrumenter's folder and version when an internal it patches is missing. A second call replaces the
mutators of the first.

### Choose the opt-in mutators

The argument turns on mutators beyond the default tier. Each key takes only `true`:

- `extended: true` turns on every opt-in mutator.
- `<opt-in name>: true` turns on one opt-in mutator, such as `{ LzStorybookArgs: true }`.

The call throws, with a message that starts with the package name, on options that are not a plain object, on an
unknown key, on a value other than `true`, and on an `experimental` key, since the package has no experimental
mutators:

```text
@muirjs/proteus-storybook: the package has no experimental mutators yet, so lzStorybookMutators() takes no experimental option.
```

The options turn mutators on, never off. To turn one off, see [Turn a mutator off](#turn-a-mutator-off).

## The mutators

Each mutator's name is the mutator name in Stryker's reports.

### Default mutators

None. `await lzStorybookMutators()` adds no mutator.

### Opt-in mutators

These run with `extended: true`, or each with its own name set to `true`.

| Mutator           | What it changes                                                                                                                                        | Example                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `LzStorybookArgs` | Removes one key per mutant from an `args` object that a play or `.test()` call runs for. With two or more such keys, one more mutant removes them all. | `args: { label: 'Save', disabled: true }` becomes `args: { disabled: true }` in one mutant and `args: { label: 'Save' }` in another. |

`LzStorybookArgs` is opt-in because most of its survivors on one open-source design system were equivalent: 27 of
its 56 mutants survived, and 18 of those removed a key whose value equals what the story gets without it. See
[Survivors to expect](#survivors-to-expect-and-limits).

### Experimental mutators

None.

## What LzStorybookArgs mutates

Under Storybook's Vitest addon, a story without a play function or a `.test()` call only renders. A removed arg there
survives unless the render crashes, and the survivor says nothing about the story's checks. So `LzStorybookArgs`
mutates `args` only where a play or test function runs for them, decided from the story file alone:

- The `args` of a story that runs a play (its own, the meta's or a composed one) or a `.test()` call: a CSF3 story
  object, `.story({ args })` and `.extend({ args })`.
- The `args` in the options of `.test(name, { args }, fn)`.
- The meta's `args`, for the keys that a played story takes from the meta.

It leaves alone a key that the play or test function reads, as `args.label`, `context.args.label` or by
destructuring, since the expected value would move with the input. A function that hands `args` or its context on
whole reads every key.

A per-key mutant removes one key, so the story falls back to the value below it: a spread before the key, the base
story's for `.extend()`, the meta's, then the project's. A key whose literal value equals that value gets no mutant,
and neither does a key that a later property or a later spread the file can read sets again. When two or more keys
get a mutant, one more mutant removes all of them. The mutator skips any mutant that leaves only keys equal to the
value below them, since such args behave like the `{}` of Stryker's built-in `ObjectLiteral` mutant.

The mutator skips a mutant only when the story file proves that it changes nothing. Where the file cannot tell, it
places the mutant, and you disable a survivor you judge equivalent.

## Stryker's built-in mutators stay on

Story data is app code, so the install removes no built-in mutator. The built-ins mutate the story files in this run
as they mutate the components. Do not install `@muirjs/proteus-storybook-test` in the same configuration:
its install turns the built-ins off for every file in the run, the components included.

## Turn a mutator off

For the whole run, list the mutator in `mutator.excludedMutations`. The names are case sensitive, and Stryker does
not check them, so a misspelt name excludes nothing and logs nothing. Stryker still reports an excluded mutant, as
Ignored.

For one mutant, put a Stryker disable comment with a reason on the line before the property:

```ts
export const Disabled = {
  args: {
    // Stryker disable next-line LzStorybookArgs: the component defaults variant to primary
    variant: 'primary',
    disabled: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toBeDisabled();
  },
};
```

For a block, use `// Stryker disable <name>: <reason>` and `// Stryker restore <name>`.

## Survivors to expect and limits

- A key whose value equals what the component does without it survives, since only the component holds its
  defaults: an `undefined` value, a `false` the component defaults to, or a value the story's render overrides. On
  one open-source design system, these made 18 of 27 survivors.
- A key that a check would read, but no play checks, survives. On the same design system, 9 of 27 survivors were
  such keys, such as a `placeholder` or `supportingText` that no play asserts on.
- A story without a play function or a `.test()` call gets no mutant, also when another tool, such as a Playwright
  test or a visual test, checks the story.
- A story whose `args` the file changes at run time, such as `Primary.args.label = 'Next'`, keeps the mutants of its
  keys, since the file cannot show the value below.

## License

MIT
