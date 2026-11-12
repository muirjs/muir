# @layzee/storybook-csf

The code that `@layzee/stryker-storybook`, `@layzee/storybook-mock-transformer`,
`@layzee/stryker-storybook-mutators` and `@layzee/stryker-storybook-test-mutators` share: reading story files (CSF) from a parsed program, finding definition-time
spy stubs, and the transformer record. The package is internal: it is published for those packages and is not for direct use. Each of those packages
declares it as a regular dependency, so installing one of them installs this one. It has no Stryker peer dependency.

## Exports

- `csfShapes`, `csfFile`, `defaultExport`, `namedExports`, `topLevelBindings`, `unwrap`, `withoutBinding`,
  `mayImportItself`, `storyArgument`, `isTemplateBind`: read the meta, the stories and their bindings from a story
  file's program.
- `sitesOf`, with the types `Site`, `SiteRun`, `Proven` and `ProofReason`: the `args` objects that played stories
  run with, each with a `Proven` for every property whose removal the file proves changes nothing.
- `definitionTimeStubs`: the definition-time spy stubs in a program, with their positions.
- `appendRecord`, `hasRecords`, `recordVariable`, `mockTransformerPluginName`: write and read the transformer record.
- `isRecord`, `isStringArray`, `field`, `list`: read values of unknown shape, such as Babel nodes.
