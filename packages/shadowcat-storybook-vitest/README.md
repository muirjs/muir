<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/shadowcat-storybook-vitest

A StrykerJS ignorer for Storybook story files that run as tests through Storybook's Vitest addon. The
`muir-shadowcat-storybook-vitest` ignorer, the stub ignorer, reports as Ignored the mutants of spy stubs that the
addon's mock reset erases before the story renders: no test can see a change to them.

The package is private and not on npm yet.

## Requirements

- StrykerJS 10.1 with its Vitest runner, and Vitest 4 or 5.
- Storybook 10.6 or a later 10.x minor with `@storybook/addon-vitest`. The `storybook` peer comes from
  `@muirjs/moira-storybook`, which this package depends on.
- Node.js 22 or later.

## Set it up

Use it beside `@muirjs/shadowcat-storybook`, whose
[README](../shadowcat-storybook/README.md#set-up-two-stryker-configurations) describes the whole Storybook setup. In
both Stryker configurations, load the package and name the ignorer:

```ts
// stryker.config.mjs
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  appendPlugins: ['@muirjs/shadowcat-storybook', '@muirjs/shadowcat-storybook-vitest'],
  ignorers: ['muir-shadowcat-storybook-csf', 'muir-shadowcat-storybook-vitest'],
  muirShadowcatStorybook: { configDir: '.storybook' },
};
```

The ignorer reads the Storybook config folder from `muirShadowcatStorybook.configDir`, the option that
`@muirjs/shadowcat-storybook` declares, and the tested stories from the Vitest configuration that `vitest.configFile`
names.

## Find the stubs the mock reset erases

Storybook resets, clears or restores every spy before a story renders, as `parameters.test` chooses. It restores by
default. A spy stub that runs when the story file loads, such as `onSave: fn().mockResolvedValue(note)` in `args`, is
a definition-time stub. The mock reset can erase it, so the story renders with a spy that returns `undefined`.

The ignorer reads the reset settings of the preview, the meta and each story, and gives each definition-time stub a
verdict. It reports the mutants of every stub that is not kept as Ignored, with a reason that starts with
`muir-shadowcat-storybook-vitest:` and names the verdict:

| Verdict                       | Meaning                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `erased`                      | The mock reset runs before the story renders, so the stub never takes effect.                                  |
| `order-dependent`             | Another story in the file resets mocks before it renders, which erases the stub when that story renders first. |
| `unknown`                     | The file's `parameters.test` cannot be read without running it.                                                |
| `once-not-rewritten`          | The mock transformer does not rewrite `Once` stubs, so the reset still erases this one.                        |
| `chain-not-rewritten`         | The mock transformer rewrites only the first stub of a chain.                                                  |
| `spy-arguments-not-rewritten` | The mock transformer does not rewrite a stub on a spy call that takes arguments, as in `fn(impl)`.             |

The last three verdicts appear only when the mock transformer of `@muirjs/pixie-storybook-vite` runs. Every finding
gives the same fix: pass the implementation to `fn()`, as in `fn(() => value)`, return the value from the function
`fn()` already takes, or set the stub in `beforeEach`.

## License

MIT
