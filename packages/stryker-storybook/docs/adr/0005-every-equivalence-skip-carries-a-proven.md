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
- `Object.assign({}, proven, { property: node })` still type-checks as a `Proven`, as TypeScript types
  `Object.assign` as the intersection of its arguments; the type stops a literal, a spread copy and construction.
- The site rules stay outside `Proven`: they skip when the file cannot tell, the opposite default.
