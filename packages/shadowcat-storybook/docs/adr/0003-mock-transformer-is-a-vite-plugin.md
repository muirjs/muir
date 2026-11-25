---
status: byte-copy consequence superseded by docs/adr ADR-0005
---

# The mock transformer is a Vite plugin in its own package, without a Stryker option

Storybook's default mock reset erases stubs made at definition time, such as `fn().mockReturnValue(v)` outside any
function, so a story that relies on one runs without its stub. The mock transformer is the Vite plugin
`muirPixieStorybookViteMockTransformerPlugin()`, which rewrites such stubs into `fn` with an implementation; adding it to the
Vitest config is what turns the rewrite on. Lars ruled: "No repairMocks setting. Adding the respective plugin is what
enables the mock _repairing_". The plugin runs in Vite, not in Stryker, so it lives in
`@muirjs/pixie-storybook-vite`, a package with no Stryker peer and only an optional `vite` peer.

## Considered Options

- A `repairMocks` option in the Stryker config, on by default. Rejected by the ruling above.

## Consequences

- Whether the rewrite runs is decided by the Vitest config alone, so the Stryker config and the Vitest config cannot
  disagree about it.
- `stub-shape.ts` and `stryker-record.ts` in `@muirjs/pixie-storybook-vite` are byte copies of
  `@muirjs/shadowcat-storybook`'s files, so the Vite plugin needs no dependency on a Stryker plugin package. Its
  `test/copies.test.ts` fails when a copy drifts, and its test target lists the owner's files as inputs.
