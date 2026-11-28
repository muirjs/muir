# Agent guide

## Proving tests

- Prove that a test catches a change with `npx nx run <project>:mutate-src --mutate <file>:<start>-<end>` (for
  example
  `npx nx run @muirjs/siryn-node-test:mutate-src --mutate packages/siryn-node-test/src/dirs.ts:80-80`;
  a line without a range matches no file, and the dry run still reports success), not by reverting code or writing a
  control test by hand
- Run a whole file's or a whole project's mutation run, or one whose time you measure, in CI, not on the shared
  machine: push a `mutate/<topic>` branch and start `.github/workflows/mutation.yml` on it, for example
  `gh workflow run mutation.yml --ref mutate/<topic> -f project=@muirjs/siryn-node-test -f config=src -f copies=3`,
  then `gh run download` its reports. Keep local runs to a few line ranges
- For several ranges, join them with commas in one flag (`--mutate a.ts:18-31,a.ts:330-330`). A repeated `--mutate`
  flag ran no mutants and still reported success

## Git history

- Until the first release is cut, and after that between release cuts, you may amend, fix up and rewrite the commits
  on `main` back to the previous release cut. Once pull requests are in use, the limit is the last merge commit of a
  pull request instead. Never rewrite a release cut or anything before it.
- So fold the fix of a mistake into the commit that made it, instead of adding a commit that repairs it.
- Before the push, compare the rewritten branch's tree with the old one (`git diff <old> <new>` prints nothing unless
  the rewrite was meant to change content), and push with `git push --force-with-lease`.
- Lint, typecheck and test a change before you commit it; a formatting check alone is not enough.

## Domain language

Before you name a type, function, option, test or heading, read the glossary of the context you work in.
[GLOSSARY-MAP.md](GLOSSARY-MAP.md) lists the contexts, links each one's `GLOSSARY.md`, and says how the contexts
relate. Use each term as its glossary defines it; the words under _Avoid_ are rejected synonyms.

When a change adds or renames a concept that package users or maintainers name, changes what a term covers, or
removes the last thing a term names, update that context's `GLOSSARY.md` in the same commit. When it adds, removes
or merges a package or context, or changes what one context hands to another, update `GLOSSARY-MAP.md`. How:
[references/glossaries-and-adrs.md](references/glossaries-and-adrs.md) and
[references/glossary.md](references/glossary.md).

## Decisions

Before you change how something works, read the ADRs that cover it: [docs/adr](docs/adr) for decisions across
contexts, and the `docs/adr/` next to a context's `GLOSSARY.md` for decisions inside that context. Work within them.

When a change makes a decision that is hard to reverse, surprising without context and the result of a real
trade-off, write an ADR in the same commit. When it reverses, narrows or widens a decision an ADR records,
supersede that ADR. How: [references/glossaries-and-adrs.md](references/glossaries-and-adrs.md) and
[references/adr.md](references/adr.md).

## Mutant skips in the Storybook mutators

A Storybook mutator leaves out a mutant for one of two reasons, and the two err in opposite directions. Before you
add or change a skip, name its row.

| Skip             | Means                                           | Unsure | Decided by                                             | A new kind                                        |
| ---------------- | ----------------------------------------------- | ------ | ------------------------------------------------------ | ------------------------------------------------- |
| Site rule        | no play or test runs it, or a function reads it | skip   | `playedStories`, `sitesOf`; the read keys in `args.ts` | a site rule, with a case for each direction       |
| Equivalence skip | the file proves removing it changes nothing     | place  | a `Proven` minted in `@muirjs/moira-storybook`         | a new `ProofReason` there, never a mutator filter |

- Site rules: `packages/proteus-storybook/docs/adr/0001-args-mutated-only-where-a-play-or-test-runs.md`;
  at the meta's args they apply per key, decided by each meta run's `keyFrom` in `sitesOf`:
  `packages/proteus-storybook/docs/adr/0002-the-meta-args-are-an-args-site-judged-per-key.md`.
- Equivalence skips: `docs/adr/0006-place-a-mutant-unless-the-file-proves-it-changes-nothing.md`, and
  `packages/shadowcat-storybook/docs/adr/0005-every-equivalence-skip-carries-a-proven.md` for how a `Proven` is made.
- The interaction mutators skip only an interaction in a `beforeEach` or `afterEach` (a site rule, decided by
  the interaction reader's `inHook`) and place every other one:
  `packages/proteus-storybook-test/docs/adr/0002-place-every-interaction-outside-a-before-each-or-after-each.md`.
- A default global (`MuirProteusStorybookTestStoryGlobals`) is an equivalence skip too: its `default-global` `Proven` rests on
  Storybook 10.6.5's initial values, which `@muirjs/moira-storybook` holds, as well as on the file.
