# The mutator packages share test support through `@layzee/test-util-mutator-packages`

Five mutator packages each held a byte copy of `test/support/temp-tree.ts`, and four held their own README tier
test, which drifted: two lacked the check that an empty tier's README section says "None.", and the helpers had
different names. A test may not import another project's files (`@nx/enforce-module-boundaries` refuses the relative
path, and each spec project's `rootDir` excludes them), so a copy was the only way to share without a project. Now
the private project `packages/test-util-mutator-packages`, tagged `type:test-util`, holds `tempRoot`, `writeTree`
and `testReadmeTiers`, which registers the README table and "None." checks for a package's tiers, and the mutator
packages take it as a dev dependency. Each package keeps its own test of the README's opening counts, whose wording
differs per package.

## Consequences

- Only a package's test files may import a `type:test-util` project: the module boundary rule allows the tag in
  `packages/*/test/**` and nowhere else, and the project is never published.
- `test/support/compose-skips.ts` stays a byte copy in the two Storybook mutator packages, guarded by the Storybook
  test mutators' `test/copies.test.ts`: it imports each package's own `Case` type, so sharing it would first need a
  `Case` both packages accept.
