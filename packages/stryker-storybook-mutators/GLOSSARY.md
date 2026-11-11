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
An `args` object literal in a story file (one with a CSF meta) that `LzStorybookArgs` mutates: a story's own `args` (a CSF3 story object, `.story()` or
`.extend()`) or the `args` in a `.test(name, options, fn)` options object, when a play or test function runs for it:
the story's own play, the play `.extend()` takes from its base story, the meta's play, or a `.test()` call on the
story. The story must be one Storybook's Vitest transform tests, and its static tags must not end in `!test`.
_Avoid_: args target, story args (the meta's `args` are no args site)

**Read key**:
A key of an args site that a function that runs for it, or a `step()` callback in it, reads from its context: as
`args.<key>`, `initialArgs.<key>`, `context.args.<key>`, through a variable that holds one of these, or by
destructuring. Every key is a read key when such a function hands `args` or its context on whole, reads a key that
only running it names, or is one the file cannot read.
_Avoid_: used arg, checked arg

**Per-key mutant**:
An args site with one key that is no read key removed, so the story falls back to the value below it: one that a
`...Base.args` spread before the key sets, then the base story's for `.extend()` or the story's for `.test()`
options, then the meta's and the project's. A key whose literal value (a negative number and a template literal without expressions
count) equals that value gets none, and neither
does a key whose removal leaves only keys like that, as such args behave like ObjectLiteral's `{}`.
_Avoid_: arg removal

**Coarse mutant**:
An args site with every key that is no read key removed at once, under the same `{}` rule as a per-key mutant.
_Avoid_: story args mutant, StoryArgs
