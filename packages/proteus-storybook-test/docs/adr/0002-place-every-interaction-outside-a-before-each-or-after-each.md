# The interaction mutators place every interaction outside a beforeEach or afterEach

`MuirProteusStorybookTestInteraction`, `MuirProteusStorybookTestClickFocus`, `MuirProteusStorybookTestInteractionRepeat`, `MuirProteusStorybookTestInteractionTarget`
and `MuirProteusStorybookTestAssertionBefore` skip an interaction only when it stands in a `beforeEach` or `afterEach` (a site
rule, which the interaction reader's `inHook` decides and `story-file.ts` applies once for all five). Every other
interaction gets its mutants, including one that looks redundant: an interaction whose following checks are all
negative, a click or hover directly before a `type` of the same target, and a `type` or `clear` that a later `clear`
of the same target undoes. When such a mutant survives and the user judges it equivalent, they disable it with a
reasoned `// Stryker disable next-line <mutator>: <reason>` comment, which Stryker reports as `ignored`, as StrykerJS
asks for equivalent mutants. Lars ruled on 2026-11-12 ("1: Approve A plus survivor hints recommendation"), where A was
to place all three skipped shapes for every mutator that shared them, delete the user-event 14 proof that only the
click-before-type skip read, and keep the hook skip as a site rule.

None of the three skips was an equivalence skip (docs/adr ADR-0006), and the measurements showed each one hid
killable mutants:

- In a real browser (Storybook 10.6.5, Vitest 5.1.0 browser mode, Chromium), four plays with the skipped interaction
  removed all failed while their originals passed: a click count of 1 instead of 2, a checkbox left unchecked, "Saved
  2 times" not found, and 0 input events instead of 4.
- In an open-source design system's 53 story files (Storybook 10.6.2, Vitest 3.2.7 browser mode), the mutators
  skipped 13 interactions. Removing each one: negative-only, 6 of 8 killed, each by the play's own negated check (a
  dialog closed, a dropdown and a popover closed, a menu closed, a switch off, focus left a calendar grid), and 2
  survived (a click on a disabled control, then a check that nothing happened); click before type, 0 of 5 killed (a
  redundant click before a type, with checks only after the type); cleared later, none present.
- Across 6,480 open-source story files with 26,937 interactions, the three skips held back 1,312 interactions (4.9%):
  negative-only 1,225, click before type 83, cleared later 4.

This follows the prior art. StrykerJS places a known-equivalent mutant and lets the user disable it, and its docs say
there is no definitive way for Stryker to find equivalent mutants. PIT filters only narrow equivalent patterns, and
names its one heuristic filter (logging calls) so a user can turn it off. Neither skips a mutant the tests can kill.

## Considered Options

- Keep the three skips. They hid killable mutants in every shape that occurred, and a wrongly skipped mutant
  overstates the score with nothing in the report to show it.
- Move the skips into `@muirjs/moira-storybook` as a `Proven` (packages/shadowcat-storybook ADR-0005). A `Proven`
  claims that removing the interaction changes nothing, and the browser runs above disprove that claim for each of
  the three shapes.

## Consequences

- Redundant interactions now survive, such as a click directly before a `type` of the same target, whose `type`
  clicks first in user-event 14. The user disables each one with a reason.
- The user-event 14 proof, which told user-event 14 from Vitest browser's userEvent, had no other reader and went
  with the click-before-type skip. Which calls count as user-event interactions did not change.
