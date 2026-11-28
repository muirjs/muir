# e2e

End-to-end tests of the `node:test` runner, `@muirjs/siryn-node-test`, and of the Storybook setup with React. It is
a private Nx project.

- `test/*.e2e.ts`: run Stryker with the packed packages on the consumer projects in `fixtures/`, as a user's project
  would. The fixtures cover plain ES modules, TypeScript with the checker, child processes that tests spawn,
  handles held open, `node:test` features, and the runner's own behaviour, such as how it ends a mutant run that
  does not finish.
  `test/pack.e2e.ts` checks what `npm pack` puts in the tarball of every published package: the built files, the
  manifest, the README and the license, with every file the manifest points an import at.
  Run them with `npx nx run e2e:e2e`.
- `test/browser/storybook-react.e2e.ts`: runs the setup of the
  [`@muirjs/shadowcat-storybook` README](../packages/shadowcat-storybook/README.md), with `@muirjs/proteus-react` and
  `@muirjs/shadowcat-react`, on a real `@storybook/react-vite` project, `fixtures/storybook-react`. It installs only
  the packed packages such a project installs, with one React version and the README's npm override that gives
  Stryker's instrumenter one copy of `@babel/traverse`, runs the story tests in Chromium, then both Stryker
  configurations, and checks the mutants and their statuses. Run it once per supported React major with `npx nx run e2e:e2e-storybook-react:react-16`,
  `:react-17`, `:react-18` or `:react-19`. It needs the Chromium of the `playwright` version in the fixture's
  `package.json`, so CI runs it in the `browser` job; keep that version in step with the job's image.
- `src/oss/`: the driver that runs Stryker on pinned open-source `node:test` projects twice, with this runner and with
  Stryker's `command` runner, and compares the two reports. Run it with `npx nx run e2e:oss`.
- `test/unit/`: the unit tests of the driver and of the report tools in `src/`. Run them with `npx nx test e2e`.

[GLOSSARY.md](GLOSSARY.md) defines the terms the driver uses.
