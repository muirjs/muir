# @muirjs/demo-app

A small React shop built with Vite. It is private: it exists so that the Playwright runner,
`@muirjs/siryn-playwright`, and the JSX mutators, `@muirjs/proteus-react`, have an app to mutation test.

- `npx nx run @muirjs/demo-app:dev` starts the app.
- `npx nx run @muirjs/demo-app:mutate-ct` runs Stryker on the app with its Playwright component tests
  (`playwright.components.config.mts`), through `stryker.ct.config.ts` at the workspace root.

Its e2e tests live in `apps/demo-app-e2e`.
