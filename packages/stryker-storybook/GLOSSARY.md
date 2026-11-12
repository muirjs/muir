# Storybook

Stryker plugins for Storybook story files, and three Vite plugins: one rewrites definition-time stubs so they survive
the mock reset, one resets module mock spies before each test, and one lets Storybook's tests run in Stryker's
sandbox. This context covers `@layzee/stryker-storybook`, `@layzee/storybook-mock-transformer` and
`@layzee/storybook-core`: the transformer exists only to rewrite the stubs this package diagnoses, and both read the
same spy stub shape from `@layzee/storybook-core`, which holds the code they share.
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
The proof, made only in `@layzee/storybook-core`, that removing one property of an args site (the Storybook mutators'
term) or a globals site (the Storybook test mutators' term) changes nothing in any run of it: a later property or a
spread the file resolves sets its key, its literal equals the value it falls back to, or it is a default global (the
Storybook test mutators' term). What a meta or story the file writes gives proves nothing, and neither does a site
whose story, meta or `.test()` options constant, or a top-level object one of them spreads whole or through a
member (`...lib.story`), another top-level object reads when the file loads, other than through such a spread at the
top level, nor a key that a getter or setter in the same object also defines or may define (a computed key). A mutator skips a property as
equivalent only through one.
_Avoid_: proof (alone), equivalence check, safe key

**Tag filter**:
The `include`, `exclude` and `skip` tag lists of Storybook's Vitest addon, which pick the tested stories. Without
one, stories tagged `test` are tested.
_Avoid_: test tags

### Spies, stubs and the mock reset

**Spy stub**:
A call that sets what a spy made with `fn()` from `storybook/test` returns or does: `mockReturnValue`,
`mockResolvedValue`, `mockRejectedValue`, `mockImplementation`, or their `Once` forms, chained on the spy. In a
chain such as `fn().mockResolvedValueOnce(1).mockRejectedValue(error)`, each of these calls is a spy stub of its own.
_Avoid_: mock setup, stub (alone), mock implementation

**Definition-time stub**:
A spy stub that runs when the story file loads, because it sits outside any function, such as in `args`, in the
meta or at module scope. The mock reset can erase it before the story renders.
_Avoid_: module-level stub, static stub, args stub

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
`chain-not-rewritten` or `once-not-rewritten` finding; the fix of that finding clears both.
_Avoid_: unobserved stub, surviving stub

**Stub finding**:
One entry in the `lz-storybook` report: a spy stub's file and line, its verdict, the reason, and the fix.
_Avoid_: stub warning, diagnostic

**Interaction hint**:
One entry in the `lz-storybook` report for the surviving mutants of the interaction mutators (`LzStorybookInteraction`,
`LzStorybookClickFocus`, `LzStorybookInteractionRepeat`, `LzStorybookInteractionTarget` and
`LzStorybookAssertionBefore`, the Storybook test mutators' names) that start on one line and whose interaction has an
interaction shape: the file and line, the shape, the reason, the fix, and a ready `// Stryker disable next-line` comment
for the line above. The comment names a mutator only when every mutant of it placed on that line survived with that
shape, since one comment disables them all. The reporter takes the interactions from the `LzStorybookInteraction`
mutants in the report, whatever their status, and gives no hint for a file that a `mutate` pattern with a line range
names, where an interaction outside the range has no such mutant.
_Avoid_: interaction finding, interaction warning

**Interaction shape**:
Why a play may pass although a surviving interaction mutant changes the interaction: `negative-only` (it has following
checks, the Storybook test mutators' term, and every check before the next interaction is negative),
`click-before-type` (a user-event click or hover directly before a `type` of the same target, which clicks it first
unless given `skipClick` or called on Vitest browser's `userEvent`), or `cleared-later` (a `type` or `clear` whose
target the next interaction in its block clears, with no check between them). An interaction has at most one shape.
_Avoid_: skip reason, interaction pattern

**Checks before the next interaction**:
The `expect(...)` checks after an interaction up to the next statement that is an interaction or a `step(...)` that
holds one, looked for past the end of the interaction's block and of a step callback that holds it. Unlike the
following checks, they run past an `if` or a `waitFor(...)` that holds an interaction.
_Avoid_: later checks

**Static story mutant**:
A mutant in a story file that Stryker runs against every test, listed in the `lz-storybook` report with its net
time.
_Avoid_: slow mutant

### Plugins

**Mock transformer**:
The Vite plugin `lz-storybook-mock-transformer` that rewrites each definition-time stub into `fn(implementation)`
form, which survives the mock reset. It rewrites a stub only when it is the first of its chain and not one of the
`Once` forms. The `lz-storybook` report gives an erased `Once` stub the verdict `once-not-rewritten`, and an erased
stub after the first of a chain that is not a `Once` stub the verdict `chain-not-rewritten`.
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
mode, also those of the meta object, story test code and MSW handlers.
_Avoid_: story ignorer, Storybook ignorer

**Stub ignorer**:
The `lz-storybook` ignorer, which reports as Ignored the mutants of a spy stub that the mock reset erases, may
erase, or cannot be told to keep. Stryker ignores everything inside an ignored node, and a stub call holds the stubs
before it in its chain, so when one of those is kept the ignorer reports only the stub's own arguments as Ignored.
_Avoid_: reset ignorer

**Play mode**:
The `lzStorybookCsf.play` option: `ignore` for a Stryker configuration that mutates app code and leaves story
test code alone, `mutate` for one that mutates story test code.
_Avoid_: test mode, play option
