---
status: accepted
---

# The packages share one version, and its major is the StrykerJS major

Every published package except `@muirjs/madrox-node-test` is a StrykerJS plugin or supports one, and a user installs
several of them beside one `@stryker-mutator/core`. So the nineteen of them share one whole version, and from the
first stable release its major is the StrykerJS major they work with: `10.x.y` for StrykerJS 10. A user reads the
StrykerJS major off the version, and any two Muir packages with the same version work together.
`@muirjs/madrox-node-test` extends `node:test`, has nothing to do with StrykerJS, and versions on its own.

Until the first stable release the shared version is an ordinary `0.x.y` pre-release version that starts at `0.0.1`
and says nothing about StrykerJS.

Lars ruled (2026-11-27): "Only madrox-node-test gets a version that isn't synced with a StrykerJS major. All other
sync the major release/minor prerelease version with StrykerJS"; then, replacing the pre-release half of that: "Use
normal pre-release semantic versioning that isn't synced with a StrykerJS major version. Start with pre-release
version 0.0.1."; and "OK" to one whole shared version over a shared major only.

## Dist-tags

Besides `latest`, a release moves these npm dist-tags:

- `stryker-<major>`, such as `stryker-10`, on every package of the shared version: the newest version for that
  StrykerJS major. A user who stays on an older StrykerJS installs `@muirjs/siryn-playwright@stryker-10`. Lars
  approved "`stryker-<major>` dist-tags instead of `v<major>`".
- `<technology>-<version>` on a package that is specific to a technology, where the version is the technology's
  major, or its major and minor when the technology breaks its users in minors: the newest version of the package
  that supports that version of the technology.
  - `node-22`, `node-24` and `node-26` on `@muirjs/madrox-node-test`, `@muirjs/siryn-node-test`,
    `@muirjs/proteus-node` and `@muirjs/proteus-node-test`, computed from each package's `engines.node`.
  - A `playwright-<major>.<minor>` tag on `@muirjs/siryn-playwright` for each Playwright release that broke the
    runner, and no tag for the minors between them (Lars: "I suggest a new Playwright dist-tag per breaking change
    that affects us.").
  - `storybook-<major>`, `vitest-<major>`, `msw-<major>` and `react-<major>` on every package with a `storybook`,
    `vitest`, `msw` or `react` peer dependency, one tag for each major the peer range lists: `storybook-10`,
    `vitest-4` and `vitest-5`, `msw-2` and `msw-3`, `react-16` to `react-19` at the first release. The peer range
    decides, not the package name, so `@muirjs/moira-storybook` gets the Vitest tags and the Storybook packages,
    which have no `react` peer, get no React tag. Lars approved each in turn (2026-11-28), and
    `storybook-<major>` over `storybook-<major>.<minor>` because the Storybook floor holds for the major.

## Dropping a version of a technology

A package holds the floor of each peer dependency and of `engines.node` for the whole major. Raising a floor waits
for the next major, which is the next StrykerJS major.

`@muirjs/siryn-playwright` is the one exception. It reads Playwright Test's internals, and Playwright changes them in
minors. Its Playwright floor may rise in a minor release of the shared version, never in a patch, and the release
that raises it starts a new `playwright-<major>.<minor>` tag while the old tag stays on the last version that
supports the old floor. Lars ruled "Option C" (2026-11-28) for this package only.

## Considered options

- Two groups, the StrykerJS plugins on `10.x` and the packages without a StrykerJS dependency on `0.x`: Lars replaced
  it with the ruling above, as only `@muirjs/madrox-node-test` is used without StrykerJS.
- A shared major with a version per package: a user would have to look up which versions of two packages work
  together.
- `0.10.x` before the first stable release, to show the StrykerJS major early: every release would be a patch,
  breaking ones included, so the version would say nothing about what changed.
- `v<major>` dist-tags: the name does not say whose major it is.
- A Playwright tag per tested minor: most minors change nothing for the runner, so most tags would point at the
  same version.
- A new major of the shared version whenever the Playwright floor rises: the major would stop naming the StrykerJS
  major. Holding the Playwright floor for a whole StrykerJS major instead would keep the runner on internals that
  Playwright has since removed.

## Consequences

- Nx Release versions the nineteen packages as one fixed group, tagged `v<version>` in Git, and
  `@muirjs/madrox-node-test` as a group of its own, tagged `madrox-node-test@<version>`.
- A change to one package releases all nineteen, so most releases of a package hold no change to its code.
- A breaking change to a package's own API waits for the next StrykerJS major once the shared version is stable.
  Before that, in `0.x.y`, a breaking change raises the minor and a feature raises the patch.
- A minor release of the shared version can stop `@muirjs/siryn-playwright` from installing beside an old
  Playwright. The runner stops with an error that names the Playwright internals it did not find, and the old
  `playwright-<major>.<minor>` tag names the version to stay on.

Evidence: the `release` section of `nx.json`; ADR 0015 for what `<technology>` names;
`packages/siryn-playwright/README.md` for the Playwright versions it supports.
