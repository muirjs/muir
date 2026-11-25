<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/banshee-storybook-vitest

A StrykerJS reporter for Storybook story files that run as tests through Storybook's Vitest addon. The
`muir-banshee-storybook-vitest` reporter lists the spy stubs that the addon's mock reset erases, the stubs no play
checks, hints for surviving interaction mutants, and the story mutants that run every test.

The package is private and not on npm yet.

## Requirements

- StrykerJS 10.1 with its Vitest runner, and Vitest 4 or 5.
- Storybook 10.6 or a later 10.x minor with `@storybook/addon-vitest`. The `storybook` peer comes from
  `@muirjs/moira-storybook`, which this package depends on.
- Node.js 22 or later.

## Set it up

Use it beside `@muirjs/shadowcat-storybook`, whose
[README](../shadowcat-storybook/README.md#set-up-two-stryker-configurations) describes the whole Storybook setup. In
both Stryker configurations, load the package and name the reporter:

```ts
// stryker.config.mjs
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  appendPlugins: ['@muirjs/shadowcat-storybook', '@muirjs/shadowcat-storybook-vitest', '@muirjs/banshee-storybook-vitest'],
  ignorers: ['muir-shadowcat-storybook-csf', 'muir-shadowcat-storybook-vitest'],
  muirShadowcatStorybook: { configDir: '.storybook' },
  reporters: ['clear-text', 'html', 'muir-banshee-storybook-vitest'],
};
```

The reporter reads the Storybook config folder from `muirShadowcatStorybook.configDir`, the option that
`@muirjs/shadowcat-storybook` declares, and the tested stories from the Vitest configuration that `vitest.configFile`
names.

## Read the report

The reporter writes `reports/muir-banshee-storybook-vitest.json` and prints a block such as this one:

```text
@muirjs/banshee-storybook-vitest: 2 spy stub findings (1 erased, 1 unchecked)
  erased  src/Note.stories.tsx:12 mockResolvedValue  the mock reset runs before the story renders, so this stub never takes effect; pass the implementation to fn(), as in fn(() => value), or return the value from the function fn() already takes, or set the stub in beforeEach
  unchecked  src/Note.stories.tsx:30  no test fails without this stub, so no play checks what it changes; assert in the play what the stubbed value changes
```

It holds three lists:

- Spy stub findings. Each definition-time stub that is not kept appears with its verdict, one of those the
  [`@muirjs/shadowcat-storybook-vitest` README](../shadowcat-storybook-vitest/README.md#find-the-stubs-the-mock-reset-erases)
  lists. A stub whose `MuirProteusStorybookTestSpyStub` mutant survived appears as `unchecked`. A stub whose
  `MuirProteusStorybookTestSpyStubOutcome` mutant survived while its removal was killed or timed out appears as
  `outcome-unchecked`: a play needs the stub, but no check tells its success from its failure. The reporter reads
  the stubs of every story file, including the ones this run does not mutate.
- Interaction hints. Each surviving mutant of the interaction mutators at an interaction of a known shape,
  `negative-only`, `click-before-type` or `cleared-later`, appears with the reason, the fix and a ready
  `// Stryker disable next-line` comment.
- Static story mutants. Stryker runs these mutants in story files against every test, so each one costs run time on
  every test. The list gives each one's net time.

### Silence a stub finding

To silence one finding, put a Stryker disable comment that names `MuirProteusStorybookTestSpyStub`, or `all`, on the
line before the stub:

```ts
args: {
  // Stryker disable next-line MuirProteusStorybookTestSpyStub: the story only checks that the form renders
  onSave: fn().mockResolvedValue(note),
},
```

To silence every finding, list `MuirProteusStorybookTestSpyStub` in `mutator.excludedMutations`.

### Warnings about the mock transformer

The reporter compares what the main file's `viteFinal` says with what the mock transformer did during the dry run:

- The transformer rewrote stubs, but `viteFinal` does not add it: the stub ignorer treated rewritten stubs as erased.
  Add the plugin through `viteFinal`.
- `viteFinal` adds the transformer, but it rewrote no stub: check that the test run uses the Storybook Vite
  configuration, or ignore the warning when no story file stubs a spy outside a function.

## License

MIT
