---
status: accepted
---

# Every exported and Stryker-visible name carries the `Muir<Mutant><Technology>` prefix of its package

Packages are named `@muirjs/<mutant>-<technology>`, such as `@muirjs/shadowcat-storybook`. Every symbol a package
exports, including the ones that only its own modules import, starts with the package prefix:
`MuirShadowcatStorybook` for types, classes and mutator names, `muirShadowcatStorybook` for values and Stryker options
keys, `MUIR_SHADOWCAT_STORYBOOK_` for environment variables, and `muir-shadowcat-storybook` for plugin names in kebab
case. Extensions may use the shorter `Muir` prefix, as in `muirTestEach` and `muirTestFor` of
`@muirjs/madrox-node-test`. No name uses `Lz`, `LZ`, `lz` or `lz-` any more. A name that starts with the technology
does not repeat it: `LzPlaywrightTestRunner` became `MuirSirynPlaywrightTestRunner`. A mutator name takes the prefix of
the package that defines the mutator, wherever it appears.

Lars ruled (2026-11-25): "The new prefixes are `muir`, `Muir`, and `muir-`. No `Lz`, `LZ`, `lz`, or `lz-`." and "Every
public API symbol must have one of the Muir prefixes. Ideally, even symbols exported from an ES Module but only used
internally also has a Muir prefix. [...] `MuirShadowcatStorybook` is a prefix for `@muirjs/shadowcat-storybook` symbol
and this prefix format should be the default." His reasons: "The verbose naming convention is to prevent name clashing
between plugins in the monorepo, to ease auto-import in editors, and to help _promote_ Muir through consumers' code.
[...] it is helpful to identify where a symbol belongs/is owned and to prevent mixups between similar-named symbols."

## Considered options

- A plain `Muir` prefix on every name: two packages that hold the same kind of symbol, such as each mutator package's
  `install` and `packageName`, would export the same name, and an editor's auto-import could pick the wrong one.
- Prefixes on the public API only: internal names would still clash inside the workspace, and a symbol that moves into
  the public API would need a rename.
- Keep the `lz` prefixes of ADR 0004: they name the old author, not the project.

## Consequences

- Stryker's names change for users: the runners `muir-siryn-node-test` and `muir-siryn-playwright`, the options keys
  `muirSirynNodeTest` and `muirSirynPlaywright`, the mutators (`MuirProteusReact*`, `MuirProteusPlaywright*` and the
  others), the reporters and ignorers, and the `MUIR_*` environment variables. A Stryker configuration, a
  `mutator.excludedMutations` list or a `// Stryker disable` comment that names an old `Lz` name no longer matches.
- Names that StrykerJS requires keep their names: `strykerPlugins` and `strykerValidationSchema`.
- `stryker init` lists a plugin package by the text before the first `-` of its name (`getName` in
  `packages/core/src/initializer/npm-client.ts`, StrykerJS 10.1.1), so it shows both `@muirjs/siryn-node-test` and
  `@muirjs/siryn-playwright` as `@muirjs/siryn`.
- `tools/compare-mutation-reports.ts` drops a leading `Lz` or `MuirProteus` from a mutator name, so a report made
  before the rename compares with one made after it.

Evidence: the codemod run that made the rename, and the battery `npx nx run-many -t lint typecheck build test`.
Supersedes ADR 0004.
