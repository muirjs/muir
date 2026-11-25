<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/proteus-node-test

[StrykerJS](https://stryker-mutator.io/) mutators for test files that use `node:assert` and `node:test`. The package
is ESM only, needs Node.js 22.18 or later, and is tested on Node.js 22, 24 and 26. It works with any Stryker test
runner. To mutate production code, use [`@muirjs/proteus-node`](../proteus-node/README.md).

## Install

```sh
npm install --save-dev @stryker-mutator/core@~10.1.1 @muirjs/proteus-node-test
```

`@stryker-mutator/core` 10.1 and `@babel/core` 8.0 (Stryker 10's Babel) are peer dependencies. The package installs its
mutators through `@muirjs/moira-mutators`, which puts them into the instrumenter of each copy of Stryker core that may
run the process. It is tested with 10.1.1. The install checks that the instrumenter makes a mutant of each mutator
from a sample, and stops the run with an error if it does not. With a version of `@stryker-mutator/instrumenter`
other than 10.1.1 that passes the check, it logs a warning that mutants may be missing.

Stryker has no plugin kind for mutators, so this package is not a Stryker plugin; see
[`@muirjs/proteus-node`](../proteus-node/README.md) for how the install changes the instrumenter's
list of mutators.

## Mutate test files

To check that your tests' assertions can fail, mutate the test files in a configuration of their own. Call
`muirProteusNodeTestMutators` at the top of it. It removes Stryker's 17 built-in mutators by name and adds the default
mutators below. A mutator that another package installed stays on, and the call warns about each one without a Muir
mark:

```js
import { muirProteusNodeTestMutators } from '@muirjs/proteus-node-test';

await muirProteusNodeTestMutators();

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['test/**/*.test.js'],
  testRunner: 'muir-siryn-node-test',
  appendPlugins: ['@muirjs/siryn-node-test'],
  muirSirynNodeTest: { testFiles: ['test/**/*.test.js'] },
  // ...the rest of your configuration
};
```

The mutated test files are also the files that the test runner runs, so the test that holds a mutant runs it.

Call it in the configuration file, not through `plugins`. Stryker only warns when a module in `plugins` fails to
load, while a failed call stops the run.

The package has no opt-in or experimental mutators, so `muirProteusNodeTestMutators` takes no options. It throws an
error when it gets one; an option left `undefined` counts as absent. Turn a mutator off with
`mutator.excludedMutations`.

`MuirProteusNodeTestCatchAssert` started as experimental and is now a default under the
[mutator process](https://github.com/muirjs/muir/blob/main/docs/mutator-process.md#how-a-measured-mutator-ships). On
three repositories it placed 94 mutants: 80 were killed, 3 timed out, and each of the 11 survivors pointed at a weak
check.

`MuirProteusNodeTestAssertCall` and `MuirProteusNodeTestAssertValidator` find `node:assert` and `node:test` through
an ES module `import`, not a CommonJS `require`, so a CommonJS test file gets no mutant from them.
`MuirProteusNodeTestCatchAssert` finds assertions by name and also counts a `require`d `assert`.

### Default mutators

| Mutator                              | What it changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MuirProteusNodeTestAssertCall`      | Makes an assertion fail. A survivor is a check whose failure nothing sees. A check that never runs comes out as `NoCoverage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `MuirProteusNodeTestAssertValidator` | Makes the code that `assert.throws` or `assert.rejects` checks throw an unrelated error, and so the test function of a node:test test whose `expectFailure` is a matcher, such as `{ expectFailure: /bad id/ }` or the `match` of `{ label, match }`. A string, a boolean, a number or any other expression that is not a RegExp, function, class, object, variable or member is only a label and is left alone. A test made through `it.only` counts; a `skip` or `todo` test, or one whose options spread another object, is left alone, as its mutant would survive whatever the matcher. A survivor is a validator that accepts any error. |
| `MuirProteusNodeTestCatchAssert`     | Empties the `try` block of a `try`/`catch` whose `catch` asserts and throws nothing. A survivor is a test that passes when the code under test stops throwing; `assert.throws`, `assert.rejects` or a plan would catch it. Assertions are found by name, so a `require`d `assert` counts, and functions inside the `catch` are not searched. A `try` block that ends in a `throw` or an `assert.fail(...)` is left alone, as its test already fails when the code stops throwing.                                                                                                                                                              |

An example mutant of each:

| Mutator                              | Original                                                 | Mutated                                                                      |
| ------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `MuirProteusNodeTestAssertCall`      | `assert.equal(total, 3);`                                | `{ assert.equal(total, 3); throw new Error("Stryker: assertion reached"); }` |
| `MuirProteusNodeTestAssertValidator` | `assert.throws(() => parse(''), /empty/)`                | `assert.throws(() => { throw new Error("Stryker"); }, /empty/)`              |
| `MuirProteusNodeTestCatchAssert`     | `try { parse(''); } catch (error) { assert.ok(error); }` | `try {} catch (error) { assert.ok(error); }`                                 |

The mutators' names work in Stryker's disable comments like Stryker's own mutators.
