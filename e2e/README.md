# e2e

End-to-end tests of the `node:test` runner, `@muirjs/siryn-node-test`. It is a private Nx project.

- `test/*.e2e.ts`: run Stryker with the packed packages on the consumer projects in `fixtures/`, as a user's project
  would. The fixtures cover plain ES modules, TypeScript with the checker, child processes that tests spawn,
  handles held open, `node:test` features, and the runner's own behaviour, such as how it ends a mutant run that
  does not finish.
  Run them with `npx nx run e2e:e2e`.
- `src/oss/`: the driver that runs Stryker on pinned open-source `node:test` projects twice, with this runner and with
  Stryker's `command` runner, and compares the two reports. Run it with `npx nx run e2e:oss`.
- `test/unit/`: the unit tests of the driver and of the report tools in `src/`. Run them with `npx nx test e2e`.

[GLOSSARY.md](GLOSSARY.md) defines the terms the driver uses.
