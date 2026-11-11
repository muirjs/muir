# Storybook test mutators

Mutators that change story test code instead of the components, so that a surviving mutant shows a step of a play
function that no check depends on. Story test code is the Storybook context's term; install, tier and built-in
mutator terms belong to the Mutator install context.

## Language

**LzStorybook test mutator**:
One of this package's mutators, named `LzStorybook` plus what it changes, such as `LzStorybookInteraction`.
_Avoid_: play mutator, Storybook operator

### Interactions

**Interaction**:
A call in story test code that acts on the rendered story: a user-event method such as `click` or `type`, a
`fireEvent` call, a composed play, or a raw DOM interaction.
_Avoid_: action (the Playwright mutators' term), user action

**Composed play**:
A call that runs another story's play inside this one: `Other.play(context)`, `meta.play?.(context)`, `Other.run()`
on a CSF factory story, or `step(label, Other.play)`.
_Avoid_: nested play, reused play

**Raw DOM interaction**:
A `focus()`, `blur()` or `click()` call with no argument, or a `dispatchEvent(event)` call, on an element.
_Avoid_: native event, DOM action

**Negative check**:
An `expect(...)` check with `.not` in its matcher chain, which passes when the interaction before it did nothing.
_Avoid_: absence check, negated assertion

**Skipped interaction**:
An interaction that `LzStorybookInteraction`, `LzStorybookClickFocus` and `LzStorybookInteractionRepeat` make no
mutant of: one in a `beforeEach` or `afterEach`, one whose
following checks are all negative checks, a click or hover that a `type` of the same target repeats (`type` clicks
first unless given `skipClick`), and a `type` or `clear` that a later `clear` of the same target undoes before any
check.
_Avoid_: ignored interaction (Ignored is a Stryker mutant status)
