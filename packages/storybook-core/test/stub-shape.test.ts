import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import {
  chainUpTo,
  definitionTimeStubs,
  mockTransformerRewrite,
} from '../src/stub-shape.ts';

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
      'finds a stub after mockName in a chain, under the spy the chain starts at',
      "import { fn } from 'storybook/test';\nfn().mockName('load').mockReturnValue(1);",
      [{ spy: 'fn', method: 'mockReturnValue', once: false }],
    ],
    [
      'finds a stub after mockClear in a chain, under the spy the chain starts at',
      "import { fn } from 'storybook/test';\nfn().mockClear().mockReturnValue(1);",
      [{ spy: 'fn', method: 'mockReturnValue', once: false }],
    ],
    [
      'finds no stub after mockReturnThis in a chain, as mockReturnThis changes what the spy returns',
      "import { fn } from 'storybook/test';\nfn().mockReturnThis().mockReturnValue(1);",
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

  it('gives the positions of the stub call, its spy call, its method and its arguments', () => {
    const source =
      "import { fn } from 'storybook/test';\nexport const A = { args: { g: (fn()).mockName('g').mockReturnValue<string>('x', 'y') } };";

    assert.deepEqual(definitionTimeStubs(parseTs(source)), [
      {
        spy: 'fn',
        method: 'mockReturnValue',
        once: false,
        writtenMethod: 'mockReturnValue',
        start: source.indexOf('(fn()'),
        end: source.lastIndexOf(')') + 1,
        line: 2,
        hasArguments: true,
        spyCall: {
          start: source.indexOf('fn()'),
          end: source.indexOf('fn()') + 'fn()'.length,
        },
        methodStart: source.indexOf('mockReturnValue'),
        calleeEnd: source.indexOf("('x'"),
      },
    ]);
  });

  it('reports a Once stub as once, under the method it stubs, and keeps the method as written', () => {
    const { program } = parse(
      "import { fn } from 'storybook/test';\nfn().mockResolvedValueOnce(1);",
      { sourceType: 'module' },
    );

    assert.deepEqual(
      definitionTimeStubs(program).map(({ method, once, writtenMethod }) => ({
        method,
        once,
        writtenMethod,
      })),
      [
        {
          method: 'mockResolvedValue',
          once: true,
          writtenMethod: 'mockResolvedValueOnce',
        },
      ],
    );
  });
});

describe('chainUpTo', () => {
  it("gives the stubs of a stub's chain from its first up to the stub, leaving out later stubs and other chains", () => {
    const first = { start: 0, end: 10 };
    const second = { start: 0, end: 20 };
    const third = { start: 0, end: 30 };
    const otherChain = { start: 40, end: 50 };

    assert.deepEqual(chainUpTo(second, [third, otherChain, first, second]), [
      first,
      second,
    ]);
  });
});

describe('mockTransformerRewrite', () => {
  const first = { start: 0, end: 10, once: false };
  const second = { start: 0, end: 20, once: false };

  it('rewrites the first stub of a chain', () => {
    assert.equal(mockTransformerRewrite(first, [second, first]), 'rewritten');
  });

  it('leaves a stub after the first of its chain alone', () => {
    assert.equal(
      mockTransformerRewrite(second, [second, first]),
      'chain-not-rewritten',
    );
  });

  it('leaves a Once stub alone, also as the first of its chain', () => {
    assert.equal(
      mockTransformerRewrite({ ...first, once: true }, [second, first]),
      'once-not-rewritten',
    );
  });
});
