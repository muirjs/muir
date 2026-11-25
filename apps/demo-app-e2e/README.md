# @muirjs/demo-app-e2e

The Playwright e2e tests of `apps/demo-app`. It is private.

- `npx nx run @muirjs/demo-app-e2e:e2e` runs the tests.
- `npx nx run @muirjs/demo-app-e2e:mutate-e2e` runs Stryker on the demo app with these tests, through
  `stryker.e2e.config.ts` at the workspace root.
- `npx nx run @muirjs/demo-app-e2e:mutate-e2e-ui` adds the JSX mutators of `@muirjs/proteus-react`, through
  `stryker.e2e.ui.config.ts`.
