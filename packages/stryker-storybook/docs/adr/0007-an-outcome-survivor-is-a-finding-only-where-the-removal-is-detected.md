# An outcome survivor is a stub finding only where the stub's removal is detected

A surviving `LzStorybookSpyStubOutcome` mutant shows that no check tells a stub's success from its failure. Where
the `LzStorybookSpyStub` mutant that removes the same stub also survives, the report already lists an unchecked
stub on that line, whose fix covers both. Where the removal is killed or times out, a play needs the stub but checks
nothing its outcome changes, and until now no finding named that line: in two story files of the coder corpus, 4 of
20 outcome survivors were such lines. The `lz-storybook` reporter now lists each such line once as an
`outcome-unchecked` stub. Lars approved this on 2026-11-15.

## Consequences

- The two mutants of one stub pair by where they start: the removal of a stub statement also covers its semicolon,
  so its end is one column later than the outcome mutant's (measured on the coder corpus, 23 of 27 pairs). Two stubs
  of one chain start at the same place, so their mutants pair as one.
- The finding needs both mutators on: with `LzStorybookSpyStub` off, or disabled on the line, an outcome survivor
  gets no finding.

## Considered Options

- A finding for every outcome survivor: it would repeat each unchecked stub on the same line with a second fix.
- No finding (the earlier rule): it left a play that needs a stub, but checks nothing its outcome changes, with a
  bare Stryker survivor and no hint.
