# Every equivalence skip carries a `Proven` that `@layzee/storybook-csf` mints from root-gated layers

The Storybook mutators skip a mutant as equivalent only when the story file proves that it changes nothing (docs/adr
ADR-0006). The resolver in `@layzee/storybook-csf` followed a name only through the bindings the file leaves
unchanged, but read the meta object and a story's own object straight from the file, so a write such as
`meta.args.label = 'b'` or `Primary.args.label = 'b'` did not stop a skip, and `LzStorybookArgs` compared literals
per key, so a proof for `label: 'a'` also skipped a later `label: 'c'`. Now `@layzee/storybook-csf` reads every root
(a meta object, a story's own object, `.test()` options) through `rootLayer`, which gives an unknown layer when the
file writes the root's owner, and mints a `Proven` per property node: `overridden` when the object gives the key the
same value node without the property, `same-as-below` when its literal equals the value it falls back to in every
run of the site, every meta that may set the key giving that same literal. `Proven` is a class with `#` fields,
exported as a type only, so a mutator skips a property only by finding the `Proven` that `sitesOf` made for it. Lars
ruled on 2026-11-12 ("1-2: Approve recommendations") for this recommendation: a `Proven` value required for every
skip.

## Considered Options

- A brand on an interface or a symbol key. A spread such as `{ ...proven, property: node }` copies the brand onto a
  forged proof, and a predicate the mutator passes in (`changesNothing(site, () => true)`) lets the mutator decide
  the skip; both compiled in the design probes.
- Dropping the sites of a story or meta the file writes. ADR 0001 of the Storybook mutators asks only whether a play
  or test runs for an object, and a written root would lose every mutant of the story instead of one key's skip:
  the error ADR-0006 ranks worse.

## Consequences

- A site whose own story or meta the file writes gets no `same-as-below` proof, even where removing a key would
  change nothing; such a survivor is a known equivalent the user can disable.
- A site whose story, meta or `.test()` options constant another top-level object or meta reads when the file
  loads gets no `same-as-below` or `default-global` proof either, such as `Other = { args: { text: Primary.args.label } }` or `...Primary.args` after a key of
  `Other`'s own: removing the property changes what that object reads, outside the site's runs. A spread of the
  whole object at the top level (`{ ...Primary }`, `export default meta`) is not such a read, as the reader then
  runs the site itself and its run takes part in the proof. A top-level spread of a member (`{ ...lib.story }`)
  counts as a spread of its root name, so a read of `lib` elsewhere also stops the proofs of the spreading story's
  sites.
- `Object.assign({}, proven, { property: node })` still type-checks as a `Proven`, as TypeScript types
  `Object.assign` as the intersection of its arguments; the type stops a literal, a spread copy and construction,
  and ESLint's `prefer-object-spread`, on for the whole repository, rejects the `Object.assign({}, ...)` form.
- The site rules stay outside `Proven`: they skip when the file cannot tell, the opposite default.
- `LzStorybookStoryGlobals` skips a default global only through a `default-global` `Proven`, so Storybook 10.6.5's
  initial-globals table moved into `@layzee/storybook-csf`: a table in the mutator would let the mutator decide the
  skip. A story or meta the file writes, or another meta of the file, may set the global, so such a default keeps
  its mutant.
- Storybook checks the proofs: `test/compose-skips.test.ts` in each mutator package composes every case row with
  Storybook 10.6.5, with and without each property the mutator skips, and fails when a composed story or `.test()`
  child differs. Args compare deep-equal; globals compare by effect (a viewport by its `value`, backgrounds by `value`
  and `grid`), a rule copied from the Vitest addon as the `default-global` proof copies it. A name the row leaves
  unbound and a module it imports get a stub that claims every key the row names, so a skip over an unknown value
  shows as a change. A row with a proof that cannot load fails the test unless the test lists it as one Storybook
  cannot load either. Each test names the proof reasons its rows must exercise, and fails when one of them, or any
  proof at all, gets no cut. The check covers the case rows only, not every story file.
- Storybook's composition does not check a `viewport` default: composed with and without `viewport: 'responsive'`,
  the globals differ, and the test calls them the same through a hand-copied oracle of the Vitest addon's
  `setViewport` rule, the rule the `default-global` proof copies, so a mistake in that copy would pass both.
- A `Proven` is bound to the property node in the body a mutator passes to `sitesOf`, not to the file: a mutator
  that passed a body it built itself, holding the real property node, would get a real `Proven` for it. Both
  mutators pass Stryker's `program.body`; if one ever needs another body, binding the proofs to the Program is the
  way to close this.
