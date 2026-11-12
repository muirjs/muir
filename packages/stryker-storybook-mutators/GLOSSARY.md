# Storybook mutators

Mutators that change story data, the part of a story file that sets up what a story renders, so that a surviving
mutant shows story data that no story test depends on. Story file and story test code are the Storybook context's
terms; install, tier and built-in mutator terms belong to the Mutator install context.

## Language

**Story data**:
What a story file says a story renders with, such as its `args`, rather than its story test code.
_Avoid_: story config, story setup

**LzStorybook mutator**:
One of this package's mutators, named `LzStorybook` plus the story data it changes, such as `LzStorybookArgs`.
_Avoid_: story mutator, Storybook operator

### Args

**Args site**:
An `args` object literal in a story file that `LzStorybookArgs` mutates because a play or test function runs for it:
the `args` a story's own object ends up with (a CSF3 story object, `.story()` or `.extend()`): its own, or those of a
later spread of an object that sets `args` and that the file resolves, story or not (a later spread or computed key
the file cannot resolve does not count), or the `args` in a
`.test(name, options, fn)` options object, written inline or as a top-level constant the call names that the file
leaves unchanged, unless a later
spread in the options sets `args` (here too a spread or computed key the file cannot resolve does not count). An unknown play (see Played story),
with or without a play under it, reads every key, so neither the story's args nor the args of its `.test()` options
give a site. An options object that several stories' `.test()` calls share is one site for all of them: its read
keys are those of every story, and a key gets no per-key mutant as equal to the value below only when it is equal
for each story.
_Avoid_: args target, story args (the meta's `args` are no args site)

**Read key**:
A key of an args site that a function that runs for it, or a `step()` callback in it, reads from its context: as
`args.<key>`, `initialArgs.<key>`, `context.args.<key>`, through a variable that holds one of these, or by
destructuring. Every key is a read key when such a function hands `args` or its context on whole, reads a key that
only running it names, or is one the file cannot read.
_Avoid_: used arg, checked arg

**Per-key mutant**:
An args site with one key that is no read key removed, so the story falls back to the value below it: one that a
`...Base.args` spread (or `...Base?.args`, `...Base['args']`) before the key sets, then the base story's for
`.extend()` or the story's for `.test()` options, then the meta's (in a file with more than one meta, the literal
every meta that sets the key gives) and the project's. A layer's `args` that name a top-level object, and a spread
of such a name or of a member of one, are read as that object when the file leaves it unchanged (see Played story).
A layer that
is no object literal (such as a base's `args` that are an imported object), whose `args` a later spread or computed
key the file cannot resolve (see Played story) may replace (in the story, the `.test()` options, the
meta, or a story that `...Base.args` names), or where such a spread or computed key may set the key last, leaves that
value unknown, and so do a meta or story the file writes to (such as `meta.args.label = 'b'`) and a layer that is
the args site itself, as when the meta and the story spread one object. A key whose literal value (a negative number
and a template literal without expressions count) equals that value gets none, and neither does a key whose removal
leaves only keys like that, as such args behave like ObjectLiteral's `{}`, nor a key that a later property of the
same key or a later spread the file resolves sets, as removing it changes nothing. Each of these holds for the
property, so a later `label: 'c'` after a `label: 'a'` equal to the value below keeps its mutant. A key equal to
the value below keeps its mutant when another top-level object or the meta reads the story or `.test()` options
constant that holds it when the file loads (such as `text: Primary.args.label`, or `...Primary.args` in another
story's args), or reads a top-level object that the story spreads whole or through a member (`...lib.story`), as
removing it changes what that object reads; a spread of the whole story at the top level of another one
(`{ ...Primary }`) runs the same args object, so it does not count. Any other key
keeps its mutant even where no test can kill it (ADR 0006), as in these known shapes: a story whose `args` a runtime
assignment such as `S.args = { ... }` or `S.args.label = 'b'` replaces; a key that a later spread the file cannot
resolve may set; and, on a story with no play, a key that the options of every `.test()` call on it set, as only the
story's own run, which only renders, sees it.
_Avoid_: arg removal

**Coarse mutant**:
An args site with every key that is no read key removed at once, under the same `{}` rule as a per-key mutant.
_Avoid_: story args mutant, StoryArgs
