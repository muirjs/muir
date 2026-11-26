---
status: accepted
---

# Ship ES modules only, and have mutators follow ES module imports only

Every package is an ES module package (`"type": "module"`, no `require` export condition) for Node.js 22.18 or later.
A mutator that checks which built-in module a function comes from follows an ES module `import` but not a CommonJS
`require`. Supporting one module system keeps the packages and each mutator's import check smaller and easier to
maintain.

## Considered options

- Also follow CommonJS `require` in the mutators: declined, so that each import-bound mutator has one way of finding
  its module.

## Consequences

- A CommonJS file gets no mutant from an import-bound mutator, and `MuirProteusNodeAwaitStatement` there also removes awaits in
  node:test teardown callbacks.
- `MuirProteusNodeTestCatchAssert` matches assertions by name, not by import, so it also mutates files that `require`
  `node:assert`.
- 2026-11-26: narrowed to `^22.18.0 || ^24.11.0 || ^26.13.0` in every package, and in the `muir-siryn-node-test`
  start-up check. Lars ruled that the packages support the current Node.js LTS major versions, each from its first LTS
  release (24.11.0 and 26.13.0), and never below 22.18.0, as the workspace runs its `.ts` files by type stripping:
  "Generally, I don't want any packages to go lower than 22.18.0 since it wouldn't run our .ts files as erasable
  syntax inside our repo". Node.js 27 and 28 are left out: "`>=26.13.0` would allow Node.js 27 (Alpha) and Node.js 28
  (future release). We don't support either." Stryker 10.1's `@babel/core` 8 also declares
  `^22.18.0 || >=24.11.0`.

Evidence: 205c182 (the ES module base configuration and engines), 0765eb3 (why the floor is 22.18), 20ea351
("ES modules, not CommonJS"), the "ES modules only" section of `packages/proteus-node/README.md`.
