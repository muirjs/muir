# An outcome survivor is a stub finding only where the stub's removal is detected

A surviving `MuirProteusStorybookTestSpyStubOutcome` mutant shows that no check tells a stub's success from its failure. Where
the `MuirProteusStorybookTestSpyStub` mutant that removes the same stub also survives, the report already lists an unchecked
stub on that line, whose fix covers both. Where the removal is killed or times out, a play needs the stub but checks
nothing its outcome changes, and until now no finding named that line: in two story files of the coder corpus, 4 of
20 outcome survivors were such lines. The `muir-shadowcat-storybook` reporter now lists each such line once as an
`outcome-unchecked` stub. Lars approved this on 2026-11-15.

## Consequences

- The two mutants of one stub pair by their span: they start at the same place, and the removal ends where the
  outcome mutant ends or, for a stub statement, one column later, since it also covers the semicolon (measured on
  the coder corpus: 23 of 27 pairs end one column apart, 4 end together). The stubs of one chain all start where the
  chain starts, so their ends tell them apart. A stub statement with anything between its call and its semicolon (a
  space, a comment, parentheses) pairs with no outcome mutant, so its outcome survivor gets no finding; Prettier
  never writes such a statement.
- The finding needs both mutators on: with `MuirProteusStorybookTestSpyStub` off, or disabled on the line, an outcome survivor
  gets no finding.

## Considered Options

- A finding for every outcome survivor: it would repeat each unchecked stub on the same line with a second fix.
- No finding (the earlier rule): it left a play that needs a stub, but checks nothing its outcome changes, with a
  bare Stryker survivor and no hint.
