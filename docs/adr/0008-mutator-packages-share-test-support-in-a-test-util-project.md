# The mutator packages share test support through `@muirjs/test-util-mutator-packages`

Five mutator packages each held a byte copy of `test/support/temp-tree.ts`, the two Storybook mutator packages each
held one of `test/support/compose-skips.ts` behind a drift guard, and four packages held their own README tier
test, which drifted: two lacked the check that an empty tier's README section says "None.", and Playwright's checked
only part of its opening sentence. A test may not import another project's files (`@nx/enforce-module-boundaries`
refuses the relative path, and each spec project's `rootDir` excludes them), so a copy was the only way to share
without a project. Now the private project `packages/test-util-mutator-packages`, tagged `type:test-util`, holds
`tempRoot`, `writeTree`, `testReadmeTiers` (the README's opening counts, default install line, tier tables and
"None." checks) and, under its own `./compose-skips` export, the `composeSkips` harness. The mutator packages take
it as a dev dependency.

## Consequences

- Only a package's test files may import a `type:test-util` project: the module boundary rule allows the tag in
  `packages/*/test/**` and nowhere else, and the project is never published. A `type:test-util` project may import
  `type:lib` projects, as `composeSkips` imports `@muirjs/moira-storybook`.
- `composeSkips` loads Babel and Storybook, so it has its own export path, and the packages without Storybook do not
  load it through the main entry.
- The Nx TypeScript sync puts each consumer's reference to the project in its `tsconfig.lib.json`, as it does for
  every `package.json` dependency, so a change in the project also invalidates those packages' build cache.
