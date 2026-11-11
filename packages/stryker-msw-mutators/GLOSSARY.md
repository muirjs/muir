# msw mutators

Mutators that change the responses msw request handlers send, so that a surviving mutant shows a mocked response that
no test outcome depends on. They work in any test code that defines msw handlers, whatever the test runner, and are
not tied to Storybook. Install, tier and built-in mutator terms belong to the Mutator install context.

## Language

**LzMsw mutator**:
One of this package's mutators, named `LzMsw` plus what it changes, such as `LzMswResponse`.
_Avoid_: msw operator, MswResponse mutator
