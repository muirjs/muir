import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirParseArguments,
  type MuirTestTableOptions,
} from '../../src/register.ts';
import { muirTestEach } from '../../src/test-each.ts';
import { signatures } from '../reported.fixtures.ts';

describe('parseArguments', () => {
  const fn = () => {};

  const cases: readonly (readonly [
    string,
    readonly [
      (() => void) | MuirTestTableOptions | undefined,
      (() => void) | number | undefined,
    ],
    unknown,
  ])[] = [
    ['(name, fn)', [fn, undefined], { options: {}, fn }],
    ['(name, fn, timeout)', [fn, 50], { options: { timeout: 50 }, fn }],
    [
      '(name, options, fn)',
      [{ skip: true }, fn],
      { options: { skip: true }, fn },
    ],
    [
      '(name, options, timeout)',
      [{ skip: true }, 50],
      { options: { timeout: 50 } },
    ],
    ['(name)', [undefined, undefined], { options: {} }],
  ];

  muirTestEach(cases)(
    'reads %s',
    (_shape, [optionsOrFn, fnOrTimeout], expected) => {
      assert.deepEqual(muirParseArguments(optionsOrFn, fnOrTimeout), expected);
    },
  );

  muirTestEach([
    { shape: 'options after a function', args: [fn, {}] },
    { shape: 'two functions', args: [fn, fn] },
    { shape: 'null options', args: [null, fn] },
  ])('rejects $shape', ({ args: [optionsOrFn, fnOrTimeout] }) => {
    assert.throws(
      () => muirParseArguments(optionsOrFn, fnOrTimeout),
      signatures,
    );
  });

  it('accepts a null after a function', () => {
    assert.deepEqual(muirParseArguments(fn, null), { options: {}, fn });
  });
});
