# Mutator install

The private code that puts a `@layzee` mutator package's mutators into the instrumenter that StrykerJS uses, since
Stryker has no public way to add a mutator or to turn a built-in one off, and that checks the change took effect. It
also holds the mutator code that more than one mutator package uses: the swap engine and the site readers it reads
swap sites with.

## Language

### Installing

**Mutator package**:
A `@layzee` package whose mutators reach Stryker through an install: `@layzee/stryker-jsx-mutators`,
`@layzee/stryker-playwright-mutators`, `@layzee/stryker-storybook-mutators` and
`@layzee/stryker-storybook-test-mutators`.
_Avoid_: mutator plugin

**Install**:
The awaited call at the top of a Stryker config file, such as `lzPlaywrightMutators()`, that puts a mutator
package's mutators into the instrumenter's mutator list. Listing the package in `plugins` or `appendPlugins` is no
install.
_Avoid_: registration, plugin loading, setup

**Mutator list**:
The list of mutators inside the installed `@stryker-mutator/instrumenter` that every mutated file runs through, which
an install changes in memory.
_Avoid_: mutator registry, plugin list

**Layzee mark**:
The mark an install puts on each mutator it adds, naming the mutator package, so that a later install replaces only
its own package's mutators and tells them from anyone else's.
_Avoid_: owner flag

### Choosing mutators

**Tier**:
One of the three groups a mutator package sorts its mutators into: default, opt-in or experimental.
_Avoid_: level, set, category

**Default mutator**:
A mutator that runs on an install without options.
_Avoid_: standard mutator, built-in mutator

**Opt-in mutator**:
A mutator that runs only when the install's options name it, or set `extended: true`.
_Avoid_: extended mutator, optional mutator

**Experimental mutator**:
A mutator that runs only when the install's `experimental` option names it or is `true`; its matching rules or name
can still change.
_Avoid_: beta mutator, unstable mutator

### Swaps

**Same-file swap**:
A mutant that replaces a literal with the nearest distinct value of the same kind before or after it in the same
file, so each swap site gets at most two. The Playwright Locator and MountStory mutators and
`LzStorybookInteractionTarget` make them.
_Avoid_: replacement, substitution

**Swap site**:
A literal that a same-file swap may replace or take a replacement from, together with what tells it apart from
another literal of the same kind, such as a role's name or a mounted story id. A mutator may replace only some of
its sites, as `LzStorybookInteractionTarget` replaces only those in a target query.
_Avoid_: site (alone), target, candidate

**Swap engine**:
The code that makes a same-file swap mutator from a sample and a site reader: it reads every call of a file once and
gives each swap site its nearest distinct values.
_Avoid_: swapper, swap helper

**Site reader**:
A function that reads the swap site of a call, if it has one, such as the role site reader, which reads the `name`
of a query of a string-literal role from a list of query methods and keys it by the role, so those methods share
values.
_Avoid_: site parser, matcher

### Stryker's own mutators

**Built-in mutator**:
One of the 17 mutators that ship with StrykerJS, such as `ConditionalExpression` or `StringLiteral`.
_Avoid_: core mutator, Stryker mutator, default mutator

**Built-in removal**:
Taking the 17 built-in mutators out of the mutator list by name for the whole run, which a mutator package for test
code does.
_Avoid_: disabling built-ins, excluding built-ins

**Unreviewed mutator**:
A mutator in the mutator list that is neither a built-in mutator nor carries a Layzee mark; a built-in removal leaves
it on and warns about it.
_Avoid_: third-party mutator, foreign mutator

### Checks

**Name check**:
The step of an install that stops the run when a mutator's name holds anything but letters, or matches, ignoring
case, another name in its package or one already in the mutator list that its package did not put there.
_Avoid_: name collision check, duplicate check

**Sample**:
The small source that a mutator must turn into at least one mutant during an install, or, for the built-ins, the
source in which each built-in mutator makes one.
_Avoid_: probe, fixture

**Self-check**:
The step of an install that instruments each mutator's sample and stops the run when a mutator makes no mutant of
it.
_Avoid_: smoke test, sanity check

**Tested version**:
The `@stryker-mutator/instrumenter` version a mutator package was tested with; an install warns when it finds
another.
_Avoid_: supported version, pinned version
