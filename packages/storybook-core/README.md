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
- `interactionsOf`, with the types `StoryInteractions`, `Interaction`, `UserEventOrigin`, `FollowingChecks`, `Check`
  and `WindowEnd`: every interaction of a story file in source order, each with its kind, its call and arguments,
  its user-event origin, whether it stands in a hook, and the checks that follow it up to what ends them.
- `waitCall`: whether a call, awaited or not and given as a statement or not, is `waitFor(...)` or
  `waitForElementToBeRemoved(...)`.
- `definitionTimeStubs`, with the types `StubSite`, `Span` and `StubMethodCall`: the definition-time spy stubs in a
  program, with their positions.
- `mockTransformerRewrite`, with the type `StubRewrite`, and `chainUpTo`: which stubs the mock transformer rewrites,
  the one rule the transformer and the `lz-storybook` report share.
- `stubMethodOf` and `writtenMethodOf`, with the types `StubMethod` and `WrittenStubMethod`: a spy method name read
  as a stub method and its `Once` form, and written back.
- `appendRecord`, `hasRecords`, `recordVariable`, `mockTransformerPluginName`: write and read the transformer record.
- `isRecord`, `isStringArray`, `field`, `list`: read values of unknown shape, such as Babel nodes.
