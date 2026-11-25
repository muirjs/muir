---
status: accepted
---

# One install package, `@muirjs/moira-mutators`, for every mutator package

The repositories merged, so the two install layers that ADR 0003 kept apart merged too. `@muirjs/moira-node-test`
is gone. Its Babel mutator model moved into `@muirjs/moira-mutators`, and every mutator package now installs through
one function, `muirMoiraMutatorsInstall`: `@muirjs/proteus-js`, `-node` and `-node-test` through its Babel form
`muirMoiraMutatorsInstallBabelMutators`, and `@muirjs/proteus-jsx`, `-msw`, `-playwright`, `-storybook` and
`-storybook-test` directly. Selecting tiers, checking names, the self-check, finding Stryker core and the version
warning each have one implementation. Where the two layers differed, the merge kept the stricter or the more general
behaviour. The brief quoted Lars: "Don't worry about breaking changes. There are no users yet".

## Considered options

- Keep both layers and share only the selection: two self-checks and two core lookups would still drift, which is
  what ADR 0003 accepted only until the merge.
- Keep `moira-node-test` as the install package and move the toolkit packages onto it: it installed into one
  instrumenter only, the one next to the first Stryker core found, and it had no undo, so it was the weaker of the two.

## Consequences

- Every package installs into each copy of Stryker core that may run the process: the one whose bin started it, or
  else the one `moira-mutators` resolves, under both the drive-letter case of the program's script and its own. A
  Windows run that loads Stryker twice under two drive-letter cases gets the mutators in both copies.
- The version warning is exact: a package warns when the instrumenter is not the version it was tested with (10.1.1),
  where the Node packages warned only below a caret floor. Their peer range on `@stryker-mutator/core` is `~10.1.0`,
  like the toolkit packages'.
- A test-code configuration (`@muirjs/proteus-node-test`) removes Stryker's built-ins by name, like
  `@muirjs/proteus-storybook-test` and `@muirjs/proteus-playwright`, instead of replacing the whole list. The install
  throws when a built-in it expects is missing, and keeps an unmarked third-party mutator with a warning, where replace
  mode dropped it.
- A failed install puts the instrumenter's lists back as they were, for every package.
- The self-check matches a sample's mutant by its file name as well as by the mutator name.
- `extended` or `experimental` on a package with no mutators in that tier throws, naming the install function, where
  the Node packages selected nothing.
- The Node packages' names in errors and in the own mark are their package names, such as `@muirjs/proteus-js`.
- The Node packages run the `Instrumenter` of the instrumenter's exported entry, as Stryker does, not a deep import.

Evidence: the merge commit that deleted `packages/moira-node-test`, and the battery
`npx nx run-many -t lint typecheck build test`.
Supersedes ADR 0003.
