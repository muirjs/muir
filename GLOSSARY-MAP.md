# Glossary Map

## Contexts

- [Stryker node:test runner](./packages/stryker-node-test-runner/GLOSSARY.md): runs node:test test files for
  StrykerJS, one fresh process per test file, and reports which tests reach which mutants
- [Mutators](./packages/stryker-mutator-core/GLOSSARY.md): the install layer and the three mutator packages that add
  mutators to StrykerJS
- [Table tests](./packages/node-test-extensions/GLOSSARY.md): `lzTestEach` and `lzTestFor`, Vitest-style table tests
  for node:test
- [OSS evaluation](./e2e/GLOSSARY.md): compares this runner with Stryker's command runner on pinned open-source
  projects, and runs the packed packages in fixture projects
- [Workspace](./docs/GLOSSARY.md): how the workspace loads its own source and gates every project on a mutation score
  of 100
- [Playwright runner](./packages/stryker-playwright-runner/GLOSSARY.md): runs Playwright e2e and component tests as
  Stryker tests, with per-test coverage, and gives each run's mutant to the pages, the Playwright workers and, with
  server support, the `webServer`.
- [Playwright mutators](./packages/stryker-playwright-mutators/GLOSSARY.md): mutate Playwright test code, so a
  test-code run shows which test steps no test outcome depends on.
- [JSX mutators](./packages/stryker-jsx-mutators/GLOSSARY.md): mutate the parts of JSX that Playwright tests look
  at, and ignore the mutants such tests cannot see.
- [Mutator install](./packages/stryker-mutator-install/GLOSSARY.md): puts a mutator package's mutators into
  Stryker and checks them before a run starts, and holds the swap engine and the site readers that more than one
  mutator package uses. Covers `packages/test-util-mutator-packages` too, the private test support the mutator
  packages share (docs/adr ADR-0008).
- [Storybook](./packages/stryker-storybook/GLOSSARY.md): ignores the mutants in story files that a story test
  cannot kill, reports the spy stubs the mock reset erases, and keeps definition-time stubs through the mock reset.
  Covers `packages/stryker-storybook`, `packages/storybook-mock-transformer` and `packages/storybook-core`, the
  internal package that holds the code the Storybook packages share.
- [Storybook test mutators](./packages/stryker-storybook-test-mutators/GLOSSARY.md): mutate story test code, so
  a test-code run shows which steps of a play function no check depends on.
- [Storybook mutators](./packages/stryker-storybook-mutators/GLOSSARY.md): mutate story data, so a run of the
  components configuration shows which story data no story test depends on.
- [msw mutators](./packages/stryker-msw-mutators/GLOSSARY.md): mutate the responses of msw request handlers, so a
  test-code run shows which mocked responses no test outcome depends on, with any test runner.

## Relationships

- **Runner and Mutators**: neither imports the other. Both extend StrykerJS in the same run: the runner as a test
  runner plugin, the mutators as installed mutators in Stryker's list.
- **Mutators -> Mutators**: each mutator package depends on `stryker-mutator-core` for the install; the own mark
  tells replace mode which installed mutators belong to other mutator packages. `stryker-node-test-mutators` uses the
  bindings of `stryker-node-mutators`.
- **Workspace -> Runner and Mutators**: the production configuration and the test-code configuration choose the
  runner and install the mutator packages, loaded through the source condition.
- **OSS evaluation -> Runner and Mutators**: installs them as packed packages; both sides install the default Node.js
  mutators, so both mutate the same code into the same mutants.
- **OSS evaluation and Workspace -> StrykerJS reports**: the comparison, the checkpoint, the RuntimeError check and the
  baseline all read Stryker's JSON report; the mutant key follows how Stryker's incremental mode identifies a mutant.
- **Every context -> Table tests**: the packages' own tests use `lzTestEach` and `lzTestFor`; nothing ships with a
  dependency on them.
- **Mutators <-> Mutator install**: two install layers for the same job, one for the node:test mutator packages and
  one for the Playwright, JSX, Storybook and msw mutator packages. Neither imports the other; each marks its own
  mutators and checks names before a run, so packages of both kinds install into one Stryker run.
- **JSX mutators -> Mutator install**: the JSX mutators are installed through Mutator install, which gives them
  the Layzee mark, the self-check on samples and the name check.
- **Playwright mutators -> Mutator install**: installed the same way, with opt-in and experimental tiers and
  built-in removal. Their Locator and MountStory mutators make each same-file swap through the swap engine and,
  for role, text and test id locators, the site readers that Mutator install holds.
- **Storybook test mutators -> Mutator install**: installed the same way, with opt-in and experimental tiers and
  built-in removal; `LzStorybookInteractionTarget` makes its same-file swaps through the same swap engine and site
  readers.
- **Storybook mutators -> Mutator install**: installed the same way, with an opt-in tier, keeping Stryker's
  built-in mutators.
- **msw mutators -> Mutator install**: installed the same way, with every mutator on by default, keeping Stryker's
  built-in mutators. A test mutator package that removes the built-ins in the same Stryker run removes them for msw
  handlers too, since the mutator list is one per run.
- **msw mutators <-> Storybook**: neither uses the other. The CSF ignorer hides the handlers in a story's
  `parameters.msw` where its play mode is `ignore`, so the msw mutators reach them in the configuration that sets
  `mutate`.
- **Storybook mutators -> Storybook**: they read story files with `@layzee/storybook-core`, which gives
  `LzStorybookArgs` its args sites with a Proven for each property whose removal the file proves changes nothing,
  and, for each played story's run of the meta's args, whether the story takes a key from the meta, gets it
  elsewhere (above the meta, or from another meta it is made from), or the file cannot tell, from the story file and
  the path Stryker's instrumenter gives it, and mutate story data, so they belong in the Stryker configuration for
  the components, where the CSF ignorer's play mode is `ignore`, which leaves the meta's `args` to them.
- **Storybook test mutators -> Storybook**: they read story test code with `@layzee/storybook-core`
  and mutate it, taking each interaction, its user-event origin and its following checks from the
  `@layzee/storybook-core` interaction reader, and the CSF ignorer reports those mutants as Ignored unless its play
  mode is `mutate`, so they belong in the Stryker configuration that sets that mode. `LzStorybookStoryGlobals` and
  the Storybook mutators' `LzStorybookArgs` take the played stories and each story's layers from the same
  `@layzee/storybook-core` rule, and `LzStorybookStoryGlobals` takes its globals sites, given the same path, with a
  Proven for each default global, whose table of Storybook's initial globals `@layzee/storybook-core` holds.
  `LzStorybookSpyStub` and `LzStorybookSpyStubOutcome` read definition-time stubs from
  the same `@layzee/storybook-core` reader as the stub ignorer, which reports their mutants at erased stubs as Ignored;
  the `lz-storybook` reporter makes unchecked stubs of surviving `LzStorybookSpyStub` mutants, and outcome-unchecked
  stubs of surviving `LzStorybookSpyStubOutcome` mutants whose own stub's removal was killed or timed out;
  the `lz-storybook` reporter reads the interaction statements with `interactionsOf` on its own parse of each story
  file, and gives interaction hints for surviving mutants of the five interaction mutators;
  `@layzee/stryker-storybook`'s tests (a devDependency only) check that each mutant carries its name, that
  `LzStorybookSpyStub` is an experimental mutator name of this package, and that each of the five interaction mutator
  names makes mutants.
- **JSX mutators <-> Playwright mutators**: neither uses the other, but both install into one Stryker instance, so
  the name check keeps their mutator names distinct.
- **JSX mutators -> Playwright runner**: JSX mutants are meant for Playwright tests, which the runner runs; the
  ignorers work with any test runner.
- **Playwright mutators -> Playwright runner**: the runner runs test-code mutants. The serialized-callback ignorer
  reports as Ignored the mutants of callbacks that Playwright sends to another realm; the runner's page helpers
  make such callbacks work in pages, but not in workers, service workers or Electron.
- **Storybook**: shares no plugin with the other contexts, and no code apart from `@layzee/storybook-core`, which
  the Storybook mutators and the Storybook test mutators depend on. It works with Stryker's Vitest runner and Storybook's Vitest addon, not with the
  Playwright runner. Inside it, the mock transformer writes the transformer record that the `lz-storybook` reporter
  reads, and both take the stub shape and the rule for which stubs the transformer rewrites from
  `@layzee/storybook-core`, so the two agree on every stub. The reporter reads interactions with the same
  `@layzee/storybook-core` interaction reader as the Storybook test mutators, on its own parse of each story file in
  the report.

## Terms that differ between contexts

- **Started process** (runner) is a process or thread that a test file starts; **descendant** (OSS evaluation) is any
  process in the driver's process tree.
- **Part** (OSS evaluation) is a range of one file's mutants run as its own driver run; **shard** (Workspace) is one
  CI job's slice of a project's mutated files.
- **Source clone** (OSS evaluation) is a project checkout; **source condition** (Workspace) is the export condition.
- `lzNodeTest` names the runner's Stryker options; in the mutators' bindings it names node:test's module names.
