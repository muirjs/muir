<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/proteus-react

Mutators for the parts of JSX that Playwright tests look at. StrykerJS mutates expressions and leaves JSX text and
attribute strings alone, so a suite that finds elements by role, label, and text gets few mutants it can kill. This
package adds ten mutators:

- `MuirProteusReactTextLiteral`: empties JSX text that has a letter or digit.
- `MuirProteusReactLabelAttribute`: empties `aria-label`, `aria-labelledby`, `alt`, `title`, `placeholder`, and
  `htmlFor`.
- `MuirProteusReactEventHandler`: sets an `onX` handler that is not inline to `undefined`.
- `MuirProteusReactConditionalElement`: forces `x && <A/>` to render, and forces each branch of a JSX ternary.
- `MuirProteusReactUrlAttribute`: empties `href`, `to`, and `action`.
- `MuirProteusReactDisabledAttribute`: forces `disabled`, `readOnly`, and `aria-disabled` off.
- `MuirProteusReactHiddenAttribute`: forces `hidden` and `aria-hidden` off.
- `MuirProteusReactElementRole`: removes `role`, or swaps a `button`, or an `a` or `area` that has an `href`, for a
  `span`. It keeps a `role` that restates the tag's implicit role (see "Implicit roles").
- `MuirProteusReactChildExpression`: replaces a `{value}` child with `null`.
- `MuirProteusReactStateAttribute`: flips `aria-expanded`, `aria-pressed`, `aria-checked`, and `aria-selected`.

The [design document](https://github.com/muirjs/muir/blob/main/docs/design/jsx-mutators.md) says what each mutator
changes and which shapes it skips. Stryker's reports show these names as the mutator of each mutant.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1. The plugin patches internals of that version's
  instrumenter, and warns when it finds another version.
- Node.js 22.18 or a later 22.x, 24.11 or a later 24.x, or 26.13 or a later 26.x, tested on 22.23.1 and 24.22.0 on Windows 11 arm64, and on 24.22.1 on Linux arm64.
- React 16.14 or a later 16.x, 17, 18 or 19, with the classic or the automatic JSX transform. The tests render every
  mutant of a sample component under the oldest and the newest release of each: 16.14.0, 17.0.0, 17.0.2, 18.0.0,
  18.3.1, 19.0.0 and 19.3.1. The package imports nothing from React and states the range as an optional `react` peer
  dependency, so an install with another React version fails. Story files written for `@storybook/react-vite` are
  mutated like component files.
- React JSX or TSX. The mutators match React's attribute names, such as `htmlFor` and `readOnly`, so
  Solid, Preact or Vue JSX written with `for` or `readonly` gets no mutants on those attributes. Vue,
  Angular and Svelte templates get no JSX mutants; JSX in a Vue `<script lang="tsx">` block does. The run
  prints nothing about the files it skips.

The mutators do not need a particular test runner. With `@muirjs/siryn-playwright`, a
Playwright test can kill each of them.

## Implicit roles

`MuirProteusReactElementRole` reads a fixed table of implicit roles: the tags that have a role by tag alone, or by
tag and `href` for `a` and `area`. The table decides which tags the span swap changes (`button`, and `a`
and `area` with an `href`) and which `role` attributes restate a tag's own role and are left in place.

The table holds a tag when any test engine gives it that role by tag alone, so a `role` that restates
such a role keeps its place even where only one engine would see it go. It joins two tables:

- Playwright 1.64.1's, which alone gives `svg` (`img`) and `search` (`search`) a role.
- Testing Library 10.4.2's, from aria-query 5.3.0, which ignores aria-query's context rules and so gives
  `address` (`group`), `footer` (`contentinfo`), `header` (`banner`), `td` (`cell`) and `th`
  (`columnheader`) their role anywhere. Playwright gives `address` no role, and the others only in some
  places, such as a `header` that is not inside a `section`.

A role that comes from other attributes, such as `checkbox` on `<input type="checkbox">`, is not in the
table, so removing a restating one still gives a mutant, even though no engine can tell it apart.

So `<svg role="img">` and `<footer role="contentinfo">` keep their `role`, and get no removal mutant.
The `generic` role is left out: Playwright gives it to no tag, and a `role="generic"` is rare.

## Turn the mutators on

Call `muirProteusReactMutators` at the top of your Stryker configuration file. It adds the mutators to Stryker's own:

```ts
import { muirProteusReactMutators } from '@muirjs/proteus-react';

await muirProteusReactMutators();

export default {
  appendPlugins: ['@muirjs/siryn-playwright'],
  testRunner: 'muir-siryn-playwright',
};
```

Call it in the configuration file, not through `plugins`. Stryker only warns when a module in `plugins` fails to
load, while a failed call stops the run. The configuration file must be a JavaScript or TypeScript ES module, such
as `stryker.config.mjs`, as a JSON configuration cannot import a module.

The package has no opt-in or experimental mutators yet, so `muirProteusReactMutators` takes no options. It throws
when it gets any. Turn a mutator off with `mutator.excludedMutations`, as below.

The call checks that each mutator makes a mutant of a sample. It stops the run with the names of the
mutators that do not, and with the instrumenter's folder and version when an internal it patches is
missing. It also stops the run when another mutator already has one of these mutators' names.

## Hide the mutants a DOM test cannot see

The mutators make mutants that a DOM test can kill. Some of StrykerJS's own mutants it cannot: class names and inline
styles, analytics and error-monitoring calls, and console output. Three opt-in ignorers report those as Ignored, each
in its own package:

- [`@muirjs/shadowcat-react`](../shadowcat-react/README.md): `muir-shadowcat-react-styling`, for class names and
  inline styles.
- [`@muirjs/shadowcat-telemetry`](../shadowcat-telemetry/README.md): `muir-shadowcat-telemetry`, for analytics and
  Sentry calls.
- [`@muirjs/shadowcat-js`](../shadowcat-js/README.md): `muir-shadowcat-js-console`, for console output.

## Turn a mutator off

For the whole project, list the mutator in `mutator.excludedMutations`. The names are case sensitive,
and Stryker does not check them, so `muirProteusReactTextLiteral` excludes nothing and logs nothing.

For one mutant, use a Stryker disable comment with a reason. StrykerJS reads such a comment only where
Babel attaches it to the code that follows, so in JSX only these forms work:

- An attribute: a line comment inside the opening tag, on the line before the attribute.

  ```tsx
  <input
    // Stryker disable next-line MuirProteusReactLabelAttribute: the visible label names this field
    aria-label="Search"
  />
  ```

- An element that fits on one line: a line comment in a `{ }` container before it.

  ```tsx
  <header>
    {
      // Stryker disable next-line MuirProteusReactTextLiteral: a decorative heading
      <h1>Welcome</h1>
    }
  </header>
  ```

- Anything else: `// Stryker disable <name>: <reason>` on the line before the statement that holds the
  JSX, and `// Stryker restore <name>` on the line before the next statement or declaration. A restore
  after the last statement of a block is never read, so the disable then runs to the end of the file.

A JSX comment, `{/* Stryker disable ... */}`, is never read, and Stryker logs nothing about it. A
`next-line` comment before a multi-line element covers only that element's first line.

A comment or exclusion names a mutator, not one of its mutations, so it turns off both branches of a
`MuirProteusReactConditionalElement` ternary, and both the `role` removal and the span swap of
`MuirProteusReactElementRole`.

## Survivors to expect

The mutators skip the mutants that are cheap to detect as changing nothing a test can see. These remain:

- A `MuirProteusReactEventHandler` mutant can behave like StrykerJS's own `BlockStatement` mutant, which empties the
  handler's body. They differ only when the handler is shared or a parent handler relies on the event
  bubbling.
- A `MuirProteusReactConditionalElement` mutant on an empty list renders an empty list element, which Playwright
  reports as hidden. `toBeHidden` does not kill it; `toHaveCount(0)` on the items does.

With `@stryker-mutator/typescript-checker` and `strictNullChecks` on, a `MuirProteusReactEventHandler` mutant on
a component prop that the component's type requires, such as `onClick: () => void`, fails to compile.
Stryker reports it as a CompileError and leaves it out of the score, so no test runs against it. The
mutator cannot see prop types. A disable comment on that attribute turns the mutant into an Ignored one,
which the report still lists and the score also leaves out.

## Develop this package

`test/implicit-roles.test.ts` checks the role table in `src/implicit-roles.ts` against the installed
`playwright-core` and `aria-query` (the version Testing Library pins). When either is upgraded and the
test fails, update the table to match.

## License

MIT
