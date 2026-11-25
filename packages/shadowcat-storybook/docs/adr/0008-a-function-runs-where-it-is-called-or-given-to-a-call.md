# A function runs where it is called or given to a call

An interaction's following checks, and what ends them, depend on which functions run at a statement. Until now only
a function given to `step(...)` or `waitFor(...)` ran there, and checks counted in any function. Four shapes came out
wrong, all measured; fixing them loses or misplaces no default mutant (the Consequences below name the shapes that
now get none):

- a `forEach`, `.then` or immediately called callback that clicks, or a statement that calls a clicking function by
  name, did not end an earlier window;
- a `step(...)` that only defined a clicking function, or clicked only under an `if`, ended the window by `step`;
- a check in a function that never runs, such as `const later = () => expect(...)`, counted as a following check,
  could make the reporter's `negative-only` hint, and kept `MuirProteusStorybookTestAssertionBefore` from copying the real check
  after it;
- `await x.then((value) => expect(value)...)` was never copied.

One rule now settles all four in `@muirjs/moira-storybook`: a function runs where it stands when it is called there or
given to a call or `new` as an argument, through any cast or parentheses, and a statement also runs each function it
calls or gives to a call by a name the file binds to one. A name runs the functions declared as it, given to it, or
held by the name it holds; a destructured name runs every method and function value written in the object literal it
comes from. Both what a statement holds (interactions) and what it checks come from that one walk. A
`step(...)` ends the window by `step` only when an interaction runs in it outside an `if`, a `switch` case and a
`catch`; otherwise by `maybe`. An awaited `.then(...)` statement whose first argument holds an `expect` check is
copied as a `waitFor(...)` one is. The copy's "name set between" rule follows the same named functions, and also the
functions of the object literal a name holds.

## Consequences

- A function given to any call counts as run, so an unknown call given a clicking function now ends the window by
  `maybe`, and the check past it is no longer copied (one `MuirProteusStorybookTestAssertionBefore` case changed to no mutant).
- A function held by a property of an argument, such as `waitFor`'s `onTimeout`, is not itself an argument, so it does
  not count as run, whether the options object is written inline or held by a name. Its checks run only when the wait
  fails, so they are no following checks.
- Every argument counts, so a function given to `.catch(...)`, or as the second argument of `.then(...)`, counts as
  run although it runs only on a rejection. That ends more windows and copies less.
- A function given to any `new` counts as run too. That is right for `new Promise(executor)`, but
  `new MutationObserver(callback)` runs its callback only later, so the callback's check takes the first `expect`
  place and keeps the real check from being copied (no mutant).
- A statement that calls a function holding the first `expect` check, such as `verify();`, is where the copy is looked
  for. It is never copied, so a check after it is not copied either (no mutant, where one was placed before).
- A `.then(...)` statement that is not awaited is not copied, as its callback may run after the play ends.
- Inside a step, a loop or a call given a function counts as running its interaction, as before, so a step whose
  callback clicks in `forEach` still ends the window by `step`.
- A call of an object method (`counter.count()`) is not followed when deciding what a statement holds or checks; it
  is followed only for the copy's "name set between" rule, where following more functions copies less.
- A destructured variable (`const { count } = counter`) counts as holding the whole value, so it names every method and
  function value written in that object literal, which ends more windows and copies less. A function a property holds
  by name (`{ press }`), or one in a nested literal, is not followed.

## Considered Options

- Keep the step and waitFor list and add `forEach`, `then` and the other array methods by name: every new callback
  name would need its own entry, and a function in an unknown call would still count as never run.
- Count a function given to an unknown call as not run: it keeps more copies, but a check past such a call may test
  what the call's function clicked, so the copy could pass for the wrong reason.
