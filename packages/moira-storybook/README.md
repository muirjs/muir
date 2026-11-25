# @muirjs/moira-storybook

The code that `@muirjs/shadowcat-storybook`, `@muirjs/pixie-storybook`,
`@muirjs/proteus-storybook` and `@muirjs/proteus-storybook-test` share: reading story files (CSF) from a parsed program, finding definition-time
spy stubs, and the transformer record. The package is internal: it is published for those packages and is not for direct use. Each of those packages
declares it as a regular dependency, so installing one of them installs this one. It has no Stryker peer dependency.

## Exports

- `csfShapes`, `csfFile`, `defaultExport`, `namedExports`, `topLevelBindings`, `unchangedBindings`, `unwrap`,
  `withoutBinding`, `mayImportItself`, `storyArgument`, `isTemplateBind`: read the meta, the stories and their
  bindings from a story file's program.
- `propertyKey`, `isUnknownPlay`: the key of an object property, and whether a played story's play is one the file
  cannot read.
- `sitesOf`, with the types `Site`, `SiteRun`, `KeyFrom`, `Proven` and `ProofReason`: the `args` or `globals` objects
  that played stories run with, each with a `Proven` for every property whose removal the file proves changes
  nothing, and each run's `keyFrom`, which says whether the run takes a key from the site, from elsewhere (a layer
  above the meta, or another meta its story is made from), or from a source the file cannot tell. It takes the
  file's path, and proves nothing in a file that may import itself or whose path it is not given.
- `interactionsOf`, with the types `StoryInteractions`, `Interaction`, `UserEventOrigin`, `FollowingChecks`, `Check`
  and `WindowEnd`: every interaction of a story file in source order, each with its kind, its call and arguments,
  its user-event origin, whether it stands in a hook, and the checks that follow it up to what ends them.
- `waitCall`: whether a call, awaited or not and given as a statement or not, is `waitFor(...)` or
  `waitForElementToBeRemoved(...)`.
- `definitionTimeStubs`, with the types `DefinitionTimeStub`, `Span` and `StubMethodCall`: the definition-time spy stubs in a
  program, with their positions.
- `mockTransformerRewrite`, with the type `StubRewrite`: the rule for which stubs the mock transformer rewrites,
  shared by the transformer and the `muir-shadowcat-storybook` report: the first stub of a chain, not a `Once` stub, on a spy call
  that takes no arguments.
- `chainUpTo`: the stubs of a chain up to one of them.
- `stubMethodOf` and `writtenMethodOf`, with the types `StubMethod` and `WrittenStubMethod`: a spy method name read
  as a stub method and its `Once` form, and written back.
- `appendRecord`, `hasRecords`, `recordVariable`, `mockTransformerPluginName`: write and read the transformer record.
- `isRecord`, `isStringArray`, `field`, `list`: read values of unknown shape, such as Babel nodes.
- `fileNameOf`: the path of the file a Babel path's tree was parsed from, as Stryker's instrumenter gives it.
- `readNamingStoryFile`: runs a read of one story file; an error it throws comes back naming the package and the
  story file, with the error as its cause, so a mutator run that stops on a file (a member chain too deep for the
  stack) says which.
