import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { definitionTimeStubs } from '../src/stub-shape.ts';

function parseTs(source: string) {
  return parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy'],
  }).program;
}

function stubsOf(source: string) {
  return definitionTimeStubs(parseTs(source)).map(({ spy, method, once }) => ({
    spy,
    method,
    once,
  }));
}

describe('definitionTimeStubs', () => {
  const rows: readonly (readonly [string, string, readonly unknown[]])[] = [
    [
      'finds a stub whose call is optional',
      "import { fn } from 'storybook/test';\nfn().mockReturnValue?.(1);",
      [{ spy: 'fn', method: 'mockReturnValue', once: false }],
    ],
    [
      'finds a stub whose method is read through optional chaining',
      "import { fn } from 'storybook/test';\nfn()?.mockReturnValue(1);",
      [{ spy: 'fn', method: 'mockReturnValue', once: false }],
    ],
    [
      'finds a stub on an optional call of fn',
      "import { fn } from 'storybook/test';\nfn?.().mockReturnValue(1);",
      [{ spy: 'fn', method: 'mockReturnValue', once: false }],
    ],
    [
      'names the stub method that the call uses',
      "import { fn } from 'storybook/test';\nfn().mockResolvedValue(1);",
      [{ spy: 'fn', method: 'mockResolvedValue', once: false }],
    ],
    [
      'finds each stub of a chain on fn, under the spy the chain starts at',
      "import { fn as spy } from 'storybook/test';\nspy().mockResolvedValueOnce(1).mockRejectedValue(2);",
      [
        { spy: 'spy', method: 'mockRejectedValue', once: false },
        { spy: 'spy', method: 'mockResolvedValue', once: true },
      ],
    ],
    [
      'finds no stub after a mock method that is not a stub in a chain',
      "import { fn } from 'storybook/test';\nfn().mockName('load').mockReturnValue(1);",
      [],
    ],
    [
      'finds no stub in a chain whose first call is a computed member call',
      "import { fn } from 'storybook/test';\nconst mockReturnValue = 'mockName';\nfn()[mockReturnValue]('load').mockReturnValue(1);",
      [],
    ],
    [
      'finds no stub in a call to a mock method that is not a stub',
      "import { fn } from 'storybook/test';\nfn().mockName('load');",
      [],
    ],
    [
      'finds a stub on fn imported by a string name',
      "import { 'fn' as spy } from 'storybook/test';\nspy().mockReturnValue(1);",
      [{ spy: 'spy', method: 'mockReturnValue', once: false }],
    ],
    [
      'finds no stub on an fn imported from another module',
      "import { fn } from './fn';\nfn().mockReturnValue(1);",
      [],
    ],
    [
      'finds no stub on a storybook/test import other than fn',
      "import { spyOn } from 'storybook/test';\nspyOn(console, 'log').mockReturnValue(undefined);",
      [],
    ],
    [
      'finds no stub in a computed member call',
      "import { fn } from 'storybook/test';\nconst mockReturnValue = 'mockName';\nfn()[mockReturnValue]('load');",
      [],
    ],
    [
      'finds no stub when the stub method is called with new',
      "import { fn } from 'storybook/test';\nnew (fn().mockReturnValue)(1);",
      [],
    ],
    [
      'finds no stub on an object that new fn() creates',
      "import { fn } from 'storybook/test';\nnew fn().mockReturnValue(1);",
      [],
    ],
  ];

  rows.forEach(([name, source, expected]) => {
    it(name, () => {
      assert.deepEqual(stubsOf(source), expected);
    });
  });

  it('gives the position of the stub call and of its first argument', () => {
    const source =
      "import { fn } from 'storybook/test';\nexport const A = { args: { g: fn().mockReturnValue('x') } };";

    assert.deepEqual(definitionTimeStubs(parseTs(source)), [
      {
        spy: 'fn',
        method: 'mockReturnValue',
        once: false,
        start: source.indexOf('fn()'),
        end: source.lastIndexOf(')') + 1,
        line: 2,
        argumentStart: source.indexOf("'x'"),
      },
    ]);
  });

  it('reports a Once stub as once, under the method it stubs', () => {
    const { program } = parse(
      "import { fn } from 'storybook/test';\nfn().mockResolvedValueOnce(1);",
      { sourceType: 'module' },
    );

    assert.deepEqual(
      definitionTimeStubs(program).map(({ method, once }) => ({
        method,
        once,
      })),
      [{ method: 'mockResolvedValue', once: true }],
    );
  });
});
