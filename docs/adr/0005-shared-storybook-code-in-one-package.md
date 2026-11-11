# The code the Storybook packages share lives in one package, `@layzee/storybook-csf`

`@layzee/stryker-storybook`, `@layzee/storybook-mock-transformer` and `@layzee/stryker-storybook-mutators` need the
same code to read story files (`csf.ts`), find definition-time spy stubs (`stub-shape.ts`), write and read the
transformer record (`stryker-record.ts`), and read values of unknown shape (`is-record.ts`, `node-field.ts`). That
code lives in the private package `@layzee/storybook-csf`, which the three depend on as a regular dependency. It has
no Stryker peer, so the mock transformer, a Vite plugin, still depends on no Stryker package. Lars ruled: "CSF
reader/shared code: Approve recommendation.", approving that shared code reaches its consumers as a published
dependency rather than as copies.

This replaces the design plan's decision to keep these files as byte copies, one owner each, guarded by a
`test/copies.test.ts` in each consuming package (`plans/storybook-packages-design.plan.md`, section 3.2 and section
7 question 1), and the byte-copy consequence of the Storybook context's ADR 0003.

## Considered Options

- Byte copies with a drift test, the earlier decision. A copy reaches a published consumer only by being copied
  again, every fix has to land in each copy, and the drift tests only say that a copy differs.
- Moving the files into `@layzee/stryker-storybook` and depending on it. That would give the mock transformer a
  dependency on a Stryker plugin package and its Stryker peer.

## Consequences

- The `is-record.ts` files in `@layzee/stryker-mutator-install` and `@layzee/stryker-playwright-runner` stay where
  they are; this package serves the Storybook packages only.
