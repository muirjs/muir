<p align="center">
  <img src="docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# Muir

Plugins for [StrykerJS](https://stryker-mutator.io/), the mutation testing framework for JavaScript and
TypeScript: test runners for `node:test` and Playwright Test, mutators for JSX, Node.js, Playwright,
Storybook and msw code, and ignorers and a reporter for Storybook stories. The packages are ESM-only and
need Node.js 22.18 or later. CI tests them on Node.js 22 and 24.

## Package names

Every package is named `@muirjs/<mutant>-<technology>`. The mutant names the kind of plugin:

| Kind of package | Family    |
| --------------- | --------- |
| Core            | Moira     |
| Mutators        | Proteus   |
| Test runners    | Siryn     |
| Reporters       | Banshee   |
| Ignorers        | Shadowcat |
| Checkers        | Polaris   |
| Extensions      | Madrox    |
| Utilities       | Pixie     |

Every exported symbol starts with its package's prefix, `Muir<Mutant><Technology>`, such as
`MuirShadowcatStorybook` for `@muirjs/shadowcat-storybook`. So do the names that Stryker shows: the runner
`muir-siryn-node-test`, the options key `muirSirynNodeTest` and the mutator `MuirProteusJsxTextLiteral`.
[ADR 0012](docs/adr/0012-muir-mutant-technology-prefix-on-every-name.md) records why.

## Packages

Test runners:

- [`@muirjs/siryn-node-test`](packages/siryn-node-test/README.md): runs `node:test` files, each in its own
  `node` process, with coverage per test.
- [`@muirjs/siryn-playwright`](packages/siryn-playwright/README.md): runs Playwright e2e and component tests,
  with coverage per test, and starts the `webServer` once instead of once per mutant.

Mutators:

- [`@muirjs/proteus-js`](packages/proteus-js/README.md): statements and literals in any JavaScript or
  TypeScript code that Stryker's own mutators leave alone.
- [`@muirjs/proteus-node`](packages/proteus-node/README.md): code that uses Node.js APIs and `node:assert`.
- [`@muirjs/proteus-node-test`](packages/proteus-node-test/README.md): test files that use `node:assert` and
  `node:test`.
- [`@muirjs/proteus-jsx`](packages/proteus-jsx/README.md): the parts of JSX that Playwright tests look at.
- [`@muirjs/proteus-playwright`](packages/proteus-playwright/README.md): Playwright test code.
- [`@muirjs/proteus-storybook`](packages/proteus-storybook/README.md): Storybook story data.
- [`@muirjs/proteus-storybook-test`](packages/proteus-storybook-test/README.md): Storybook play functions.
- [`@muirjs/proteus-msw`](packages/proteus-msw/README.md): the responses of msw request handlers.

Ignorers and reporters:

- [`@muirjs/shadowcat-storybook`](packages/shadowcat-storybook/README.md): the ignorers, the reporter and the
  sandbox plugin for Storybook stories and their play functions.

Extensions and utilities:

- [`@muirjs/madrox-node-test`](packages/madrox-node-test/README.md): `muirTestEach` and `muirTestFor`, table
  tests for `node:test` that work like Vitest's `test.each` and `test.for`.
- [`@muirjs/pixie-storybook-vite`](packages/pixie-storybook-vite/README.md): Vite plugins that keep Storybook's
  definition-time spy stubs through its mock reset.

Core, which the other packages use:

- [`@muirjs/moira-mutators`](packages/moira-mutators/README.md): puts every mutator package's mutators into
  Stryker's instrumenter.
- [`@muirjs/moira-storybook`](packages/moira-storybook/README.md): reads Storybook story files and spy stubs.

## Workspace

This is an Nx workspace with npm workspaces. Run tasks through Nx:

```sh
npm ci
npx nx run-many -t lint typecheck build test
npx nx run @muirjs/proteus-jsx:mutate-src
```

The workspace mutation tests itself with its own packages: every package's Stryker config runs its tests on
`@muirjs/siryn-node-test` and adds the `@muirjs/proteus-node` mutators, and the test-code configs use the
`@muirjs/proteus-node-test` mutators. Every config fails below a mutation score of 100
([ADR 0011](docs/adr/0011-gate-on-a-mutation-score-of-100.md)).

- `packages/`: the published packages, and `test-util-mutator-packages`, the test support they share.
- `apps/demo-app`, `apps/demo-app-e2e`: a React demo app and its Playwright tests, which the Playwright runner
  and the JSX mutators run against.
- `e2e/`: end-to-end tests of the `node:test` runner on fixture projects and open-source projects.
- `oss/`: the configs and patches that copies of open-source projects needed for a Stryker run.
- `tools/`: workspace scripts, and `tools/eslint-rules`, the workspace's own ESLint rules and checks.
- `docs/adr/`: the decisions that span packages. `GLOSSARY-MAP.md` lists each package's glossary.
- `AGENTS.md`: the guide for coding agents.

## License

MIT, in [LICENSE](LICENSE).

The logo was created by AI using Microsoft Designer via Microsoft Copilot.
