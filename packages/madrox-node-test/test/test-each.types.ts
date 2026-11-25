// Checked by `npm run typecheck` and never run, as no test file imports it:
// the callbacks get the types of the cases, as in Vitest.
import type { TestContext } from 'node:test';

import { muirTestEach } from '../src/test-each.ts';

type Equal<TActual, TExpected> = 0 extends 1 & TActual
  ? false
  : [TActual, TExpected] extends [TExpected, TActual]
    ? true
    : false;

const tupleRows: readonly [readonly [1, 'a'], readonly [2, 'b']] = [
  [1, 'a'],
  [2, 'b'],
];

muirTestEach(tupleRows)('tuple', (n, s) => {
  n satisfies 1 | 2;
  s satisfies 'a' | 'b';
});
muirTestEach([
  [1, 'a'],
  [2, 'b'],
])('array', (n, s) => {
  n satisfies number;
  // @ts-expect-error The second value is a string.
  s satisfies number;
});
muirTestEach([{ a: 1 }, { a: 2 }])('object', (row) => {
  row.a satisfies number;
  // @ts-expect-error The rows have no b.
  row.b satisfies unknown;
});
muirTestEach([1, 2])('scalar', (n) => {
  n satisfies number;
});
// @ts-expect-error Every argument is a value of the case.
muirTestEach([1, 2])('extra', (_n, _extra: string) => {});
muirTestEach`a | b ${1} | ${2}`('template', (row) => {
  true satisfies Equal<typeof row, Readonly<Record<string, unknown>>>;
  const { a, b } = row;
  // @ts-expect-error A template table's columns are unknown until the test checks them.
  (a - b) satisfies number;
});
abstract class Shape {
  abstract area(): number;
}

muirTestEach([1])(Date, () => {});
muirTestEach([1])(Shape, () => {});
muirTestEach([1])(Math.max, () => {});
// @ts-expect-error A name is a string, a function or a class.
muirTestEach([1])({ name: 'x' }, () => {});
muirTestEach([1])('timeout', () => {}, 100);
muirTestEach([1])(
  'options',
  { timeout: 100, fails: true, skip: 'reason' },
  () => {},
);
muirTestEach([1])('todo');
// @ts-expect-error The options go before the function.
muirTestEach([1])('options last', () => {}, { timeout: 100 });
// @ts-expect-error A test of muirTestEach gets no context.
muirTestEach([1])('context', (_n: number, _t: TestContext) => {});
