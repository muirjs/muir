# The code the Storybook packages share lives in one package, `@layzee/storybook-csf`

`@layzee/stryker-storybook`, `@layzee/storybook-mock-transformer` and `@layzee/stryker-storybook-mutators` need the
same code to read story files (`csf.ts`), find definition-time spy stubs (`stub-shape.ts`), write and read the
transformer record (`stryker-record.ts`), and read values of unknown shape (`is-record.ts`, `node-field.ts`). That
code lives in the internal package `@layzee/storybook-csf`, which the three depend on as a regular dependency. It has
no Stryker peer, so the mock transformer, a Vite plugin, still depends on no Stryker package. Lars ruled: "CSF
reader/shared code: Approve recommendation." The recommendation he approved: shared code reaches its consumers as a
published dependency, in one package with no Stryker peer, rather than as copies.

Before this, `@layzee/stryker-storybook` owned these files and the other two packages held byte copies of them, each
guarded by a `test/copies.test.ts` that failed when a copy drifted. The copies let the Vite plugin share the code
without depending on a Stryker plugin package or on a package created only for shared code.

## Considered Options

- Byte copies with a drift test, the earlier decision. A copy reaches a published consumer only by being copied
  again, every fix has to land in each copy, and the drift tests only say that a copy differs.
- Moving the files into `@layzee/stryker-storybook` and depending on it. That would give the mock transformer a
  dependency on a Stryker plugin package and its Stryker peer.

## Consequences

- `@layzee/stryker-storybook`'s tests exercise most of this code, so the package's Stryker config runs them along with
  its own tests, and mutates in place: those tests import the package through `node_modules`, which a Stryker sandbox
  links to the unmutated sources.
- The `is-record.ts` files in `@layzee/stryker-mutator-install` and `@layzee/stryker-playwright-runner` stay where
  they are; this package serves the Storybook packages only.
