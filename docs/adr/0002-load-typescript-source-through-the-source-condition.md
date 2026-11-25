---
status: accepted
---

# Load the workspace's TypeScript source through the @muirjs/source condition, and test packed packages only in e2e

Every package's `exports` has an `@muirjs/source` condition that points at its TypeScript source. The workspace's
tests and mutation runs pass `--conditions=@muirjs/source`, and its type checks set the same condition in
`customConditions`, so packages load each other's source through Node.js type stripping with no build step. The e2e
tests and the OSS evaluation install packed tarballs instead, as a consumer would, so the built output is still
tested.

## Considered options

- Run tests and mutation runs against built output: every change would need a build before its tests, and each of
  Stryker's mutants in the source would reach the tests only through a build.

## Consequences

- Stryker's configurations load the runner and the mutators from source through `stryker.base.mjs`, so Nx sees no
  dependency of a package on the mutator packages it is mutation tested with.
- Loading source needs type stripping on by default, which Node.js 22 has from 22.18, the workspace's floor.
- The `exports` in a packed package keep the `@muirjs/source` key, while the tarball holds `dist` and no `src`. A
  consumer that runs with `--conditions=@muirjs/source`, as another `@muirjs` workspace can for its own source,
  resolves these packages to a `src/` that is not installed, and Node.js does not strip types under `node_modules`
  either way.

Evidence: 567bde1, 3d1bc4b, d51151e (the rename to `@muirjs/source`), 37c1e28 (e2e installs tarballs), 0765eb3.
