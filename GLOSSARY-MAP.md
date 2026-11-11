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
  Stryker and checks them before a run starts.
- [Storybook](./packages/stryker-storybook/GLOSSARY.md): ignores the mutants in story files that a story test
  cannot kill, reports the spy stubs the mock reset erases, and keeps definition-time stubs through the mock reset.
  Covers `packages/stryker-storybook` and `packages/storybook-mock-transformer`.
- [Storybook test mutators](./packages/stryker-storybook-test-mutators/GLOSSARY.md): mutate story test code, so
  a test-code run shows which steps of a play function no check depends on.

## Relationships

- **JSX mutators -> Mutator install**: the JSX mutators are installed through Mutator install, which gives them
  the Layzee mark, the self-check on samples and the name check.
- **Playwright mutators -> Mutator install**: installed the same way; only the Playwright mutators have opt-in and
  experimental tiers so far, and they use built-in removal. Their Locator and MountStory mutators make each
  same-file swap through the swap engine that Mutator install holds.
- **Storybook test mutators -> Mutator install**: installed the same way, with built-in removal.
- **Storybook test mutators -> Storybook**: they mutate story test code, whose mutants the CSF ignorer reports as
  Ignored unless its play mode is `mutate`, so they belong in the Stryker configuration that sets that mode.
- **JSX mutators <-> Playwright mutators**: neither uses the other, but both install into one Stryker instance, so
  the name check keeps their mutator names distinct.
- **JSX mutators -> Playwright runner**: JSX mutants are meant for Playwright tests, which the runner runs; the
  ignorers work with any test runner.
- **Playwright mutators -> Playwright runner**: the runner runs test-code mutants. The serialized-callback ignorer
  reports as Ignored the mutants of callbacks that Playwright sends to another realm; the runner's page helpers
  make such callbacks work in pages, but not in workers, service workers or Electron.
- **Storybook**: shares no code or plugin with the other contexts. It works with Stryker's Vitest runner and
  Storybook's Vitest addon, not with the Playwright runner. Inside it, the mock transformer writes the transformer
  record that the `lz-storybook` reporter reads, and both packages hold the same stub shape.
