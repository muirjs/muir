# Storybook test mutators

Mutators that change story test code instead of the components, so that a surviving mutant shows a step of a play
function that no check depends on. Story test code is the Storybook context's term, read as `@layzee/storybook-csf`
reads it: the plays and hooks of the meta and the stories, including ones assigned as `Story.play = ...`, and the
`.test()` bodies of exported stories. Install, tier and built-in mutator terms belong to the Mutator install context.

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
on a CSF factory story, or `step(label, Other.play)`. A `.play()` or `.run()` call on any identifier counts, but only
inside story test code, so `video.play()` in a `render` is none.
_Avoid_: nested play, reused play

**Raw DOM interaction**:
A `focus()`, `blur()` or `click()` call with no argument, or a `dispatchEvent(event)` call, on any receiver, inside
story test code; the same call in a `render`, a decorator or a `useEffect` is none.
_Avoid_: native event, DOM action

**Target query**:
The Testing Library query that an interaction acts on as its first argument, awaited or not, such as
`canvas.getByRole('button', { name: 'Save' })` in `userEvent.click(canvas.getByRole('button', { name: 'Save' }))`;
`LzStorybookInteractionTarget` swaps its name or text for another one in the same file: the name of a `getBy`,
`findBy` or `queryBy` query of the same string-literal role, or the text of a query of the same method.
_Avoid_: target (alone), locator (the Playwright mutators' term)

**Negative check**:
An `expect(...)` check with `.not` in its matcher chain, which passes when the interaction before it did nothing.
_Avoid_: absence check, negated assertion

**Skipped interaction**:
An interaction that `LzStorybookInteraction`, `LzStorybookClickFocus`, `LzStorybookInteractionRepeat`,
`LzStorybookInteractionTarget` and `LzStorybookAssertionBefore` make no mutant of: one in a `beforeEach` or
`afterEach`, given inline or as a function declared in the file, one whose following checks are all negative checks,
a click or hover that a user-event 14 `type` of the same target in the next statement repeats (that `type` clicks
first unless given a `skipClick` other than `false`; Vitest browser's does not click), and a `type` or `clear` that a
later `clear` of the same target undoes before any check.
_Avoid_: ignored interaction (Ignored is a Stryker mutant status)

**Copied check**:
The first `expect(...)` statement after an interaction in the interaction's own block, before the next interaction,
that `LzStorybookAssertionBefore` also runs before the interaction; a check after the end of a step callback that
holds the interaction is not looked at, so an interaction that is a step callback's expression body has none. A
negative check, a `toHaveBeenCalledTimes(0)` check, one that reads a name declared or assigned after the interaction,
and one that already stands earlier in the play are not copied.
_Avoid_: duplicated assertion, moved check

### Spy stubs

**Stub statement**:
An expression statement in story test code whose call is a spy stub method on any receiver, such as
`mocked(save).mockResolvedValue(note);` in a play or a `beforeEach`. `LzStorybookSpyStub` removes it, as it removes
the chain of a definition-time stub (the Storybook context's term).
_Avoid_: mock statement, stub call

**Outcome mutant**:
The `LzStorybookSpyStub` mutant that turns a `mockResolvedValue` stub into `mockRejectedValue(new Error('Stryker'))`
and a `mockRejectedValue` stub into `mockResolvedValue(undefined)`, keeping a `Once` form, so a survivor shows that
no check tells success from failure of that call.
_Avoid_: flip mutant, rejection mutant

### Globals

**Globals site**:
A `globals` object literal that `LzStorybookStoryGlobals` removes one property of per mutant: a story's own `globals`
when the story has a play of its own, from a top-level story it spreads, from its `.extend()` base or from the meta,
or has a `.test()` call; the meta's `globals` when such a story exists; and the `globals` in the options of a
`.test()` call on a story.
_Avoid_: globals target, story globals (the meta's are sites too)

**Default global**:
A property of a globals site whose value is Storybook 10.6.5's own initial value for that global, which gets no
mutant because the story runs the same without it: `viewport` as `'responsive'` or `'100pct-100pct'`, or as an
object of such a value or `undefined` with `isRotated: false`; `backgrounds` with an `undefined` value and
`grid: false`; `measureEnabled: false`; `outline: false`. The table is fixed; a project's own `initialGlobals` are
not read.
_Avoid_: initial global, preset global

### Waits

**Retrying wait**:
A Testing Library call that retries until it passes or times out: `waitFor(() => ...)`,
`waitForElementToBeRemoved(...)`, or a `findBy` or `findAllBy` query. `LzStorybookWaitFor` makes it check once, or
removes the removal wait.
_Avoid_: async wait, polling
