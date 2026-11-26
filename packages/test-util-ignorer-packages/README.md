<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/test-util-ignorer-packages

Test support that the `@muirjs` ignorer packages share. It is private: no package depends on it at run time, and
it is not published.

- `muirInstrument(fileName, content, ignorers)` instruments one file with Stryker's own instrumenter, its built-in
  mutators and `ignorers`. It gives the instrumented code, Stryker's warnings, and each mutant's mutator, place
  (1-based, as the mutation report gives it), replacement and ignore reason.
- `muirIgnorerOutcomes(ignorer, code, name?)` instruments `code` with Stryker's own instrumenter, its built-in
  mutators and `ignorer`, and gives each mutant's outcome: the ignore reason, or `placed`. The file name, `a.tsx`
  by default, picks the parser.
- `muirAssertEveryOutcome(ignorer, code, outcome, name?)` fails when `code` has no mutants, or when a mutant has
  another outcome.
- `muirValidateOptions(options, contributions)` validates options the way Stryker core does, with the
  `strykerValidationSchema` objects that plugin modules export, and gives whether they are valid and what Stryker
  logged.

It finds Stryker core through `@muirjs/moira-mutators`, so it is a package of its own: the mutator packages'
test support, `@muirjs/test-util-mutator-packages`, is a test dependency of `@muirjs/moira-mutators` and cannot
depend on it.

Run its tests with `npx nx test @muirjs/test-util-ignorer-packages`.
