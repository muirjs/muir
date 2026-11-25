# JSX mutators

Mutators for React JSX and TSX, made so that a Playwright test, which finds elements by role, label and text, has
mutants it can kill.

## Language

### Mutators and their mutants

**JSX mutator**:
One of this package's mutators: a mutator whose mutants change what JSX renders (text, attributes, elements,
child expressions), named `MuirProteusReact` plus the kind of syntax it changes and a markup category.
_Avoid_: JSX operator, custom mutator (too broad)

**Mutation**:
One named change a JSX mutator makes, such as `RoleRemoval` or `ElementToSpan`; reports show only the mutator's
name.
_Avoid_: mutant type, sub-mutator

**Markup category**:
The word in a JSX mutator's name that says what part of the markup it changes: `Literal` (static text),
`Attribute`, `Element`, `Expression` or `Handler`. It is the last word, except in `MuirProteusReactElementRole`, where it
comes first.

### Where mutants land

**Element site**:
The JSX element a mutation looks at: its tag name and the names of its attributes.
_Avoid_: element node

**Attribute site**:
One JSX attribute on an element site, with its name and its value.

**Attribute value**:
What a JSX attribute holds, as one of three kinds: bare (no value, as in `<input disabled />`), string
(`alt="Logo"`), or expression (`alt={name}`).
_Avoid_: prop value

**JSX placement**:
Putting a mutant at a JSX attribute or a piece of JSX text, places where StrykerJS on its own cannot switch
between mutants.
_Avoid_: JSX instrumentation, JSX switching

### Roles

**Implicit role**:
The ARIA role an element has from its tag alone, or from its tag and an `href` for `a` and `area`, as at least
one test engine (Playwright or Testing Library) computes it.
_Avoid_: native role, default role

**Implicit-role table**:
The fixed list of tags and their implicit roles that decides which tags a span swap changes and which `role`
attributes restate the tag's own role.
_Avoid_: role map, role matrix

**Restating role**:
A `role` attribute whose value equals the element's implicit role, such as `<svg role="img">`; removing it
changes nothing, so it gets no mutant.
_Avoid_: redundant role

**Span swap**:
The `ElementToSpan` mutation: an element whose implicit role is `button` or `link` becomes a `span`, keeping only
the attributes a `span` can take.
_Avoid_: tag swap, element replacement
