# Glossary Map

## Contexts

- [Playwright runner](./packages/stryker-playwright-runner/GLOSSARY.md): runs Playwright e2e and component tests as
  Stryker tests, with per-test coverage, and gives each run's mutant to the pages, the Playwright workers and, with
  server support, the `webServer`.
- [Playwright mutators](./packages/stryker-playwright-mutators/GLOSSARY.md): mutate Playwright test code, so a
  test-code run shows which test steps no test outcome depends on.
- [JSX mutators](./packages/stryker-jsx-mutators/GLOSSARY.md): mutate the parts of JSX that Playwright tests look
  at, and ignore the mutants such tests cannot see.
- [Mutator install](./packages/stryker-mutator-install/GLOSSARY.md): puts a mutator package's mutators into
  Stryker and checks them before a run starts, and holds the swap engine and the site readers that more than one
  mutator package uses.
- [Storybook](./packages/stryker-storybook/GLOSSARY.md): ignores the mutants in story files that a story test
  cannot kill, reports the spy stubs the mock reset erases, and keeps definition-time stubs through the mock reset.
  Covers `packages/stryker-storybook`, `packages/storybook-mock-transformer` and `packages/storybook-csf`, the
  internal package that holds the code the Storybook packages share.
- [Storybook test mutators](./packages/stryker-storybook-test-mutators/GLOSSARY.md): mutate story test code, so
  a test-code run shows which steps of a play function no check depends on.
- [Storybook mutators](./packages/stryker-storybook-mutators/GLOSSARY.md): mutate story data, so a run of the
  components configuration shows which story data no story test depends on.
- [msw mutators](./packages/stryker-msw-mutators/GLOSSARY.md): mutate the responses of msw request handlers, so a
  test-code run shows which mocked responses no test outcome depends on, with any test runner.

## Relationships

- **JSX mutators -> Mutator install**: the JSX mutators are installed through Mutator install, which gives them
  the Layzee mark, the self-check on samples and the name check.
- **Playwright mutators -> Mutator install**: installed the same way, with opt-in and experimental tiers and
  built-in removal. Their Locator and MountStory mutators make each same-file swap through the swap engine and,
  for role, text and test id locators, the site readers that Mutator install holds.
- **Storybook test mutators -> Mutator install**: installed the same way, with opt-in and experimental tiers and
  built-in removal; `LzStorybookInteractionTarget` makes its same-file swaps through the same swap engine and site
  readers.
- **Storybook mutators -> Mutator install**: installed the same way, keeping Stryker's built-in mutators.
- **msw mutators -> Mutator install**: installed the same way, with an experimental tier, keeping Stryker's
  built-in mutators. A test mutator package that removes the built-ins in the same Stryker run removes them for msw
  handlers too, since the mutator list is one per run.
- **msw mutators <-> Storybook**: neither uses the other. The CSF ignorer hides the handlers in a story's
  `parameters.msw` where its play mode is `ignore`, so the msw mutators reach them in the configuration that sets
  `mutate`.
- **Storybook mutators -> Storybook**: they read story files with `@layzee/storybook-csf`, and
  mutate story data, so they belong in the Stryker configuration for the components,
  where the CSF ignorer's play mode is `ignore`.
- **Storybook test mutators -> Storybook**: they read story test code with `@layzee/storybook-csf`
  and mutate it, and the CSF ignorer reports those mutants as Ignored unless its play mode is `mutate`, so they
  belong in the Stryker configuration that sets that mode. `LzStorybookStoryGlobals` and the Storybook mutators'
  `LzStorybookArgs` take the played stories and each story's layers from the same `@layzee/storybook-csf` rule.
  `LzStorybookSpyStub` and `LzStorybookSpyStubOutcome` read definition-time stubs from
  the same `@layzee/storybook-csf` reader as the stub ignorer, which reports their mutants at erased stubs as Ignored;
  the `lz-storybook` reporter makes unchecked stubs of surviving `LzStorybookSpyStub` mutants only, so the outcome
  mutants, which carry the other name, stay out of them;
  `@layzee/stryker-storybook`'s tests (a devDependency only) check that each mutant carries its name, and that
  `LzStorybookSpyStub` is an experimental mutator name of this package.
- **JSX mutators <-> Playwright mutators**: neither uses the other, but both install into one Stryker instance, so
  the name check keeps their mutator names distinct.
- **JSX mutators -> Playwright runner**: JSX mutants are meant for Playwright tests, which the runner runs; the
  ignorers work with any test runner.
- **Playwright mutators -> Playwright runner**: the runner runs test-code mutants. The serialized-callback ignorer
  reports as Ignored the mutants of callbacks that Playwright sends to another realm; the runner's page helpers
  make such callbacks work in pages, but not in workers, service workers or Electron.
- **Storybook**: shares no plugin with the other contexts, and no code apart from `@layzee/storybook-csf`, which
  the Storybook mutators and the Storybook test mutators depend on. It works with Stryker's Vitest runner and Storybook's Vitest addon, not with the
  Playwright runner. Inside it, the mock transformer writes the transformer record that the `lz-storybook` reporter
  reads, and both take the stub shape from `@layzee/storybook-csf`.
