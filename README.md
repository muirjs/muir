# muir-siryn-node-test

An Nx workspace with six ESM-only packages for Node.js 22.18 or later, tested on Node.js 22 and 24:

- [`@muirjs/siryn-node-test`](packages/siryn-node-test/README.md): a StrykerJS test runner
  for `node:test` that runs each test file in its own `node` process.
- [`@muirjs/proteus-node`](packages/proteus-node/README.md): StrykerJS mutators for
  code that uses Node.js APIs and `node:assert`.
- [`@muirjs/proteus-js`](packages/proteus-js/README.md): StrykerJS mutators for any JavaScript
  or TypeScript code: statements and literals Stryker leaves alone.
- [`@muirjs/proteus-node-test`](packages/proteus-node-test/README.md): StrykerJS mutators for
  test files that use `node:assert` and `node:test`.
- [`@muirjs/moira-mutators`](packages/moira-mutators/README.md): the install layer that packages of
  StrykerJS mutators share.
- [`@muirjs/madrox-node-test`](packages/madrox-node-test/README.md): `muirTestEach` and `muirTestFor`, table tests for
  `node:test` that work like Vitest's `test.each` and `test.for`.

The MIT license is in `LICENSE`.
