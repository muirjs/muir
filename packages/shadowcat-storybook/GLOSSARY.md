# Storybook

Stryker plugins for Storybook story files, and three Vite plugins: one rewrites definition-time stubs so they survive
the mock reset, one resets module mock spies before each test, and one lets Storybook's tests run in Stryker's
sandbox. This context covers `@muirjs/shadowcat-storybook`, `@muirjs/pixie-storybook` and
`@muirjs/moira-storybook`: the transformer exists only to rewrite the stubs this package diagnoses, and both read the
same spy stub shape from `@muirjs/moira-storybook`, which holds the code they share.
_Avoid_: `@layzee/storybook-csf` (the shared package's former name)

## Language

### Story files and what Storybook reads from them

**Story file**:
A file one Storybook's main configuration names as holding stories. When that configuration cannot be loaded, a
file whose name matches Storybook's CSF indexer pattern (ending in `stories` or `story`).
_Avoid_: stories file, CSF file (when the narrower set is meant)

**Storybook project**:
What the plugins learn from one Storybook config folder: its story files, its preview's reset settings, the tag
filter, and whether its Vite configuration adds the mock transformer.
_Avoid_: Storybook config, project config

**Static CSF value**:
A value in a story file that Storybook reads from the source without running the file, such as `title`, `id`,
`tags`, `name` or an export name. A mutant there cannot change what Storybook reads. Storybook reads a property of
the meta or a story only when its key is an identifier, so `'tags': ['!test']` sets no static tags, while the story
that runs gets every key as JavaScript reads it, a string-literal one included.
_Avoid_: static annotation, index value

**Story test code**:
The code in a story file that tests a story rather than renders it: `play` functions, `beforeEach` and
`afterEach`, and the bodies of the `.test()` calls Storybook runs: the first call of each string-literal name with
two or more arguments, whose function is the second argument when that is a function or the only one after the
name, else the third.
_Avoid_: play code (too narrow), interaction test

**Tested story**:
A story whose test Storybook's Vitest addon runs, because its tags pass the tag filter and none of them skips it.
_Avoid_: test story, story test

**Played story**:
A tested story in a file with a meta object whose static tags do not end in `!test`, and that runs a play (its own,
one assigned later, one from a story it spreads or its `.extend()` base, or the meta's, which also runs where the
story's play is `undefined` or `null`) or a `.test()` call. When a spread or computed key the file cannot resolve may
set its play last, the play is an unknown play: with no own play, such a spread in any position in the story's own
object gives one, and for a story with no play of its own or from a base, so does one in the meta after the meta's
play, or in any position when the meta has none. An unknown play may have a play the file reads under it (an earlier
own play, the `.extend()` base's or the meta's, including a meta play a meta spread follows), which runs when the
unknown one sets none. The file resolves a spread of an object literal, or of a top-level name bound to one (or a
member of such a name with a key it can read) when the file leaves that name unchanged: it writes to no member of it,
also not through a member it assigns the name to (`A.args = shared; A.args.a = 2`), does not reassign it, and hands
it, or a story it assigns it to, to no code it does not read. It cannot resolve any other spread. Its `.test()`
children are the first `.test()` call of each string-literal name, when Storybook indexes it (two or more arguments);
one with a spread argument is unmatched, and a call with any other first argument, such as `.test(...all)`, is none.
The Storybook mutators and the Storybook test mutators mutate only played stories.
_Avoid_: run story, story with a play

**Proven**:
The proof, made only in `@muirjs/moira-storybook`, that removing one property of an args site (the Storybook mutators'
term) or a globals site (the Storybook test mutators' term) changes nothing in any run of it: a later property or a
spread the file resolves sets its key, its literal equals the value it falls back to, or it is a default global (the
Storybook test mutators' term). What a meta or story the file writes gives proves nothing, and neither does a site
whose story, meta or `.test()` options constant, or a top-level object one of them spreads whole or through a
member (`...lib.story`), another top-level object reads when the file loads, other than through such a spread at the
top level, nor a key that a getter or setter in the same object also defines or may define (a computed key). A file
that may import itself proves nothing, since a write through the import may change any site. A file may import
itself when a relative string literal in it resolves to the file in any letter case; when an import or `require` in
it takes a specifier that is not a string literal, or a path whose last segment names the file (`@/Button.stories`,
`/src/Button.stories.js`, but not the package `Button.stories`); or when it calls `import.meta.glob`. A title or
other non-relative string the file only holds is no import. A file whose path the mutator is not given proves
nothing either. An import through a function `createRequire` made, through a non-relative path passed to a call
other than `import()` or `require()` (`vi.importActual('@/Button.stories')`), or through another file that imports
this one back, is not seen, so such a file still proves. A mutator skips a property as equivalent only through one.
_Avoid_: proof (alone), equivalence check, safe key

**Tag filter**:
The `include`, `exclude` and `skip` tag lists of Storybook's Vitest addon, which pick the tested stories. Without
one, stories tagged `test` are tested.
_Avoid_: test tags

### Interactions and checks

`@muirjs/moira-storybook` reads these once per story file, for the Storybook test mutators on Stryker's tree and for
the `lz-storybook` reporter on its own parse.

**Interaction**:
A call that acts on the rendered story: a user-event method such as `click` or `type`, or a computed key, on a
receiver with a user-event origin; a `fireEvent` call; a composed play; or a raw DOM interaction. A user-event or
`fireEvent` call counts anywhere in the story file, a `render` or a decorator included; a composed play other than
`step(label, Other.play)`, and a raw DOM interaction, count only in story test code.
Its statement, the node the interaction mutators replace, is an expression statement, or the expression body of an
arrow wherever the arrow stands, such as one given to `step(...)` or `forEach` (an arrow body); the same call elsewhere,
such as an argument of another call, is none.
_Avoid_: action (the Playwright mutators' term), user action, site (for its statement; a site is an args or globals
object)

**User-event origin**:
Where the receiver of a user-event method comes from, as far as the story file proves it. A receiver with no origin
is no user-event, and its call is no interaction. There are three values:

- `userEvent14`: user-event 14's `userEvent`. The file proves it with an import of `userEvent` (renamed or
  string-named included) from `storybook/test` or `@testing-library/user-event`, the default import of
  `@testing-library/user-event`, or `<ns>.userEvent` or `<ns>.default` of a namespace import of those. The play
  context's `userEvent` proves it too: `{ userEvent }` destructured from the first parameter of a play, hook or
  `.test()` function of story test code, or read from that parameter as `context.userEvent` or
  `const { userEvent: u } = context`, where nothing in the file writes the parameter and every reference to a named
  context reads one of its members or destructures it in a declaration. A write to its `userEvent`, to a member of
  it or to a member under a computed key, such as `context.userEvent = v`, `[context.userEvent] = [v]`,
  `context.userEvent.click = f` or `context[key] = v`, and any other use, such as `Object.assign(context, ...)` or
  `const c = context`, refuse it.
- `vitestBrowser`: Vitest browser's `userEvent`, imported the same way from `vitest/browser` or
  `@vitest/browser/context`, statically or by `await import(...)`.
- `unproven`: a receiver that may be a user-event, but the file does not prove which one: `{ userEvent }` destructured
  from the parameter of any other function, a play context that the file writes or uses otherwise, `<object>.userEvent`
  or `const { userEvent: u } = <object>` on any other object, any other name `userEvent`, or a choice `a ? b : c`
  between receivers of two different origins, or any receiver of an origin that a member write reaches.

A `<receiver>.setup()` call, awaited or not, has its receiver's origin, as the receiver itself
(`userEvent.setup().click(...)`) or as the one value of a local. A local whose one value is such a call, another
receiver, a choice between receivers of the same origin, or a sequence whose last value is one of these has that
receiver's origin. A member write makes every receiver of the
origin it reaches `unproven`. The write is an assignment, an array or object pattern or a `for...in` or `for...of`
head that targets a member. It reaches the origin of the written member and of each object it is read through,
found as a receiver's is, and a member under a computed key may be `userEvent`. The root of that chain splits
choices, sequences and `=` assignments at every level and reads what is left as a local's one value is read, so
`(flag ? userEvent : x).click = f`, `(a || (flag ? userEvent.setup() : x)).click = f` or `(a = userEvent).click = f`
reaches each origin it may hold. So `userEvent.click`, `t.userEvent.click` on a namespace import, `u.click` after
`const u = userEvent`, `const u = context.userEvent` or `const u = flag ? userEvent : x`, `userEvent.click` after
`const { userEvent } = context`, or the `click` of a `setup()` instance each refuse every user-event 14 receiver in
the file, named imports, namespace imports and the play context's alike. A receiver or a member passed whole to a
call, as in `Object.assign(userEvent, ...)`, `vi.spyOn(userEvent, 'click')` or `Object.assign(context.userEvent, ...)`,
is a read and refuses nothing, and so is a write through a value the origin search does not follow, such as an array
or object literal that holds the receiver, a function parameter, `arguments` in a method or `function` play, a local
that holds the module object (`const t2 = t`, or an awaited `import()`), a local with two values, a local whose value
nests a choice (`const u = a || (flag ? userEvent : x)`), or `(await userEvent).click = f`. `delete userEvent.click`
is no write and refuses nothing either. The Storybook test mutators make mutants for every origin; the `lz-storybook`
reporter gives the `click-before-type` shape only for `userEvent14`.
_Avoid_: user-event kind, user-event 14 check

**Composed play**:
A call that runs another story's play inside this one: `Other.play(context)`, `meta.play?.(context)`, `Other.run()` on a
CSF factory story, or `step(label, Other.play)` and `context.step(label, Other.play)`. The story may come from a
namespace import, as in `Stories.Other.play(context)`. A `.play()` or `.run()` call, or a `.play` given to `step(...)`,
counts when its receiver is an identifier or a member chain that starts at one, computed and optional members included
(`Stories['Other'].play(context)`, `Stories?.Other.play(context)`, `step(label, Stories?.Other.play)`), not a call
result such as `canvas.getByTestId('video').play()`. A `.play()` or `.run()` call counts only inside story test code,
so `video.play()` in a `render` is none.
_Avoid_: nested play, reused play

**Raw DOM interaction**:
A `focus()`, `blur()` or `click()` call with no argument, or a `dispatchEvent(event)` call, on any receiver, inside
story test code; the same call in a `render`, a decorator or a `useEffect` is none.
_Avoid_: native event, DOM action

**Check**:
A call of `expect(...)`, `expect.soft(...)`, `expect.element(...)` or `expect.poll(...)`, with any matcher chain on
it, such as `await expect.element(dialog).toBeVisible()`, or a failing query. `expect['soft'](...)` counts as
`expect.soft(...)`; a computed member whose key is not a string literal, `expect.anything()`, `expect.any(...)`,
`expect.objectContaining(...)`, `expect.assertions(...)` and other `expect` members are none.
_Avoid_: assertion (alone)

**Failing query**:
A call of a `findBy*`, `findAllBy*`, `getBy*` or `getAllBy*` query, on any receiver or none, which fails when it finds
nothing; a `queryBy*` query does not, so it is no check. A failing query is a check that is never negative.
_Avoid_: positive query, query check

**Negative check**:
An `expect` check with `.not` in its member chain, which passes when the interaction before it did nothing.
_Avoid_: absence check, negated assertion

**Following checks**:
The checks after an interaction, up to the next statement that is or holds an interaction. They are looked for past
the end of the interaction's block into the enclosing one and out of a step callback that holds it, never out of any
other function. A statement holds the interactions and checks that run within it: those outside any function, such as
one in an `if`; those in a function called where it stands or given as an argument to a call or `new`, through any
cast or parentheses, such as the callback of `step(...)`, `waitFor(...)`, `forEach(...)` or `then(...)`; and those in
a function the statement calls or gives to a call by a name the file binds to it, directly or through a variable that
holds another name, and so on. A destructured variable counts as the whole value, so it names every method and
function value written in the object literal it comes from. A method call such as `counter.count()` is not followed.
A function that is only defined (a function declaration, or a function kept in a variable or an object) runs nothing
where it stands, and a function held by a property of an argument (such as `waitFor`'s `onTimeout`) is not itself an
argument. What ends the checks is part of them: the next interaction, a `step(...)` in which an interaction runs
outside an `if`, a `switch` case and a `catch`, a statement that may not run the interaction it holds (such as an
`if`, a `waitFor(...)`, a `forEach(...)`, a call given a function, or a `step(...)` whose interactions all stand in an
`if`, a `switch` case or a `catch`), or the end of the function.
_Avoid_: checks after, later checks, assertion window, checks before the next interaction

### Spies, stubs and the mock reset

**Spy stub**:
A call that sets what a spy made with `fn()` from `storybook/test` returns or does: `mockReturnValue`,
`mockResolvedValue`, `mockRejectedValue`, `mockImplementation`, or their `Once` forms, chained on the spy. In a
chain such as `fn().mockResolvedValueOnce(1).mockRejectedValue(error)`, each of these calls is a spy stub of its own.
Read down from a stub, a chain goes on through `mockName` and `mockClear`, which leave what the spy returns alone,
and ends at any other call, so no stub chained on `mockReturnThis` or `mockReset` is read as a spy stub.
_Avoid_: mock setup, stub (alone), mock implementation

**Definition-time stub**:
A spy stub that runs when the story file loads, because it sits outside any function, such as in `args`, in the
meta or at module scope. The mock reset can erase it before the story renders.
_Avoid_: module-level stub, static stub, args stub, stub site (a site is an args or globals site)

**Mock reset**:
What Storybook does to every spy before a story renders: reset, clear or restore it, as the story's
`parameters.test` chooses. Storybook restores by default.
_Avoid_: reset loader, mock cleanup

**Module mock spy**:
A spy that `sb.mock(import(...), { spy: true })` puts in place of a module's export. Storybook keeps every one in
a single registry for the whole test run, apart from the spies a story makes with `fn()`.
_Avoid_: automock, module spy

**Module mock leak**:
A spy stub on a module mock spy that one story sets and a later story still sees, because Storybook's default mock
reset only clears module mock spies. A story that relies on the leak fails when it runs alone, as it does for a
Stryker mutant it alone covers, so Stryker reports that mutant Killed whatever the mutant does.
_Avoid_: stub leak, cross-story leak

**Reset setting**:
One of the `parameters.test` keys `mockReset`, `clearMocks` and `restoreMocks`, as a preview, a meta or a story
sets it; Storybook merges them, and the merged settings pick the story's reset branch.
_Avoid_: test parameter, mock option

**Reset branch**:
Which mock reset a story gets from its merged reset settings: reset, clear, restore, none, or unknown when the
settings cannot be read without running the file.

### Verdicts and findings

**Stub verdict**:
Whether a definition-time stub survives the mock reset: kept, erased, order-dependent (erased only when another
story in the file renders first), or unknown.
_Avoid_: stub status, stub result

**Erased stub**:
A definition-time stub that the mock reset undoes before the story renders, so the story runs with a spy that
returns `undefined` or the original implementation.
_Avoid_: lost stub, reset stub

**Unchecked stub**:
A spy stub at whose line an `LzStorybookSpyStub` mutant, which removes a stub, survived; the `lz-storybook` report
lists it once as a stub finding, because no test fails without the stub. A surviving outcome mutant (the test
mutators' term), which `LzStorybookSpyStubOutcome` makes, makes no unchecked stub: it shows that no check tells
success from failure, not that none reads the stub. A later stub of a chain whose first stub the mock transformer
keeps is erased all the same, so its removal survives and the report lists an unchecked stub on the line of its
`chain-not-rewritten` or `once-not-rewritten` finding; the fix of that finding clears both. The same holds for an
erased stub on a spy call that takes arguments and its `spy-arguments-not-rewritten` finding.
_Avoid_: unobserved stub, surviving stub

**Outcome-unchecked stub**:
A spy stub at whose line a surviving outcome mutant (the test mutators' term) shows that no check tells its success
from its failure, while the `LzStorybookSpyStub` mutant that removes it was killed or timed out, so a play needs the
stub; the `lz-storybook` report lists the line once as an `outcome-unchecked` stub finding. A stub whose own removal
survived is an unchecked stub instead; a line with two stubs can carry one of each.
_Avoid_: unasserted outcome

**Stub finding**:
One entry in the `lz-storybook` report: a spy stub's file and line, its verdict, the reason, and the fix. A finding
read from the story file also names the stub method as written (`mockResolvedValueOnce`); an `unchecked` or
`outcome-unchecked` finding comes from surviving mutants and names none.
_Avoid_: stub warning, diagnostic

**Interaction hint**:
One entry in the `lz-storybook` report for the surviving mutants of the interaction mutators (`LzStorybookInteraction`,
`LzStorybookClickFocus`, `LzStorybookInteractionRepeat` and `LzStorybookInteractionTarget`, the Storybook test
mutators' names) that start on one line and whose interaction has an interaction shape. The reporter reads
`LzStorybookAssertionBefore` survivors the same way, but none has yet been seen at an interaction with a shape. A hint
holds the file and line, the shape, the reason, the fix, and a ready `// Stryker disable next-line` comment for the
line above. The comment names a mutator only when every mutant of it placed on that line survived with that
shape, since one comment disables them all. The reporter finds the interactions with the `@muirjs/moira-storybook`
interaction reader, on its own parse of the story file, and reads each one's kind, user-event origin and following
checks there. A survivor belongs to the innermost interaction whose range holds its start, so a file that a `mutate`
pattern with a line range names gets hints too.
_Avoid_: interaction finding, interaction warning

**Interaction shape**:
Why a play may pass although a surviving interaction mutant changes the interaction. An interaction has at most one
shape:

- `negative-only`: it has following checks, every one of them is negative, and they do not end at a statement that
  may not run the interaction it holds.
- `click-before-type`: a user-event click or hover directly before a `type` of the same target whose user-event
  origin is `userEvent14`, which clicks it first unless given `skipClick`. The reporter takes the click as kept only
  when the options are absent, or an object literal with no spread, computed key or `__proto__` whose `skipClick`,
  quoted or not, is absent or `false`.
- `cleared-later`: a `type` or `clear` whose target the next interaction in its block clears, with no check between
  them.

_Avoid_: skip reason, interaction pattern

**Static story mutant**:
A mutant in a story file that Stryker runs against every test, listed in the `lz-storybook` report with its net
time.
_Avoid_: slow mutant

### Plugins

**Mock transformer**:
The Vite plugin `lz-storybook-mock-transformer` that rewrites each definition-time stub into `fn(implementation)`
form, which survives the mock reset. It rewrites a stub only when it is the first of its chain, not one of the
`Once` forms, and on a spy call that takes no arguments (`fn()`, not `fn(impl)`, as the rewrite would replace them),
and keeps every other call of the chain in place. It moves the stub's arguments into `fn(...)`, so they
run before the arguments of a `mockName` call between them and the spy call. A later call in the chain that sets or
resets the implementation (`mockReset`, `mockRestore`, `mockReturnThis`) then falls back to the stub's value after
the reset, where the story as written gets none. The `lz-storybook` report gives an erased `Once`
stub the verdict `once-not-rewritten`, an erased stub after the first of a chain that is not a `Once` stub the
verdict `chain-not-rewritten`, and an erased first stub on a spy call that takes arguments the verdict
`spy-arguments-not-rewritten`.
_Avoid_: stub rewriter, mock plugin

**Mock reset plugin**:
The Vite plugin `lz-storybook-mock-reset` that resets every module mock spy before each test, in every run of the
Vitest configuration, so a story that relies on a module mock leak fails in every run, not only under Stryker.
_Avoid_: module mock reset plugin, reset plugin

**Sandbox plugin**:
The Vite plugin `lz-storybook-stryker` that lets Storybook's tests run in Stryker's sandbox, where the project's
installed packages sit outside the folders Vite serves by default. It changes nothing outside a Stryker run.
_Avoid_: fs-allow plugin

**Rewritten stub**:
A definition-time stub that the mock transformer has turned into `fn(implementation)` form; its verdict no longer
matters, because the mock reset keeps it.
_Avoid_: repaired stub, fixed stub

**Transformer record**:
The list of story files and stub counts that the mock transformer appends to during a Stryker run, which tells the
reporter whether the transformer really ran.
_Avoid_: record file, rewrite log

**CSF ignorer**:
The `lz-storybook-csf` ignorer, which reports as Ignored the mutants of static CSF values and, in the default play
mode, also those of story test code, MSW handlers and the meta object apart from its `args`, which are story data
(an `args` object written on the meta's first line keeps its own `{}` mutant out, as a story's does).
_Avoid_: story ignorer, Storybook ignorer

**Stub ignorer**:
The `lz-storybook` ignorer, which reports as Ignored the mutants of a spy stub that the mock reset erases, may
erase, or cannot be told to keep. Stryker ignores everything inside an ignored node, and a stub call holds the stubs
before it in its chain, so when one of those is kept the ignorer reports only the stub's own arguments as Ignored.
It does the same when the spy call takes arguments (`fn(impl)`), which the story runs after the mock reset.
Otherwise it ignores the whole stub call, so the arguments of a `mockName` call in the chain are reported as Ignored
under the stub's reason too.
_Avoid_: reset ignorer

**Play mode**:
The `lzStorybookCsf.play` option: `ignore` for a Stryker configuration that mutates app code and leaves story
test code alone, `mutate` for one that mutates story test code.
_Avoid_: test mode, play option
