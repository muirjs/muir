# Agent guide

## Domain language

Before you name a type, function, option, test or heading, read the glossary of the context you work in.
`GLOSSARY-MAP.md` lists the contexts, links each one's `GLOSSARY.md`, and says how the contexts relate. Use each
term as its glossary defines it; the words under _Avoid_ are rejected synonyms.

When a change adds or renames a concept that package users or maintainers name, changes what a term covers, or
removes the last thing a term names, update that context's `GLOSSARY.md` in the same commit. When it adds, removes
or merges a package or context, or changes what one context hands to another, update `GLOSSARY-MAP.md`. How:
`references/glossaries-and-adrs.md`.

## Decisions

Before you change how something works, read the ADRs that cover it: `docs/adr/` for decisions across contexts,
and the `docs/adr/` next to a context's `GLOSSARY.md` for decisions inside that context. Work within them.

When a change makes a decision that is hard to reverse, surprising without context and the result of a real
trade-off, write an ADR in the same commit. When it reverses, narrows or widens a decision an ADR records,
supersede that ADR. How: `references/glossaries-and-adrs.md`.

## Mutant skips in the Storybook mutators

A Storybook mutator leaves out a mutant for one of two reasons, and the two err in opposite directions. Before you
add or change a skip, name its row.

| Skip             | Means                                           | Unsure | Decided by                                             | A new kind                                        |
| ---------------- | ----------------------------------------------- | ------ | ------------------------------------------------------ | ------------------------------------------------- |
| Site rule        | no play or test runs it, or a function reads it | skip   | `playedStories`, `sitesOf`; the read keys in `args.ts` | a site rule, with a case for each direction       |
| Equivalence skip | the file proves removing it changes nothing     | place  | a `Proven` minted in `@layzee/storybook-core`          | a new `ProofReason` there, never a mutator filter |

- Site rules: `packages/stryker-storybook-mutators/docs/adr/0001-args-mutated-only-where-a-play-or-test-runs.md`.
- Equivalence skips: `docs/adr/0006-place-a-mutant-unless-the-file-proves-it-changes-nothing.md`, and
  `packages/stryker-storybook/docs/adr/0005-every-equivalence-skip-carries-a-proven.md` for how a `Proven` is made.
- The interaction mutators skip only an interaction in a story hook (a site rule) and place every other one:
  `packages/stryker-storybook-test-mutators/docs/adr/0002-place-every-interaction-outside-a-story-hook.md`.
- A default global (`LzStorybookStoryGlobals`) is an equivalence skip too: its `default-global` `Proven` rests on
  Storybook 10.6.5's initial values, which `@layzee/storybook-core` holds, as well as on the file.
