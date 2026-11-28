<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/shadowcat-storybook

A StrykerJS ignorer for Storybook story files. Stories run as Stryker tests through Stryker's Vitest runner and
Storybook's Vitest addon. The `muir-shadowcat-storybook-csf` ignorer, the CSF ignorer, keeps the values that Storybook
reads without running the file, such as `title` and `tags`, as written. It also splits a story file into story data,
which a run of the components mutates, and story test code, which a run of its own mutates.

Other packages hold the rest. The stub ignorer in
[`@muirjs/shadowcat-storybook-vitest`](../shadowcat-storybook-vitest/README.md) reports as Ignored the mutants of
spy stubs that the mock reset erases. The reporter in
[`@muirjs/banshee-storybook-vitest`](../banshee-storybook-vitest/README.md) lists those stubs and the stubs no play
checks. It also gives hints for surviving interaction mutants and lists the story mutants that run every test. The
Vite plugins in [`@muirjs/pixie-storybook-vite`](../pixie-storybook-vite/README.md) keep definition-time stubs
through the mock reset, reset module mock spies before each test, and let the story tests run in Stryker's sandbox.

The package is private and not on npm yet.

## The Storybook packages

Seven packages work together. This README describes the setup they share.

| Package                              | What it adds                                                                | Where it goes                     |
| ------------------------------------ | --------------------------------------------------------------------------- | --------------------------------- |
| `@muirjs/shadowcat-storybook`        | the CSF ignorer                                                             | both Stryker configurations       |
| `@muirjs/shadowcat-storybook-vitest` | the stub ignorer                                                            | both Stryker configurations       |
| `@muirjs/banshee-storybook-vitest`   | the reporter                                                                | both Stryker configurations       |
| `@muirjs/pixie-storybook-vite`       | the mock transformer, the mock reset plugin and the sandbox plugin          | Storybook's `viteFinal`; Vitest   |
| `@muirjs/proteus-storybook`          | `MuirProteusStorybookArgs`, which mutates story data                        | the components configuration      |
| `@muirjs/proteus-storybook-test`     | the mutators for play functions, which turn Stryker's built-in mutators off | the story test code configuration |
| `@muirjs/proteus-msw`                | `MuirProteusMswResponse`, which mutates msw responses with any test runner  | a test code configuration         |

## Requirements

- `@stryker-mutator/core` 10.1 with `@stryker-mutator/vitest-runner`, tested on 10.1.1.
- Storybook 10.6 or a later 10.x minor (`storybook` peer `^10.6.0`), tested on 10.6.5, with
  `@storybook/addon-vitest` running the story tests.
- Vitest 4 or 5, tested on 5.1.0. Without Vitest, the plugins cannot read the addon's tag filter and take the stories
  tagged `test` as the tested stories.
- Vite 5 to 8, for the Vite plugins of `@muirjs/pixie-storybook-vite`.
- Vitest browser mode for the story tests. The setup below uses `@vitest/browser-playwright` with Chromium, which
  `npx playwright install chromium` installs.
- Node.js 22.18 or a later 22.x, 24.11 or a later 24.x, or 26.13 or a later 26.x.

Every package in the table apart from `@muirjs/proteus-msw` depends on `@muirjs/moira-storybook`, an internal
package. Only that package loads Storybook at run time, the first time a plugin reads the Storybook project, so its
`storybook` peer is required. The packages you install state the versions they support as optional peer
dependencies, so that an install with another version fails: `storybook` `^10.6.0` on the five packages named after
Storybook, `vitest` `^4.0.0 || ^5.0.0` on the two named after Vitest, and `msw` `^2.0.0 || ^3.0.0` on
`@muirjs/proteus-msw`.

## Set up two Stryker configurations

In many component libraries, the story files are app code: their `args`, `render` functions and meta describe the
components. Their play functions, `.test()` bodies, `beforeEach` and `afterEach`, and msw handlers are tests. So the
supported setup has two Stryker configurations:

- The components configuration mutates the components and the story data, with Stryker's built-in mutators on.
- The story test code configuration mutates the story test code, with the built-ins off.

Both run the same Vitest configuration.

1. Add the mock transformer to Storybook's Vite configuration, in `viteFinal` of the main file:

   ```ts
   // .storybook/main.ts
   import { muirPixieStorybookViteMockTransformerPlugin } from '@muirjs/pixie-storybook-vite';
   import type { StorybookConfig } from '@storybook/react-vite';
   import { mergeConfig } from 'vite';

   const config: StorybookConfig = {
     stories: ['../src/**/*.stories.tsx'],
     framework: '@storybook/react-vite',
     addons: ['@storybook/addon-vitest'],
     viteFinal: (viteConfig) =>
       mergeConfig(viteConfig, {
         plugins: [muirPixieStorybookViteMockTransformerPlugin()],
       }),
   };

   export default config;
   ```

   In `viteFinal`, the Storybook UI, the Vitest addon and the stub ignorer all see the transformer. The
   `@muirjs/pixie-storybook-vite` README says what it rewrites.

2. Add the sandbox plugin and the mock reset plugin to the Vitest configuration that runs the story tests:

   ```ts
   // vitest.config.ts
   import { muirPixieStorybookViteMockResetPlugin, muirPixieStorybookViteStrykerPlugin } from '@muirjs/pixie-storybook-vite';
   import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
   import { playwright } from '@vitest/browser-playwright';
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     plugins: [muirPixieStorybookViteStrykerPlugin(), muirPixieStorybookViteMockResetPlugin()],
     test: {
       projects: [
         {
           extends: true,
           plugins: [storybookTest({ configDir: '.storybook' })],
           test: {
             name: 'storybook',
             browser: {
               enabled: true,
               headless: true,
               provider: playwright(),
               instances: [{ browser: 'chromium' }],
             },
           },
         },
       ],
     },
   });
   ```

3. Write the components configuration. `MuirProteusStorybookArgs` is experimental, so turn it on by name inside
   `experimental`:

   ```ts
   // stryker.config.mjs
   import { muirProteusStorybookMutators } from '@muirjs/proteus-storybook';

   await muirProteusStorybookMutators({
     experimental: { MuirProteusStorybookArgs: true },
   });

   export default {
     testRunner: 'vitest',
     vitest: { configFile: 'vitest.config.ts' },
     mutate: ['src/**/*.tsx', '!src/**/*.test.tsx'],
     appendPlugins: ['@muirjs/shadowcat-storybook', '@muirjs/shadowcat-storybook-vitest', '@muirjs/banshee-storybook-vitest'],
     ignorers: ['muir-shadowcat-storybook-csf', 'muir-shadowcat-storybook-vitest'],
     muirShadowcatStorybook: { configDir: '.storybook' },
     reporters: ['clear-text', 'html', 'muir-banshee-storybook-vitest'],
   };
   ```

4. Write the story test code configuration. Set the CSF ignorer's play mode to `mutate`:

   ```ts
   // stryker.test-code.config.mjs
   import { muirProteusMswMutators } from '@muirjs/proteus-msw';
   import { muirProteusStorybookTestMutators } from '@muirjs/proteus-storybook-test';

   await muirProteusStorybookTestMutators();
   await muirProteusMswMutators();

   export default {
     testRunner: 'vitest',
     vitest: { configFile: 'vitest.config.ts' },
     mutate: ['src/**/*.stories.tsx'],
     appendPlugins: ['@muirjs/shadowcat-storybook', '@muirjs/shadowcat-storybook-vitest', '@muirjs/banshee-storybook-vitest'],
     ignorers: ['muir-shadowcat-storybook-csf', 'muir-shadowcat-storybook-vitest'],
     muirShadowcatStorybook: { configDir: '.storybook' },
     muirShadowcatStorybookCsf: { play: 'mutate' },
     reporters: ['clear-text', 'html', 'muir-banshee-storybook-vitest'],
   };
   ```

   Keep the components out of this `mutate`. `muirProteusStorybookTestMutators()` turns the built-in mutators off for
   every file in the run.

5. Run each configuration:

   ```sh
   npx stryker run stryker.config.mjs
   npx stryker run stryker.test-code.config.mjs
   ```

`appendPlugins` loads the ignorers and the reporter. It installs no mutator: only the install calls do.

## Point the plugins at the Storybook config folder

`muirShadowcatStorybook.configDir` names the Storybook config folder, as Storybook takes it with `--config-dir`. It
defaults to `.storybook`, and a relative path is read from the folder Stryker runs in. Set it in both configurations
when the folder has another name.

The plugins read three things from that folder, once per run:

- The story files: Storybook's own loader reads the main file's `stories` in a child Node.js process. A file that is
  not a story file gets no mutant hidden by the two ignorers.
- The preview's `parameters.test`, which picks the mock reset, and its `tags`.
- The Vite plugins that `viteFinal` adds, to learn whether the mock transformer runs.

With no main file in the folder, the run prints an info line and treats as story files the names that end in
`stories` or `story` with a `.js`, `.jsx`, `.mjs`, `.mjsx`, `.ts` or `.tsx` extension. When Storybook cannot load
the main file, the run prints a warning with Storybook's error and uses the same names.

The tested stories come from the tag filter of `storybookTest({ tags })` in the Vitest configuration that Stryker's
`vitest.configFile` names, or that Vitest finds in the folder Stryker runs in. When Vitest cannot load it, or is not
installed, the run warns and takes the stories tagged `test`.

## Choose the play mode of the CSF ignorer

`muirShadowcatStorybookCsf.play` decides which parts of a story file the CSF ignorer reports as Ignored:

| Play mode          | Use it in                         | Reported as Ignored                                                                                                                        |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ignore` (default) | the components configuration      | the values Storybook reads without running the file; story test code; the value of `parameters.msw`; the meta object apart from its `args` |
| `mutate`           | the story test code configuration | the values Storybook reads without running the file                                                                                        |

The values Storybook reads without running the file are `title`, `id`, `tags`, `name`, `storyName`,
`includeStories` and `excludeStories` on the meta and the stories. A mutant of one of them could
change which stories Storybook finds, so the ignorer keeps them as written in both modes.

In `ignore` mode the ignorer does not report the meta's `args` as Ignored. They are story data, which
`MuirProteusStorybookArgs` and the built-in mutators mutate.

The ignorer reads only story files. Each Ignored mutant carries a reason that starts with
`muir-shadowcat-storybook-csf:`.

## Find the stubs the mock reset erases

The `muir-shadowcat-storybook-vitest` ignorer gives each spy stub that runs when the story file loads a verdict, and
reports the mutants of the stubs the mock reset erases as Ignored. Its
[README](../shadowcat-storybook-vitest/README.md) lists the verdicts and the fix. The reporter of
[`@muirjs/banshee-storybook-vitest`](../banshee-storybook-vitest/README.md#read-the-report) lists the same stubs.

## Survivors to expect and limits

- A story without a play function or a `.test()` call gets no mutant from the Storybook mutators, also when a
  Playwright test or a visual test checks it.
- Static story mutants run every test, so a story file with many of them makes the run slow. The report lists them.
- In one open-source Storybook 10 project with Vitest 4, Stryker's dry run crashed in Vite's SSR transform with
  `Cannot split a chunk that has already been edited` at an `import.meta` expression, while the same Vitest project
  passed without Stryker. The cause is not known, and it does not come from these packages. If you see this error,
  try another project before you debug these packages.
- The loader uses Storybook's internal `experimental_loadStorybook`. A later 10.x minor can change it. The run then
  warns and falls back to the story file names above.

## License

MIT
