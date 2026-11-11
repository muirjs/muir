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
a story's own `args` (a CSF3 story object, `.story()` or `.extend()`), unless a later spread of an object that sets
`args` replaces them or a later spread or computed key the file cannot resolve may, or the `args` in a
`.test(name, options, fn)` options object, written inline or as a top-level constant the call names that the file
leaves unchanged, unless a later
spread or computed key the file cannot resolve in the options may replace them. An unknown play (see Played story),
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
`.extend()` or the story's for `.test()` options, then the meta's and the project's. A layer's `args` that name a
top-level object, and a spread of such a name or of a member of one, are read as that object when the file leaves it
unchanged: it writes to no member of it, does not reassign it, and hands it to no code it does not read. A layer that
is no object literal (such as a base's `args` that are an imported object), whose `args` a later spread or computed
key the file cannot resolve (see Played story) may replace (in the story, the
meta, or a story that `...Base.args` names), or where such a spread or computed key may set the key last, leaves that
value unknown. A key whose literal value (a negative number and a template literal without expressions count) equals
that value gets none, and neither does a key whose removal leaves only keys like that, as such args behave like
ObjectLiteral's `{}`.
_Avoid_: arg removal

**Coarse mutant**:
An args site with every key that is no read key removed at once, under the same `{}` rule as a per-key mutant.
_Avoid_: story args mutant, StoryArgs
