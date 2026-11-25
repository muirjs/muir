# The mock transformer leaves a stub on a spy call that takes arguments as written

The mock transformer rewrites `fn().mockReturnValue(x)` into `fn(implementation)` form, which the mock reset keeps.
Its rewrite replaces the whole spy call, so for `fn(impl).mockReturnValue(x)` it dropped `impl` and any side effect in
it, and a stub inside `impl` had to be dropped with it. Lars approved the recommendation ("1-2: Approve
recommendations.", 2026-11-15) to leave such a stub as written: the transformer rewrites a stub only when its spy call
takes no arguments, and the `muir-shadowcat-storybook` report gives an erased stub of that kind the verdict
`spy-arguments-not-rewritten`. The fix every stub finding gives names both cases: pass the implementation to `fn()`,
or return the value from the function `fn()` already takes.

## Considered Options

- Keep `impl` evaluated, for example by writing the stub's value as a new implementation and calling `impl` for its
  side effects. Rejected: the rewritten spy would run code the story never runs at that point, and two
  implementations would have to be merged in a way no story asks for.
- Rewrite as before and drop `impl`. Rejected: the story then runs with a spy it does not have, and a stub inside
  `impl` cannot be rewritten in the same text.

## Consequences

- A stub on a spy call that takes arguments stays erasable by the mock reset, and the report names it.
- The stub ignorer reports only that stub's own arguments as Ignored, with the verdict's reason, for every stub on
  such a spy call, with the transformer on or off: ignoring the stub call would hide the mutants in the spy call's
  arguments, which the story runs after the mock reset. The `MuirProteusStorybookTestSpyStub` mutant that removes the erased stub
  and the `MuirProteusStorybookTestSpyStubOutcome` mutant that flips it are then placed and, as the stub changes nothing, survive
  (inferred from the code; no run has shown it yet); the report lists the first as an unchecked stub beside the
  finding, whose fix clears both, as for a later stub of a chain whose first stub is kept.
- A stub inside the spy call's arguments is a stub of its own spy call and is rewritten by the usual rule.
- `spy-arguments-not-rewritten` is a new verdict word in `muir-shadowcat-storybook.json` and in the stub ignorer's reason text.
