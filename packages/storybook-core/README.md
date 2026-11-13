# @layzee/storybook-core

The code that `@layzee/stryker-storybook`, `@layzee/storybook-mock-transformer`,
`@layzee/stryker-storybook-mutators` and `@layzee/stryker-storybook-test-mutators` share: reading story files (CSF) from a parsed program, finding definition-time
spy stubs, and the transformer record. The package is internal: it is published for those packages and is not for direct use. Each of those packages
declares it as a regular dependency, so installing one of them installs this one. It has no Stryker peer dependency.

## Exports

- `csfShapes`, `csfFile`, `defaultExport`, `namedExports`, `topLevelBindings`, `unchangedBindings`, `unwrap`,
  `withoutBinding`, `mayImportItself`, `storyArgument`, `isTemplateBind`: read the meta, the stories and their
  bindings from a story file's program.
- `propertyKey`, `isUnknownPlay`: the key of an object property, and whether a played story's play is one the file
  cannot read.
- `sitesOf`, with the types `Site`, `SiteRun`, `Proven` and `ProofReason`: the `args` or `globals` objects that
  played stories run with, each with a `Proven` for every property whose removal the file proves changes nothing.
- `waitCall`: whether a call, awaited or not and given as a statement or not, is `waitFor(...)` or
  `waitForElementToBeRemoved(...)`.
- `definitionTimeStubs`: the definition-time spy stubs in a program, with their positions.
- `appendRecord`, `hasRecords`, `recordVariable`, `mockTransformerPluginName`: write and read the transformer record.
- `isRecord`, `isStringArray`, `field`, `list`: read values of unknown shape, such as Babel nodes.
