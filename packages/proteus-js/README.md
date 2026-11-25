<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/proteus-js

Extra [StrykerJS](https://stryker-mutator.io/) mutators for any JavaScript or TypeScript code: statements and literals
that Stryker's own mutators leave alone. It is ESM only, needs Node.js 22.18 or later, and is tested on Node.js 22
and 24. It works with any Stryker test runner. For code that uses Node.js APIs, see
[`@muirjs/proteus-node`](../proteus-node/README.md).

## Install

```sh
npm install --save-dev @stryker-mutator/core@~10.1.1 @muirjs/proteus-js
```

`@stryker-mutator/core` 10.1 and `@babel/core` 8.0 (Stryker 10's Babel) are peer dependencies. The package installs its
mutators through `@muirjs/moira-mutators`, which adds them to the instrumenter of each copy of Stryker core that may
run the process. It is tested with 10.1.1. The install checks that the instrumenter makes a mutant of each added
mutator from a sample, and stops the run with an error if it does not.

Stryker has no plugin kind for mutators, so this package is not a Stryker plugin. It changes the instrumenter's list of
mutators the way `@muirjs/proteus-node` does; its README explains the files involved and the warnings.

## Mutate production code

Call `muirProteusJsMutators` at the top of your Stryker configuration file, an ES module such as `stryker.config.mjs`. No
mutator runs by default yet: `MuirProteusJsNumericLiteral` is opt-in and `MuirProteusJsAssignmentStatement` is experimental. This call
turns on both:

```js
import { muirProteusJsMutators } from '@muirjs/proteus-js';

await muirProteusJsMutators({ MuirProteusJsNumericLiteral: true, experimental: { MuirProteusJsAssignmentStatement: true } });

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.js'],
  // ...the rest of your configuration
};
```

This call turns on every opt-in and every experimental mutator:

```js
await muirProteusJsMutators({ extended: true, experimental: true });
```

- An opt-in mutator works as described but makes many mutants or many equivalent ones in typical code. Turn one on by
  its name, or all of them with `extended`.
- An experimental mutator has been measured on too few projects to run by default, and may change or go in a minor
  release. Turn one on by its name inside `experimental`, or all of them with `experimental: true`.

Each option takes only `true`; an option left `undefined` counts as absent. The call throws on a name it does not know, on another value than `true`, and
on a name in the wrong place; the message says where the name belongs. Call it in the configuration file, not through
`plugins`: Stryker only warns when a module in `plugins` fails to load, while a failed call stops the run.

### Opt-in mutators

| Mutator                       | What it changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MuirProteusJsNumericLiteral` | Moves an integer literal by 1 each way, including 0 and 1, as an off-by-one in a limit, an index or a count does. Stryker has no numeric mutator. A survivor is a constant that no test pins; a tuning value, such as a poll interval, gives survivors that need a disable comment with a reason. It leaves fractions, BigInts, octal literals such as the file mode `0o600`, types, enum members, property keys, every number inside the arguments of the nearest call named `kill`, such as `process.kill(pid, 0)`, `process.kill(base + 1)` or `process['kill'](pid)`, and the `uid` and `gid` values of an options object, such as `spawn(cmd, args, { uid: 1000 })`, alone, as a mutant there would signal a real process or run one as another user; a signal or process id held in a variable, as in `const probe = 0; process.kill(pid, probe)`, is still mutated, so give its declaration a disable comment. It also leaves the indentation of `JSON.stringify(value, null, 2)` alone, as it changes only whitespace; an indentation held in a variable or written as an expression is still mutated. |

### Experimental mutators

| Mutator                            | What it changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MuirProteusJsAssignmentStatement` | Removes an assignment statement with `=`, such as `x = y;`, `obj.k = v;` or `arr[i] = v;`. Stryker's `AssignmentOperator` mutates only compound assignments such as `+=`. A survivor is a state write that no test observes. It leaves declarations, compound assignments, `i++;`, `delete` and assignments to `process.env` or its members alone; without that, a test that points `HOME` at a temporary folder would act on the real one. An assignment through an alias, such as `env.HOME = dir;` after `const env = process.env;`, is still removed. |

An example mutant of each, in the form of Stryker's
[Supported mutators](https://stryker-mutator.io/docs/mutation-testing-elements/supported-mutators/) page:

| Mutator                            | Original            | Mutated                                  |
| ---------------------------------- | ------------------- | ---------------------------------------- |
| `MuirProteusJsAssignmentStatement` | `latest = id;`      | `;`                                      |
| `MuirProteusJsNumericLiteral`      | `rows.slice(0, 40)` | `rows.slice(0, 41)`, `rows.slice(0, 39)` |

### Why a mutator is opt-in or experimental

A mutator moves to the default tier when it has been measured on at least two open-source repositories with at least
10 sites between them, more than half of its triaged survivors point at a missing or weak check, and none of its
kills needs a timeout. A run whose survivors are mostly equivalent sends it back for rework or removal. The
[mutator process](https://github.com/muirjs/muir/blob/main/docs/mutator-process.md#how-a-measured-mutator-ships) has
the details.

| Mutator                            | Why                                                                                                                                                         | What would move it                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `MuirProteusJsNumericLiteral`      | Opt-in: it makes a mutant at almost every integer, and 28 of 64 survivors on two repositories pointed at a weak check; tuning values need disable comments. | More than half of its survivors pointing at a weak check, which needs a rule that leaves out the equivalent ones. |
| `MuirProteusJsAssignmentStatement` | Experimental: 8 of 8 survivors on one repository pointed at a weak check, but 39 of 136 on a second.                                                        | More than half of its survivors pointing at a weak check on two repositories.                                     |

## Turn a mutator off

The mutators' names work in Stryker's disable comments like Stryker's own mutators:

```js
// Stryker disable next-line MuirProteusJsNumericLiteral: the interval only spaces out polls
const pollMs = 100;
```

Both mutators step back where another mutant exists, so they add no mutant on a node that another mutator mutates.
`MuirProteusJsAssignmentStatement`, like Stryker's `CallExpression` removal of a call statement, removes a statement only when
no other mutant shares it: `x = true;` keeps its `BooleanLiteral` mutant and gets no removal, while `x = f(a);` gets
one. `MuirProteusJsNumericLiteral` drops its mutants of a literal that another mutator also mutates, so a mutator of a site,
such as `MuirProteusNodeTimerDelay`'s delay of `setTimeout(f, 10)` or `MuirProteusNodeExitCode`'s `process.exitCode = 1`, takes
precedence. An assigned number keeps the two `MuirProteusJsNumericLiteral` mutants, so `x = 1;` gets those and no removal.
A mutant of a nearby node can still behave the same: `x > 2` moved to `x > 1` acts like Stryker's `x >= 2` for
integers, and without the Node.js mutators `setTimeout(f, 0)` gets delays of 1 and -1, which Node.js runs like 0.

A disable comment that names only the other mutator ignores its mutants and brings this package's mutants back as new
mutants. Name both mutators when no test can kill either.
