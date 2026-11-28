# tools

Workspace scripts. They are not published.

- `compare-mutation-reports.ts`: compares the mutants of two Stryker `mutation.json` reports, and with `--status`
  their statuses too.
- `stryker-checkpoint.ts`: the `muir-checkpoint` Stryker reporter, which saves the incremental file during a run,
  as Stryker saves it only when a run ends or on a signal, and Windows sends no signal when it ends a process.
- `bench-hello-world.ts`, `bench-playwright-runs.ts`: the benchmarks of the Playwright runner that
  `docs/VERDICT.md` cites.
- `linux-run.sh`: runs the workspace's checks from a `git archive` of HEAD inside the Playwright Linux container, and
  writes each step's exit code and time to `/out/summary.txt`.
- `packed-demo/`: the demo app on the packed package tarballs, as a consumer installs them.
- `react-versions/`: one private workspace package per React version that the tests of `@muirjs/proteus-react` and
  `@muirjs/shadowcat-react` render under, the oldest and the newest release of each supported major. Each folder
  installs its own `react` and `react-dom`; the tests find the versions by listing the folders, so adding a folder
  adds a version.
- `eslint-rules/`: the workspace's own ESLint rules and the checks of its configs; see its
  [README](eslint-rules/README.md).
