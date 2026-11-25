# One interaction reader in `@muirjs/moira-storybook`

`@muirjs/proteus-storybook-test` and the `lz-storybook` reporter in `@muirjs/shadowcat-storybook` both read
the interactions in story test code: which calls are interactions, which receiver is user-event 14's `userEvent`, and
which checks follow an interaction. Each had a reader of its own, and the two drifted apart. The mutators resolved
names through Babel's scope on Stryker's tree. The reporter scanned names on its own parse without regard to position,
so it missed `var` hoisting and a `let` declared later. They also read different `import()` shapes, ended the checks
after an interaction at different statements, and counted different calls as checks.

Both now read one reader in `@muirjs/moira-storybook`, `interactionsOf(program, shapes)`, which `story-file.ts` calls
once per file for the interaction mutators, and the reporter calls on its own parse. It reads plain nodes of Babel 7 and
Babel 8, resolves names through nested scopes with a scope model written in core, and gives each interaction its
kind, its user-event origin as one value, and its following checks (the Storybook glossary's terms). Core keeps no
run-time Babel dependency. Lars ruled on 2026-11-12 ("1: Approve recommendation") for this recommendation: a new
`@muirjs/moira-storybook` export that the test mutators consume as `story-file.ts` consumes `csfShapes`, with nested
scope reading written in core.

## Considered Options

- Keep Babel's scope in the mutators and give the reporter a reader of its own. That is the drift this decision ends.
- Have each caller pass a scope resolver. The reporter has no `NodePath`, so it would keep its own scan behind the
  shared interface, and core would take a Babel type.
- Export the scope, the tree and the proofs from core, and let each consumer build its own windows and origins. That
  surface is wide and shallow, and each consumer would derive the origin and the window again.
- Two windows in core, the test mutators' following checks and the reporter's checks before the next interaction.
  They differed in one rare shape; the following checks now record what ended them, which is the one fact the second
  window was for.
- The origin as two booleans, "is a user-event" and "is user-event 14". Two booleans can disagree; one value cannot.

## Consequences

- The scope model in core follows JavaScript's binding rules. The migration was checked by running the old and the
  new test mutators over the same story sources and comparing their mutants. A name the file may give another value
  proves nothing: a written play context parameter, a play context whose name the file uses other than to read or
  destructure its members, or a local with more than one value gives a receiver the origin `unproven` or none, so the
  reporter gives no `click-before-type` hint there. A write that targets a member, by assignment, pattern or
  `for...in`/`for...of` head, finds the origin of the written member and of each object it is read through, the way a
  receiver's origin is found; a member under a computed key may be `userEvent`. The root of that chain splits choices,
  sequences and `=` assignments at every level and reads what is left as a local's one value is read, so
  `(flag ? userEvent : x).click = f`, `(a || (flag ? userEvent.setup() : x)).click = f` and
  `(a = userEvent).click = f` reach each origin they may hold. Every receiver of such an origin is `unproven`:
  `u.click = f` after `const u = context.userEvent`, and `t.userEvent.click = f` beside a named `userEvent` import of
  the same module, both refuse. So a write on one user-event 14 object, such as a `setup()` instance, drops every
  user-event 14 hint in the file; the cost is hints only, in the safe direction, and such stories are rare. A receiver
  or a member passed whole to a call, such as `Object.assign(userEvent, ...)`, `vi.spyOn(userEvent, 'click')` or
  `Object.assign(context.userEvent, ...)`, is not seen as a write, nor is a write through a value the origin search
  does not follow, such as an array or object literal that holds the receiver, a function parameter, `arguments` in a
  method or `function` play, a local that holds the module object (`const t2 = t`, or an awaited `import()`), a local
  with two values, a local whose value nests a choice (`const u = a || (flag ? userEvent : x)`), or
  `(await userEvent).click = f`. `delete userEvent.click` is not seen either. Each of these can leave a wrong
  `click-before-type` hint where the method is replaced, never a missing hint and never a mutant; they are rare in
  stories.
- The test mutators make mutants for every origin, `unproven` included, as ADR 0006 asks. Their ADR 0002 stands:
  placement does not change, and the user-event 14 proof is a reading the reporter uses, not a skip.
- The reporter refuses `negative-only` when the following checks end at a statement that may not run its interaction,
  such as an `if`, where it used to read on past it. It loses hints there and gains them where the origin is now
  exact.
- Core computes the copied check, a policy of the test mutators, as it computes their globals sites. The term stays
  in the test mutators' glossary.
- A caller that passes `csfShapes` with no story test code gets no composed plays, no raw DOM interactions and no play
  context origin.
