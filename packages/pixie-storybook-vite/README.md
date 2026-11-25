<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/pixie-storybook-vite

Two Vite plugins that make Storybook's spies behave the same in every story test, with or without Stryker:

- `muirPixieStorybookViteMockTransformerPlugin()`, the mock transformer, rewrites spy stubs that Storybook's mock reset would
  erase into a form the reset keeps.
- `muirPixieStorybookViteMockResetPlugin()`, the mock reset plugin, resets every module mock spy before each test, so a stub one
  story sets cannot leak into the next.

The package has no Stryker dependency. `@muirjs/shadowcat-storybook` reads what the mock transformer did, and its
README shows the full Stryker setup. The package is private and not on npm yet.

## Requirements

- Storybook 10.6 or a later 10.x minor, tested on 10.6.5. The plugins read source text and a global that Storybook
  sets, and import nothing from Storybook, so the package declares no `storybook` peer dependency. The
  `storybook` peer of `@muirjs/moira-storybook`, which it depends on, still asks for Storybook.
- Vite 5 to 8. The mock reset plugin also needs Vitest 4 or 5.
- Node.js 22 or later.

## Keep definition-time stubs through the mock reset

Storybook resets, clears or restores every spy before a story renders, as `parameters.test` chooses. It restores by
default. A stub that runs when the story file loads, such as one in `args`, is a definition-time stub, and the reset
undoes it:

```ts
export const Saved = {
  args: { onSave: fn().mockResolvedValue({ id: 1 }) },
};
```

The story renders with an `onSave` that returns `undefined`. The mock transformer rewrites the stub so that the
value becomes the spy's implementation, which the reset keeps:

```ts
export const Saved = {
  args: {
    onSave: fn(
      (
        (value) => async () =>
          value
      )({ id: 1 }),
    ),
  },
};
```

The value is still evaluated once, when the file loads. The transformer rewrites `mockReturnValue`,
`mockResolvedValue`, `mockRejectedValue` and `mockImplementation` this way.

### Add the transformer in viteFinal

Add the plugin to `viteFinal` in Storybook's main file:

```ts
// .storybook/main.ts
import { muirPixieStorybookViteMockTransformerPlugin } from '@muirjs/pixie-storybook-vite';
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [muirPixieStorybookViteMockTransformerPlugin()],
    }),
};

export default config;
```

There, the Storybook UI and Storybook's Vitest addon both run the rewritten stories, and the `muir-shadowcat-storybook` ignorer
of `@muirjs/shadowcat-storybook` learns that the transformer is on.

### What the transformer leaves as written

The transformer reads every JavaScript and TypeScript module that imports from `storybook/test`, and rewrites only a
stub that sits outside any function, on a `fn()` imported from `storybook/test`. It leaves these as written, and the
mock reset still erases them:

- A `Once` stub, such as `mockResolvedValueOnce`.
- A stub after the first of its chain, as in `fn().mockResolvedValueOnce(a).mockResolvedValue(b)`.
- A stub on a spy call that takes arguments, as in `fn(impl).mockReturnValue(1)`. The rewrite would replace `impl`.

The `muir-shadowcat-storybook` report lists each of these, with a fix: pass the implementation to `fn()`, as in
`fn(() => value)`, return the value from the function `fn()` already takes, or set the stub in `beforeEach`.

A later call in a rewritten chain that resets the implementation, such as `mockReset()`, then falls back to the
stub's value, where the story as written gets none.

When Babel cannot parse a module that imports from `storybook/test`, the transformer throws an error that names the
file, and the test run stops.

## Reset module mock spies before each test

`sb.mock(import('./api'), { spy: true })` puts a spy in place of each export of a module. Storybook keeps these
module mock spies in one registry for the whole test run, and its default mock reset only clears them. So a stub that
one story sets on a module mock spy is still there when a later story renders. A story that relies on that leak
passes in a full run and fails when it runs alone. Stryker runs a story alone when only that story covers a mutant,
and then reports the mutant Killed whatever it changes.

`muirPixieStorybookViteMockResetPlugin()` adds a Vitest setup file that resets every spy in the registry before each test. Add
it to the Vitest configuration that runs the story tests:

```ts
// vitest.config.ts
import { muirPixieStorybookViteMockResetPlugin } from '@muirjs/pixie-storybook-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [muirPixieStorybookViteMockResetPlugin()],
});
```

The plugin resets in every run of the Vitest configuration, not only under Stryker. A story that relies on a module
mock leak then fails in your own runs too, where you can fix it, instead of only in Stryker's dry run. Expect such a
story to turn red when you add the plugin.

Only module mock spies are reset. Spies that a story makes with `fn()` keep Storybook's own reset settings.

Vitest's browser mode serves setup files through Vite's dev server, which refuses files outside
`server.fs.allow`. The plugin adds the setup file's folder to that list. When your configuration sets no list, it
also adds the workspace root that Vite allows by default. In Stryker's sandbox, add `muirShadowcatStorybookStrykerPlugin()` from
`@muirjs/shadowcat-storybook` as well.

## License

MIT
