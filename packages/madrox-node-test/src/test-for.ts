import type { TestContext } from 'node:test';

import { muirModified, type MuirTestModified } from './modified.ts';
import {
  muirRegister,
  type MuirFlags,
  type MuirTestTableReturn,
  type MuirRegister,
} from './register.ts';

/** Registers the tests of a `muirTestFor` table. Without `fn`, each test is a todo test. */
export type MuirTestForFunctionReturn<TArg> = MuirTestTableReturn<
  (arg: TArg, context: TestContext) => void | Promise<void>
>;

export interface MuirTestForFunction {
  <T>(cases: ReadonlyArray<T>): MuirTestForFunctionReturn<T>;
  (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): MuirTestForFunctionReturn<Readonly<Record<string, unknown>>>;
}

type ForCallback = (row: never, t: TestContext) => void | Promise<void>;

/**
 * Registers one node:test `it` test per case of the table, as `muirTestEach` does, except that `fn` always gets the case
 * whole and node:test's test context as its second argument.
 */
export const muirTestFor: MuirTestModified<MuirTestForFunction> = muirModified(
  forCases,
  {},
);

function forCases(
  flags: MuirFlags,
  cases: readonly unknown[],
): MuirRegister<ForCallback> {
  return muirRegister<ForCallback>(flags, cases, (row) => ({
    items: row == null ? [] : Array.isArray(row) ? row : [row],
    run: async (fn, t) => {
      const result: unknown = Reflect.apply(fn, undefined, [row, t]);
      await result;
    },
  }));
}
