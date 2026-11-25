# The meta's args are an args site, and each key is judged by the played stories that take it from the meta

`MuirProteusStorybookArgs` left the meta's `args` alone, so a meta key that a played story falls back to got no mutant. Lars
approved making them a site on 2026-11-12: "Should the meta's args become an args mutation site: Approve
recommendation." Storybook 10.6.5 merges a story's args from the preview, then the meta, then the story, then a
`.test()` call's options, key by key, so a meta key reaches a played run only where nothing above the meta gives it.
ADR 0001's two questions, whether a play or test function runs for the args and which keys it reads, are therefore
asked per key at the meta. A meta key gets a mutant only when some played story surely takes it from the meta (a
taken key), and it is left alone when a play or `.test()` function of a story that may take it reads it.
`@muirjs/moira-storybook` tells, for each played story's run of the meta's args, whether the story takes a key from
the meta, gets it elsewhere (above the meta, or from another meta it is made from), or the file cannot tell. Both
questions are site rules, so a story the file cannot read counts as one that does not surely take the key but may
read it. A key that every played story gives is left alone by that rule, not by a Proven. This applies ADR 0001 and
does not supersede it: a story's own args are always taken by its own run, so nothing changes for them.

## Considered Options

- A Proven with a new reason, minted when every story that runs the meta gives the key. It has to cover every story,
  played or not, since composing a story without a play shows the removal, so a meta key that only such a story
  takes keeps a mutant that only a render can kill, the survivor ADR 0001 exists to avoid; and a rule over the played
  stories already skips every key the proof would.
- One read set for the whole meta site, the union of every played story's reads. It leaves a meta key alone when only
  a story that gives the key itself reads it, though the stories that take it from the meta check nothing about it.
- Runs of the meta site only for the stories made from that meta. It changes the runs of the meta's globals site,
  whose default-global proofs read every run, so `MuirProteusStorybookTestStoryGlobals` would change with it.

## Consequences

- A meta key equal to the project's own args keeps its mutant: the preview is not in the file (ADR 0006).
- A meta the file writes keeps its site and gets no proof; a key the write sets again is a known equivalent.
- A file whose played stories all take their `args` from another module gets no meta mutant.
- On a played story with no play, a meta key that every `.test()` call's options set keeps its mutant, as on a
  story's own args.
- The CSF ignorer of `@muirjs/shadowcat-storybook` reported every mutant inside the meta object as Ignored in its
  default play mode, the mode of the components configuration. Lars approved on 2026-11-14 that it leave the meta's
  `args` to the mutators ("1: Approve recommendation."), so Stryker's built-in mutators now place their mutants in
  the meta's `args` values too, as they do in a story's own `args`, since an ignorer skips by node, not by mutator.
  The directive that keeps the meta object's own `{}` mutant out also keeps that of `args` written on the meta's
  first line, as for a story's own `args`.
