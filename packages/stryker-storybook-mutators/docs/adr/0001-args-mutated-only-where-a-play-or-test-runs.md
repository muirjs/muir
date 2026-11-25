# LzStorybookArgs mutates only the args a play or test function runs for

Under Storybook's Vitest addon a story without a play function or a `.test()` call only renders, so a removed arg
survives there unless the render crashes, and the survivor says nothing about the story's checks. `LzStorybookArgs`
therefore mutates an `args` object only where a play or test function runs for it, decided from the story file alone,
and leaves keys that function reads (`args.label` in `getByText(args.label)`) alone, since the expected value would
move with the input. Lars ruled to keep this static rule for the first release and to defer support for visual tests
of stories, which would check stories without a play: "Defer visual testing support to a later milestone."

## Considered Options

- Decide by the test runner, so that a project whose Playwright tests check every story gets mutants in stories
  without a play. Deferred with visual testing support.
- A second mutator name for one mutant per story with the whole `args` replaced by `{}`. Lars approved folding it in
  as this mutator's coarse mode instead ("1: Approve recommendation."), and the coarse mutant is skipped where it
  equals Stryker's built-in ObjectLiteral mutant.
