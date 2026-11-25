# Stryker's 17 built-in mutators are off in Storybook play functions

This package mutates story test code, so it decides each built-in mutator for play functions on its own, as the
Playwright mutators do for Playwright test code. Lars asked: "For every built-in mutator, we should analyze whether
to exclude it or keep it in the play functions (test code config), like we're doing with Playwright test code." The
analysis measured 2,459 play mutants across three libraries (Angular, plain HTML and React): emptied play, step and
`waitFor` bodies and removed assertion statements survive by construction, and query strings, expected values and
selectors fail whenever their line runs, because Testing Library matches names exactly. Lars approved "the test-code
configs exclude all 17 built-in mutators" for play functions. The one kind of built-in mutant that may point at a
weak play, a removed raw DOM `focus()` or `blur()`, is an interaction that `MuirProteusStorybookTestInteraction` removes instead.
`src/built-in-reasons.ts` holds the reason for each built-in.

The install removes the built-ins for every file in the run, so story test code gets a Stryker configuration of its
own, and components and story data are mutated in another.

## Considered Options

- Keep the built-ins that have a few survivors left untriaged (ArrayDeclaration loop data, ArithmeticOperator
  return values). Their classes were Coverage or Noise wherever they were triaged.
