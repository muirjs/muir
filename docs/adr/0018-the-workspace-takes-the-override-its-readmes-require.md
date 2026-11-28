---
status: accepted
---

# The workspace gives the instrumenter one @babel/traverse with the npm override its READMEs require

A fresh install of StrykerJS 10.1.1 with Muir's packages holds two copies of `@babel/traverse` 8: 8.1.4 at the root,
which StrykerJS's own Babel presets pull in, and 8.0.x nested under `@stryker-mutator/instrumenter`, which asks for
`~8.0.4`. The instrumenter then walks each file with a traverse other than the one inside its `@babel/core`, so
`path.hub` is undefined. The `@muirjs/shadowcat-storybook` README makes the npm override
`"@stryker-mutator/instrumenter": { "@babel/traverse": "8.1.4" }` a required setup step, and the plugins stop the run
with an error that names it.

The workspace root now takes the same override instead of pinning every Babel package to 8.0, as ADR-0014 did. It
pins `@babel/core` 8.0.9, inside the `~8.0.0` that the instrumenter and the mutator packages' peer ranges ask for,
and `@babel/traverse` 8.1.4, `@babel/generator` 8.1.4, `@babel/parser` 8.1.3 and `@babel/types` 8.1.3, the Babel
that a consumer's install hoists. So the workspace's tests and mutation runs see the tree a consumer has, and a
change that breaks the documented setup fails here first.

## Considered options

- Keep ADR-0014's 8.0 pins. The workspace then has one traverse without the override, and nothing here would show
  that the step the READMEs require works.
- Move `@babel/core` to 8.1 as well. npm refuses the install, because the mutator packages declare a peer dependency
  on `@babel/core` `~8.0.0`.

## Consequences

- `npm ls @babel/traverse` lists one copy, 8.1.4, marked overridden. The instrumenter still has its own
  `@babel/generator` and `@babel/parser` 8.0.10, as a consumer's does; the mutators read only through traverse.
- The override's version, the README's example and the error message in `@muirjs/moira-storybook` name the same
  version. A Babel upgrade moves all of them, then `npm dedupe`.
- The mutator packages' self-checks and the Storybook plugins' error still fail loudly if the copies split again.
