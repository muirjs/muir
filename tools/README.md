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
- `eslint-rules/`: the workspace's own ESLint rules and the checks of its configs; see its
  [README](eslint-rules/README.md).
