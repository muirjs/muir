---
status: accepted
---

# A package name names every technology its code is specific to

A package's `<technology>` part names each technology the package's code only works with, from the most general to
the most specific: `@muirjs/pixie-storybook-vite` holds Vite plugins for Storybook, `@muirjs/proteus-react` holds
mutators for React's JSX attribute names. Code that is specific to another technology than the rest of its package
moves to a package of its own, named for that technology: the ignorers that lived in the JSX mutator package moved to
`@muirjs/shadowcat-js` (console output, any JavaScript), `@muirjs/shadowcat-telemetry` (analytics and Sentry calls)
and `@muirjs/shadowcat-react` (React class names and inline styles). A package that holds two kinds of plugin, such as
an ignorer and a reporter, splits by mutant as well, so `@muirjs/shadowcat-storybook` splits into Shadowcat, Banshee
and Pixie packages.

A third-party library that the code only recognises by name, with no import and no dependency entry, does not get a
package of its own: the telemetry ignorer matches `Sentry.*` callees and `@sentry/` import sources by text, so Sentry
sits beside the analytics libraries in `@muirjs/shadowcat-telemetry`.

Lars ruled (2026-11-25): "@muirjs/proteus-jsx → @muirjs/proteus-react: OK. Ignorers should go to shadowcat
package(s)."; on the telemetry ignorer: "Isn't some or all of muir-proteus-jsx-telemetry specific to 3rd-party
packages/technology, in which case it shouldn't go into a `@muirjs/shadowcat-js` package."; then "1: Console into
shadowcat-js. Sentry in shadowcat-sentry. Other analytics/telemetry in shadowcat-telemetry." and "...or Sentry as an
optional dependency in shadowcat-telemetry, if possible.", and "1: OK" to Claude's recommendation of Sentry inside
`@muirjs/shadowcat-telemetry` with no dependency entry. He approved the Storybook split with "1: OK" and the Vite
rename with "Yes".

## Considered options

- One `@muirjs/shadowcat-js` for every non-Storybook ignorer: it would hold React-only and library-specific code
  under a name that says any JavaScript.
- A `@muirjs/shadowcat-sentry` package: one ignorer per library would repeat the call matcher's options and make a
  user list two ignorers for one concern, with no dependency to keep apart.
- Keep the ignorers in the mutator package: a user who wants only the ignorers would install the JSX mutators, and the
  package would hold two mutants.

## Consequences

- Stryker's names changed: `muir-shadowcat-react-styling`, `muir-shadowcat-telemetry` and `muir-shadowcat-js-console`,
  with the options keys `muirShadowcatReactStyling`, `muirShadowcatTelemetry` and `muirShadowcatJsConsole`. A
  configuration lists each ignorer's package in `appendPlugins`; `@muirjs/proteus-react` no longer exports
  `strykerPlugins` or `strykerValidationSchema`.
- `@muirjs/shadowcat-telemetry` and `@muirjs/shadowcat-react` depend on `@muirjs/shadowcat-js` for the call matcher
  and the option reader.
- The ignorer packages share their test support through `@muirjs/test-util-ignorer-packages`, not
  `@muirjs/test-util-mutator-packages`: that support instruments code through `@muirjs/moira-mutators`, whose own
  tests use `@muirjs/test-util-mutator-packages`, so putting it there would make a dependency cycle.
