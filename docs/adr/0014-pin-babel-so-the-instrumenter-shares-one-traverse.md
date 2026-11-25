---
status: accepted
---

# Pin the workspace's Babel 8 packages so Stryker's instrumenter and its @babel/core share one @babel/traverse

The workspace root pins `@babel/core` 8.0.9, `@babel/traverse` 8.0.7, `@babel/types` 8.0.8, `@babel/parser` 8.0.8 and
`@babel/generator` 8.0.6 as devDependencies, so that npm hoists one copy of each. The swap mutators of
`@muirjs/moira-mutators` read the file being mutated through `path.hub.file` (`same-file-swap.ts`). Babel sets
`path.hub` only when the `@babel/traverse` that `@stryker-mutator/instrumenter` 10.1.1 imports is the same copy as the
one inside the `@babel/core` that the instrumenter resolves. Once the root `@babel/core` 8 came from the node:test
side, npm left the instrumenter a second traverse, `path.hub` was undefined, and the swap mutators made no mutants:
401 self-check failures across the Playwright, Storybook, JSX and msw mutator tests.

## Considered options

- An npm `overrides` entry for `@babel/core`'s dependencies: it made more copies, not fewer, and was reverted.
- No root `@babel/core`: the mutator packages and their tests import it directly, from both source repositories.
- Reading the file from somewhere other than `path.hub`: Stryker's instrumenter hands its mutators only the path, and
  `path.hub` is the only route from a path to its file's AST and options.

## Consequences

- A Babel upgrade moves all five pins together, to versions inside the instrumenter's `~8.0.x` ranges, and then
  `npm dedupe`. The mutator packages' self-checks fail loudly when the copies split again.
- A consumer's project can hit the same split when it hoists a Babel 8 that differs from the instrumenter's. The swap
  mutators' self-check then stops the install with an error rather than running without mutants.

Evidence: the merge commit cdfde948 (root config resolution) and the self-check failures it fixed, recorded in the
merge run's log.
