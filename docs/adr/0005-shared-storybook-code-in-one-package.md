# The code the Storybook packages share lives in one package, `@muirjs/moira-storybook`

`@muirjs/shadowcat-storybook`, `@muirjs/pixie-storybook`, `@muirjs/proteus-storybook` and
`@muirjs/proteus-storybook-test` need the same code to read story files (`csf.ts`), find definition-time spy
stubs (`stub-shape.ts`), write and read the transformer record (`stryker-record.ts`), and read values of unknown shape
(`is-record.ts`, `node-field.ts`). That code lives in the internal package `@muirjs/moira-storybook`, which the four
depend on as a regular dependency. It has
no Stryker peer, so the mock transformer, a Vite plugin, still depends on no Stryker package. Lars ruled: "CSF
reader/shared code: Approve recommendation." The recommendation he approved: shared code reaches its consumers as a
published dependency, in one package with no Stryker peer, rather than as copies.

The package was first named `@muirjs/storybook-csf`, although it holds more than the CSF reader. It also holds the
stub shape, the transformer record and the value readers. Lars ruled on 2026-11-11: "Name of the shared package:
`@muirjs/moira-storybook` rather than _shared_." The rename landed on 2026-11-12, and this decision is unchanged.

Before this, `@muirjs/shadowcat-storybook` owned these files and the other two packages held byte copies of them, each
guarded by a `test/copies.test.ts` that failed when a copy drifted. The copies let the Vite plugin share the code
without depending on a Stryker plugin package or on a package created only for shared code.

## Considered Options

- Byte copies with a drift test, the earlier decision. A copy reaches a published consumer only by being copied
  again, every fix has to land in each copy, and the drift tests only say that a copy differs.
- Moving the files into `@muirjs/shadowcat-storybook` and depending on it. That would give the mock transformer a
  dependency on a Stryker plugin package and its Stryker peer.

## Consequences

- `@muirjs/shadowcat-storybook`'s tests exercise most of this code, so the package's Stryker config runs them along with
  its own tests, and mutates in place: those tests import the package through `node_modules`, which a Stryker sandbox
  links to the unmutated sources.
- The `is-record.ts` files in `@muirjs/moira-mutators` and `@muirjs/siryn-playwright` stay where
  they are; this package serves the Storybook packages only.
