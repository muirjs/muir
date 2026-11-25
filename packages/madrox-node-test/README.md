<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/madrox-node-test

Table tests for `node:test`: `muirTestEach` and `muirTestFor` work like Vitest's `test.each` and `test.for`. It is ESM
only, needs Node.js 22.18 or later, and is tested on Node.js 22 and 24.

## Install

```sh
npm install --save-dev @muirjs/madrox-node-test
```

## Write a table test

Each case of the table becomes one `node:test` test. The name formats the case as Vitest does.

```ts
import assert from 'node:assert/strict';
import { describe } from 'node:test';

import { muirTestEach, muirTestFor } from '@muirjs/madrox-node-test';

describe('add', () => {
  // An array case is spread into the callback's arguments.
  muirTestEach([
    [1, 1, 2],
    [2, 3, 5],
  ])('adds %i and %i to %i', (a, b, sum) => {
    assert.equal(a + b, sum);
  });

  // muirTestFor passes the case whole, and node:test's test context as the second argument.
  muirTestFor([
    { a: 1, b: 1, sum: 2 },
    { a: 2, b: 3, sum: 5 },
  ])('adds $a and $b to $sum', ({ a, b, sum }, t) => {
    t.assert.equal(a + b, sum);
  });
});
```

## Keep test names stable for mutation testing

Table tests work with
[`@muirjs/siryn-node-test`](https://github.com/muirjs/muir/tree/main/packages/siryn-node-test#use-incremental-mode),
including Stryker's incremental mode. Stryker matches a test from one run to the next by its file, its position and its
name, so build names from values that the code under test does not compute.

- Rows of literal values give the same names in every run:

  ```ts
  muirTestEach([
    [30, true],
    [10, false],
  ])('says %d is adult: %s', (age, adult) => {
    assert.equal(isAdult(age), adult);
  });
  ```

- A row that calls the code under test, such as `[30, isAdult(30)]`, puts that code's result in the name. A mutant of
  `isAdult` then renames the test that kills it. The next incremental run cannot match that test, so it runs the mutant
  again, on every run. The results stay correct; only the time grows. Call the code under test in the test function
  instead.

Vitest's `test.each` and `test.for` behave the same way under Stryker's Vitest runner, which also names tests by their
titles.

## Reference

### `muirTestEach(cases)(name, fn?, timeout?)`

Registers one test per case. When every case is an array, a case is spread into `fn`'s arguments; otherwise `fn` gets
the case whole. `fn` gets no test context; use `muirTestFor` for that. Without `fn`, each test is a todo test.

A template literal table, as in Vitest, names its columns in its first line and gives `fn` one object per row. The
types cannot read the columns from the table, so a row is typed `Readonly<Record<string, unknown>>` and each column is
`unknown`. Check or parse a column before using it:

```ts
muirTestEach`
  a    | b    | sum
  ${1} | ${1} | ${2}
  ${2} | ${3} | ${5}
`('adds $a and $b to $sum', ({ a, b, sum }) => {
  assert.ok(typeof a === 'number');
  assert.ok(typeof b === 'number');
  assert.equal(a + b, sum);
});
```

An array of objects, such as `[{ a: 1, b: 1, sum: 2 }]`, types each column.

A last row with fewer values than the table has columns is dropped.

### `muirTestFor(cases)(name, fn?, timeout?)`

Registers one test per case, as `muirTestEach` does, except that `fn` always gets the case whole and the test context
as its second argument.

### Options

Both functions take the options as the second argument instead of a timeout: `(name, options, fn?)`. The options are
`node:test`'s test options (`timeout`, `skip`, `only`, `todo`, and the others), plus `fails`, which makes a test pass
only when its body fails.

### Outcomes that come from `node:test`

The tests run on `node:test`, which decides two outcomes that a Vitest user may not expect:

- A todo test that has a body runs it, and `node:test` ignores its outcome.
- A `fails` test that times out fails. The timeout of `node:test` applies outside the body that `fails` inverts.

### Types

The package exports a type for each value its functions take or return:

| Type                             | Describes                                                              |
| -------------------------------- | ---------------------------------------------------------------------- |
| `MuirTestName`                   | a test's name: a string, or a function, which names it by its own name |
| `MuirTestTableOptions`           | the options, with `fails`                                              |
| `MuirTestEachFunction`           | `muirTestEach`, without its modifiers                                  |
| `MuirTestEachFunctionReturn<T>`  | what `muirTestEach(cases)` returns, for `fn`'s arguments `T`           |
| `MuirTestForFunction`            | `muirTestFor`, without its modifiers                                   |
| `MuirTestForFunctionReturn<T>`   | what `muirTestFor(cases)` returns, for the case type `T`               |
| `MuirTestTableReturn<TCallback>` | the function both tables return, for its callback type `TCallback`     |
| `MuirTestModified<TFunction>`    | the table function `TFunction` with its modifiers, as both values are  |
| `MuirTestEachCallbackArgs<T>`    | `fn`'s arguments for a tuple row `T` of up to 10 values, as in Vitest  |

### Modifiers

Chain modifiers before the table, in any order: `muirTestEach.skip`, `.only`, `.todo` and `.fails` turn their flag on.
`.skipIf(condition)` turns `skip` on when the condition is truthy, and `.runIf(condition)` when it is falsy. As in
Vitest, neither turns off a `skip` chained before it.

```ts
muirTestEach.skipIf(process.platform === 'win32')([['/tmp']])('reads %s', (dir) => {
  // ...
});
```

### Name formats

| Format                                  | Prints                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `%s` `%d` `%i` `%f` `%j` `%o` `%O` `%c` | the next value of the case, as `util.format` prints it |
| `%#`                                    | the index of the case                                  |
| `%$`                                    | the number of the case, starting at 1                  |
| `%%`                                    | a percent sign                                         |
| `$name`, `$a.b`, `$a[0]`                | a property of an object case, by its path              |
