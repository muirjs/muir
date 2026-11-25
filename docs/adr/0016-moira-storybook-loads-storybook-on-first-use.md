---
status: accepted
---

# `@muirjs/moira-storybook` holds the Storybook project reader and loads Storybook on first use

The Storybook project reader (which story files a Storybook config indexes, its preview's test settings and its
tag filter) and the stub verdict moved from `@muirjs/shadowcat-storybook` into `@muirjs/moira-storybook`, so the
story-file ignorer, the stub ignorer and the reporter can live in separate packages and share them. The package keeps
a single entry point and declares `storybook` as a required peer. It loads `storybook/internal/common`, `csf-tools`
and `csf` through `createRequire` the first time the reader needs them, because importing them costs about 340 ms
per process and most of the package's users never read a project. Lars ruled on 2026-11-25: "Keep a single entry
point", "But measure as recommended", and "OK" to loading Storybook's internals with `createRequire` inside the
package on first use.

## Considered options

- A `@muirjs/moira-storybook/project` subpath export: keeps the cost out of the main entry point, but splits one
  package's API in two. Lars chose a single entry point.
- A static import in the single entry point: every process that imports the package pays the load. Measured on
  Node.js 26.13.0, 32 alternating fresh processes: the package imports in a median 23.5 ms (p25 22.0, p75 27.5)
  without Storybook's internals and 363.5 ms (p25 352.6, p75 415.2) with them. In this workspace's mutation runs,
  where each test file is its own process, that cost repeats for every test file of the Storybook packages in every
  mutant run.
- A dynamic `import()`: the reader is synchronous, as Stryker calls the ignorers synchronously.
- An optional `storybook` peer: every package that uses moira-storybook runs inside a Storybook project, so the
  requirement is always there.

## Consequences

- `require` loads Storybook's ESM files through Node.js's `require(esm)`, which needs Node.js 22.12 or later; the
  packages already need 22.18. Measured on Node.js 22.23.1 and 26.13.0: the three modules load through
  `createRequire` with the same exports as through `import`.
- `createRequire` returns an untyped function, so the module that wraps it states the three modules' types without a
  check; a Storybook release that changes their exports fails at the call, not at compile time.
- The reader's messages take the calling package's name, so they name the plugin the user configured.
- The Storybook loader child, which runs in its own process, imports Storybook as before.
- With the reader inside, the package imports in a median 50.7 ms (p25 46.5, p75 58.6; same method, 2026-11-25),
  against 427.5 ms with Storybook's internals loaded as well. Of the 27 ms the reader added, `@babel/parser`, which
  the reader's parse step imports, takes about 11.5 ms on its own.

Evidence: ADR-0005; the benchmark in the 2026-11-25 session log; Storybook 10.6.5's `exports` map, which gives the
internal modules only a `default` condition.
