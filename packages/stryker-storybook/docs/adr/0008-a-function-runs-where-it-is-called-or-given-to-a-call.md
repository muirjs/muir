# A function runs where it is called or given to a call

An interaction's following checks, and what ends them, depend on which functions run at a statement. Until now only
a function given to `step(...)` or `waitFor(...)` ran there, and checks counted in any function. Four shapes came out
wrong (D5 to D7 of the SV2 review, all measured; none loses or misplaces a default mutant):

- a `forEach`, `.then` or immediately called callback that clicks, or a statement that calls a clicking function by
  name, did not end an earlier window;
- a `step(...)` that only defined a clicking function, or clicked only under an `if`, ended the window by `step`;
- a check in a function that never runs, such as `const later = () => expect(...)`, counted as a following check,
  could make the reporter's `negative-only` hint, and kept `LzStorybookAssertionBefore` from copying the real check
  after it;
- `await x.then((value) => expect(value)...)` was never copied.

One rule now settles all four in `@layzee/storybook-core`: a function runs where it stands when it is called there or
given to a call as an argument, and a statement also runs each function it calls or gives to a call by a name the
file binds to one. A name holds the functions declared as it, given to it, held by the object literal it holds, or
held by the name it holds. Both what a statement holds (interactions) and what it checks come from that one walk. A
`step(...)` ends the window by `step` only when an interaction runs in it outside an `if`, a `switch` case and a
`catch`; otherwise by `maybe`. A `.then(...)` statement whose callback holds an `expect` check is copied as a
`waitFor(...)` one is. The copy's "name set between" rule follows the same named functions.

## Consequences

- A function given to any call counts as run, so an unknown call given a clicking function now ends the window by
  `maybe`, and the check past it is no longer copied (one `LzStorybookAssertionBefore` case changed to no mutant).
- A function in the options of a call, such as `waitFor`'s `onTimeout`, is not given to the call: its checks run only
  when the wait fails, so they are no following checks.
- Inside a step, a loop or a call given a function counts as running its interaction, as before, so a step whose
  callback clicks in `forEach` still ends the window by `step`.
- A call of an object method (`counter.count()`) is not followed when deciding what a statement holds or checks; it
  is followed only for the copy's "name set between" rule, where following more functions copies less.
- A destructured variable (`const { count } = counter`) counts as holding the whole value, so it names every function
  of that object: more than it holds, never fewer, which ends more windows and copies less.

## Considered Options

- Keep the step and waitFor list and add `forEach`, `then` and the other array methods by name: every new callback
  name would need its own entry, and a function in an unknown call would still count as never run.
- Count a function given to an unknown call as not run: it keeps more copies, but a check past such a call may test
  what the call's function clicked, so the copy could pass for the wrong reason.
