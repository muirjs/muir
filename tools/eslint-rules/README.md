# @muirjs/eslint-rules

The workspace's own ESLint rules, and tests that check the workspace's configs. It is private.

Rules, which `eslint.config.mjs` turns on:

- `no-assertion-in-iteration`: an assertion in a loop body or an iteration callback, which may run zero times.
- `require-windows-hide`: a child process started with `detached: true` but without `windowsHide: true`, which opens
  a console window on Windows.
- `stryker-disable-comment`: a `// Stryker disable` comment that names `all`, gives no reason, or disables mutators
  for the rest of a file without restoring them.

Checks, run as its tests:

- `stryker-configs.test.ts`: every Stryker config in the workspace fails below a score of 100, mutates only its
  listed files, writes its reports by name, and has its rows in the CI mutation matrix.
- `eslint-config.test.ts`: the guards in `eslint.config.mjs` against `.only`, against disabling the type-safety rules,
  and for `curly`.
- `eslint-severity.test.ts`: every rule the ESLint configs turn on runs at error level.
- `runtime-errors.cli.ts`: fails a mutation run whose report holds a RuntimeError mutant that
  `runtime-errors.json` does not list, as the mutation score leaves those out.
- `mutation-summary.cli.ts`: writes a report's score and its mutants per status for the CI job summary.

Run them with `npx nx test @muirjs/eslint-rules`.
