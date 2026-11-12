# Storybook test mutators

Mutators that change story test code instead of the components, so that a surviving mutant shows a step of a play
function that no check depends on. Story test code is the Storybook context's term, read as `@layzee/storybook-core`
reads it: the plays and hooks of the meta and the stories, including ones assigned as `Story.play = ...`, and the
`.test()` bodies of exported stories that Storybook runs. Install, tier and built-in mutator terms belong to the Mutator install context.

## Language

**LzStorybook test mutator**:
One of this package's mutators, named `LzStorybook` plus what it changes, such as `LzStorybookInteraction`.
_Avoid_: play mutator, Storybook operator

### Interactions

**Interaction**:
A call in story test code that acts on the rendered story: a user-event method such as `click` or `type`, a `fireEvent`
call, a composed play, or a raw DOM interaction. It is a statement, or the expression body of an arrow given to
`step(...)`; the same call elsewhere, such as in an expression-bodied arrow given to `forEach`, is none.
_Avoid_: action (the Playwright mutators' term), user action

**Composed play**:
A call that runs another story's play inside this one: `Other.play(context)`, `meta.play?.(context)`, `Other.run()` on a
CSF factory story, or `step(label, Other.play)`. The story may come from a namespace import, as in
`Stories.Other.play(context)`. A `.play()` or `.run()` call, or a `.play` given to `step(...)`, counts when its receiver
is an identifier or a member chain that starts at one, computed and optional members included
(`Stories['Other'].play(context)`, `Stories?.Other.play(context)`, `step(label, Stories?.Other.play)`), not a call
result such as `canvas.getByTestId('video').play()`. A call counts only inside story test code, so `video.play()` in a
`render` is none.
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

**Following checks**:
The `expect(...)` checks after an interaction, up to the next statement that is or holds an interaction. A statement
holds an interaction that runs within it, such as one in an `if` or in a `waitFor(...)` callback; a `step(...)` holds
every interaction in its callback, including one in a function the callback defines. Outside a step callback, an
interaction is looked for only in `step` and `waitFor` callbacks: every other function counts as not run, even one
that the statement calls. Checks are found in any function. The copied check and a later `clear` that undoes a `type`
are looked for in the interaction's own block; the following check that a skipped interaction needs is looked for past
the end of that block and of a step callback that holds the interaction.
_Avoid_: checks after, assertion window

**Checks before the next interaction**:
The `expect(...)` checks after an interaction, past the end of its block and of a step callback that holds it, up to
the next statement that is itself an interaction or a `step(...)` that holds one. A statement that holds an interaction
only inside an `if` or a `waitFor` callback does not end them, so they include the following checks and may hold more.
_Avoid_: long window, negative window

**Skipped interaction**:
An interaction that `LzStorybookInteraction`, `LzStorybookClickFocus`, `LzStorybookInteractionRepeat`,
`LzStorybookInteractionTarget` and `LzStorybookAssertionBefore` make no mutant of: one in a `beforeEach` or `afterEach`,
given inline or as a function declared in the file but not one that a call wraps (`withUser(fn)`); one with at least one
following check, whose checks before the next interaction are all negative checks; a click or hover that a `type` of
the same target in the next statement repeats, when that `type`'s receiver is a proven user-event 14 (whose `type`
clicks first unless given a `skipClick` other than `false`); and a `type` or `clear` with no following checks, when
the statement that ends them is a `clear` of the same target, which undoes it.
_Avoid_: ignored interaction (Ignored is a Stryker mutant status)

**Proven user-event 14**:
A user-event receiver that the file proves is user-event 14, whose `type` clicks first. Every other receiver may be
Vitest browser's userEvent, whose `type` does not click.

- _Sources._ `userEvent` imported by name from `storybook/test` or `@testing-library/user-event`, or the default import
  of `@testing-library/user-event`, under any local name; the `userEvent` of a play's context, destructured without a
  default in its first parameter or read as `<context>.userEvent` or `<context>?.userEvent` on that parameter itself;
  the `setup()` of one of these, or a choice between them, as the one value of a local, read where the local is given
  that value. The play is a `play` property or method given inline under a key that is not computed, is story test code
  and inside none, and never reassigns that parameter or the local it destructures.
- _Binding rule._ A local that holds a source keeps its proof only when every reference to it is a method call's
  receiver, under any type assertions, a side of a choice that is the one value of such a local, or inside a type. An
  import also needs every import of `storybook/test` or `@testing-library/user-event` in the file to meet that, the
  `userEvent` and `default` members of a namespace import included, and no `import()` or `require()` of one of those
  modules or of a module the file does not spell out.
- _Context rule._ A play context keeps its proof only when every context the file can reach is only read: used as
  `<context>.<name>`, or destructured under plain keys in a parameter or a declaration, with its `userEvent` held to the
  binding rule, its `step` only called, and its `context` member, which Storybook sets to the context itself, read the
  same way. A context is the first parameter of a `play`, `beforeEach` or loader, the second of a decorator or `render`
  function, both of these for a value under a computed key or assigned to a computed member, the first of a callback
  given to a context's `step`, and a call of `useStoryContext` under its own or its imported name. Such a hook counts
  given inline, as a plain method, in an array, or by the name of a local function the file never reassigns, as an
  object's property or assigned to `<x>.<key>`. A hook that reaches itself through a `step` is read once, as reading it
  again finds nothing new. Any other hook value drops the proof: an import, a member or a call
  result, a getter, a hook that reads `arguments` or has a rest parameter at or before its context, a spread into a meta or story object
  of anything but a local object literal that the file never reassigns and that spreads nothing, and an `assign` call
  onto anything but a fresh object literal.
- _Backstop._ Every play context's proof also needs the file to name `userEvent` only as an import's name, a key or local
  of a parameter's destructuring, a `userEvent` or `<x>.userEvent` that is a method call's receiver or a choice side as
  above, or inside a type, and never as a string or a template's text. An unrelated object's `userEvent` key drops the
  proof too.
- _Not read._ Hooks Storybook receives in ways the rules do not read and that do not name `userEvent`, such as a
  decorator pushed onto `Story.decorators` or a hook given by `Object.defineProperty`, keys built at run time inside
  such a hook, and a play that other code calls with a context of its own. The storybook-core proof of the meta and
  story objects is left to read these.
- _Assumptions._ The play context's proof rests on Storybook 10.6.5, which sets it to user-event 14's `setup()` and runs
  the loaders, the `beforeEach` hooks and the first decorator on the same context before the play, as the default
  global's proof rests on Storybook's initial values. It also assumes that no project loader, `beforeEach` or decorator
  in `.storybook/preview` replaces the context's userEvent, which the story file cannot show.

_Avoid_: real userEvent, Storybook userEvent

**Copied check**:
The first statement in an interaction's own block that holds one of its following checks, which
`LzStorybookAssertionBefore` also runs before the interaction; a check after the end of a step callback that holds the
interaction is not looked at, so an interaction that is a step callback's expression body has none. A check that is or
holds a negative check or a `toHaveBeenCalledTimes(0)` check, one that reads a name declared or assigned after the
interaction, and one that already stands earlier in the play are not copied.
_Avoid_: duplicated assertion, moved check

### Spy stubs

**Stub statement**:
An expression statement in story test code whose call is a spy stub method on any receiver, such as
`mocked(save).mockResolvedValue(note);` in a play or a `beforeEach`, on a member that is not computed.
`LzStorybookSpyStub` removes it, as it removes each definition-time stub (the Storybook context's term), leaving the
rest of its chain in place.
_Avoid_: mock statement, stub call

**Outcome mutant**:
The `LzStorybookSpyStubOutcome` mutant that turns a stub statement or definition-time stub of `mockResolvedValue`
into `mockRejectedValue(new Error('Stryker'))` and one of `mockRejectedValue` into `mockResolvedValue(undefined)`,
keeping a `Once` form, so a survivor shows that no check tells success from failure of that call. It has a mutator
name of its own, apart from `LzStorybookSpyStub`, which removes the stub, so a report and `mutator.excludedMutations`
tell the two apart. A `// Stryker disable` comment matches each mutator name exactly, ignoring case only, so it takes
`LzStorybookSpyStub,LzStorybookSpyStubOutcome` or `all` to silence both.
_Avoid_: flip mutant, rejection mutant

### Globals

**Globals site**:
A `globals` object literal that `LzStorybookStoryGlobals` removes one property of per mutant: the `globals` a played
story's own object ends up with (the Storybook context's term), its own or those of a later spread of an object that
sets `globals` and that the file resolves, story or not (a later spread or computed key the file cannot resolve does
not count); the meta's `globals` when the file has a played
story; and
the `globals` in the options of a played story's `.test()` calls, inline or a top-level constant the file leaves
unchanged, unless a later spread in the options sets `globals` (again an unresolved spread or computed key does
not count), and the same holds for the meta's `globals`. A story whose play is an unknown one (see Played story)
counts as played, with or without a play the file reads under it. Every property of a site that is no default
global gets a mutant, even where no test can kill it (ADR 0006), as in these known shapes: the globals of a story
whose unknown play turns out to set no play, with none under it; a value equal to the value below it; a key of the meta's
`globals` that every played story's own `globals` or `.test()` options set; a site that a runtime assignment such as
`S.globals = { ... }` replaces; on a story with no play, a key that the options of every `.test()` call on it set; a
property that a later property of the same key in the same object overrides; and a default global that a getter or
setter in the same object also defines or may define (a computed key).
_Avoid_: globals target, story globals (the meta's are sites too)

**Default global**:
A property of a globals site whose value is Storybook 10.6.5's own initial value for that global: `viewport` as
`'responsive'` or `'100pct-100pct'`, or as an object whose last `value` is such a value or `undefined`, with no spread
or computed key after it, whatever else it holds, as the Vitest addon's `setViewport` reads only `value`;
`backgrounds` with an `undefined` value and `grid: false`; `measureEnabled: false`; `outline: false`. It gets no
mutant only when nothing in the file may set that key below it: no earlier property of the site, spread or computed
key, and no `globals` of the meta or of the story's `.extend()` bases, which Storybook merges key by key, and for a
`.test()` call's options none of the story itself, spread stories included; for the meta's `globals`, none of
another meta in the file. A story or meta the file writes to (such as `meta.globals.outline = true`) may set any
global, below its own site and every site that falls back to it. A default in a story, meta or `.test()` options
constant that another top-level object or meta reads when the file loads (such as `outline:
Primary.globals.outline`), or in a top-level object one of them spreads whole or through a member (`...lib.story`)
that such an object reads, gets its mutant, as removing it changes what that object reads; a spread of the whole
object at the top level (`{ ...Primary }`, `export default meta`) does not count. A story it spreads before its own
`globals` sets nothing below them, as object spread replaces `globals` whole. A `viewport` is no default when a
`parameters` object of any run of its site may set `viewport`: the meta's, the story's and its bases' for every
story the site runs for, and those of each `.test()` call's options that run it, as Storybook merges them over each
other and `setViewport` falls back to `parameters.viewport.defaultViewport` without a global value. `parameters` the
file cannot read (options that are an imported object, or a spread or computed key that may set `parameters` in the
options, the story or the meta, and those of a story or meta the file writes to) and an unmatched `.test()` call count
as ones that may set `viewport`. The meta's
`globals` below a site are read the same way, so a spread or computed key that may replace them may set any global.
The table is fixed and lives in `@layzee/storybook-core`, which proves each default global (the Storybook context's
Proven); a project's own `initialGlobals` and parameters in its preview are not read, so a default value that
overrides them still gets no mutant.
_Avoid_: initial global, preset global

### Waits

**Retrying wait**:
A Testing Library call that retries until it passes or times out: `waitFor(() => ...)`,
`waitForElementToBeRemoved(...)`, or a `findBy` or `findAllBy` query. `LzStorybookWaitFor` makes it check once, or
removes the removal wait.
_Avoid_: async wait, polling
