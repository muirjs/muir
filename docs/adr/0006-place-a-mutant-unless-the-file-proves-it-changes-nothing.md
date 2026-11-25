# The Storybook mutators place a mutant unless the story file proves it changes nothing

`@muirjs/proteus-storybook` and `@muirjs/proteus-storybook-test` skip a mutant only when the story
file proves that it changes nothing, such as a removed arg whose literal value equals the value the file gives that
key below it. Where the file cannot prove it, they place the mutant, and a user who judges it equivalent silences it
with a `// Stryker disable` comment (StrykerJS `docs/disable-mutants.md`), which gives the mutant the `ignored` status
and keeps it in the report with the reason. Lars ruled on 2026-11-11 ("1-2: Approve recommendations.") for this
recommendation: "Should the mutators err toward placing the mutant? That is, skip a key only when the file proves its
value is the same below, and leave other possible equivalents to `// Stryker disable`. That matches first-party
Stryker."

The two errors are not alike. A killable mutant skipped wrongly overstates the mutation score, and nothing in the
report shows it. An equivalent mutant placed wrongly is a survivor the user sees, judges and can silence with a
reason.

This follows the prior art. StrykerJS 10.1.1 has no equivalence filter; its mutators skip only shapes visible in the
node itself: `ArrowFunction` skips an arrow whose body is already `undefined`, `ObjectLiteral` an object with no
properties, `BlockStatement` an empty block. PIT filters only mutants it can prove identical to the original. Trivial
Compiler Equivalence (Papadakis, Jia, Harman and Le Traon, ICSE 2015) declares a mutant equivalent only when its
compiled code is identical to the original's, and the equivalent-mutant literature (Madeyski et al., IEEE TSE 2014;
Papadakis et al., Advances in Computers 2019) treats detection that may give false positives as the error to avoid,
since equivalence is undecidable in general.

## Consequences

- The mutators place some mutants that no test can kill. The glossaries of both packages list the known shapes, so
  a user can recognise such a survivor and disable it.
- A check that would skip more mutants has to prove its case from the story file, as the resolver in
  `@muirjs/moira-storybook` does for a name the file leaves unchanged; a check that only finds a mutant likely to be
  equivalent does not skip it.
- `LzStorybookStoryGlobals` still skips a default global (its glossary's term), whose proof rests on Storybook
  10.6.5's own initial values rather than on the file alone: a project preview's `initialGlobals` can differ.
