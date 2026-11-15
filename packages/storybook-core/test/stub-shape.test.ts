import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import {
  chainUpTo,
  definitionTimeStubs,
  mockTransformerRewrite,
  stubMethodOf,
  writtenMethodOf,
} from '../src/stub-shape.ts';
import { renameKey } from './support/parse-module.ts';

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
      'finds a stub on a spy call written with as',
      "import { fn } from 'storybook/test';\n(fn() as any).mockReturnValue(1);",
      [{ spy: 'fn', method: 'mockReturnValue', once: false }],
    ],
    [
      'finds a stub on a spy call written with a non-null assertion',
      "import { fn } from 'storybook/test';\nfn()!.mockReturnValue(1);",
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

  it('gives the positions of the stub call, its spy call, its method and the end of its callee', () => {
    const source =
      "import { fn } from 'storybook/test';\nexport const A = { args: { g: (fn()).mockName('g').mockReturnValue<string>('x', 'y') } };";

    assert.deepEqual(definitionTimeStubs(parseTs(source)), [
      {
        spy: 'fn',
        method: 'mockReturnValue',
        once: false,
        start: source.indexOf('(fn()'),
        end: source.lastIndexOf(')') + 1,
        line: 2,
        spyCall: {
          start: source.indexOf('fn()'),
          end: source.indexOf('fn()') + 'fn()'.length,
        },
        methodStart: source.indexOf('mockReturnValue'),
        calleeEnd: source.indexOf("('x'"),
        firstOfChain: true,
        spyCallHasArguments: false,
      },
    ]);
  });

  it('tells a stub whose spy call takes an implementation, inside parentheses too', () => {
    const stubs = definitionTimeStubs(
      parseTs(
        "import { fn } from 'storybook/test';\nfn(() => 1).mockReturnValue(2);\n(fn<() => number>(impl)).mockName('a').mockResolvedValue(3);\nfn<() => number>().mockReturnValue(4);",
      ),
    );

    assert.deepEqual(
      stubs.map(({ spyCallHasArguments }) => spyCallHasArguments),
      [true, true, false],
    );
  });

  it("gives the end of the callee past the stub call's type arguments under Babel 8's key", () => {
    const source =
      "import { fn } from 'storybook/test';\nfn().mockReturnValue<string>('x');";
    const babel8 = parseTs(source);

    renameKey(babel8, 'typeParameters', 'typeArguments');

    assert.deepEqual(
      definitionTimeStubs(babel8).map(({ calleeEnd }) => calleeEnd),
      definitionTimeStubs(parseTs(source)).map(({ calleeEnd }) => calleeEnd),
    );
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

  it('writes a stub method call back as the spy method name it was read from', () => {
    assert.deepEqual(
      ['mockResolvedValueOnce', 'mockReturnValue']
        .map(stubMethodOf)
        .map((call) =>
          call === undefined ? undefined : writtenMethodOf(call),
        ),
      ['mockResolvedValueOnce', 'mockReturnValue'],
    );
  });
});

describe('chainUpTo', () => {
  it("gives the stubs of a stub's chain from its first up to the stub, leaving out later stubs and other chains", () => {
    const otherChain = { spyCall: { start: 0, end: 4 }, end: 8 };
    const spyCall = { start: 10, end: 14 };
    const first = { spyCall, end: 20 };
    const second = { spyCall, end: 30 };
    const third = { spyCall, end: 40 };

    assert.deepEqual(chainUpTo(second, [third, otherChain, first, second]), [
      first,
      second,
    ]);
  });
});

describe('mockTransformerRewrite', () => {
  const first = { once: false, firstOfChain: true, spyCallHasArguments: false };
  const second = {
    once: false,
    firstOfChain: false,
    spyCallHasArguments: false,
  };

  it('rewrites the first stub of a chain', () => {
    assert.equal(mockTransformerRewrite(first), 'rewritten');
  });

  it('leaves a stub after the first of its chain alone', () => {
    assert.equal(mockTransformerRewrite(second), 'chain-not-rewritten');
  });

  it('leaves a stub after a parenthesised first stub of its chain alone', () => {
    const stubs = definitionTimeStubs(
      parseTs(
        "import { fn } from 'storybook/test';\n(fn().mockReturnValue(1)).mockReturnValue(2);",
      ),
    );

    assert.deepEqual(
      stubs.map((stub) => [stub.end, mockTransformerRewrite(stub)]),
      [
        [81, 'chain-not-rewritten'],
        [61, 'rewritten'],
      ],
    );
  });

  it('leaves a stub after a Once stub and a mockName call alone', () => {
    const stubs = definitionTimeStubs(
      parseTs(
        "import { fn } from 'storybook/test';\nfn().mockName('a').mockReturnValueOnce(1).mockReturnValue(2);",
      ),
    );

    assert.deepEqual(stubs.map(mockTransformerRewrite), [
      'chain-not-rewritten',
      'once-not-rewritten',
    ]);
  });

  it('leaves the first stub of a chain alone when its spy call takes an implementation', () => {
    assert.equal(
      mockTransformerRewrite({ ...first, spyCallHasArguments: true }),
      'implementation-not-rewritten',
    );
  });

  it('leaves a Once stub alone, also as the first of its chain', () => {
    assert.equal(
      mockTransformerRewrite({ ...first, once: true }),
      'once-not-rewritten',
    );
  });
});
