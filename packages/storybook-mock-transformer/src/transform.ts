import { parse } from '@babel/parser';
import {
  appendRecord,
  chainUpTo,
  definitionTimeStubs,
  type StubMethod,
} from '@layzee/storybook-core';
import MagicString, { type SourceMap } from 'magic-string';

import { packageName } from './package-name.ts';

export interface TransformResult {
  readonly code: string;
  readonly map: SourceMap;
}

/** The parameter that takes the stub's argument, and the implementation the spy call gets from it. */
const replacements: Readonly<
  Record<
    StubMethod,
    { readonly parameter: string; readonly implementation: string }
  >
> = {
  mockReturnValue: { parameter: 'value', implementation: '() => value' },
  mockResolvedValue: {
    parameter: 'value',
    implementation: 'async () => value',
  },
  mockRejectedValue: {
    parameter: 'value',
    implementation: 'async () => { throw value; }',
  },
  mockImplementation: {
    parameter: 'implementation',
    implementation: 'implementation',
  },
};

export function transform(
  code: string,
  id: string,
): TransformResult | undefined {
  const [file = id] = id.split('?');

  if (!/\.[cm]?[jt]sx?$/.test(file) || !code.includes('storybook/test')) {
    return undefined;
  }

  const stubs = definitionTimeStubs(parseModule(code, file));
  const rewritten = stubs.flatMap(({ argumentStart, ...stub }) =>
    chainUpTo(stub, stubs).length === 1 &&
    !stub.once &&
    argumentStart !== undefined
      ? [{ ...stub, argumentStart }]
      : [],
  );

  if (rewritten.length === 0) {
    return undefined;
  }

  const output = new MagicString(code);
  // The stub call becomes `((value) => <its receiver, the spy call given the implementation>).call(undefined, <its argument>)`, so the text between the spy call and the stub method, parentheses and calls such as `.mockName('load')` included, stays where it is.
  rewritten.forEach(
    ({
      spy,
      method,
      start,
      spyCallStart,
      spyCallEnd,
      receiverEnd,
      methodStart,
      argumentStart,
    }) => {
      const { parameter, implementation } = replacements[method];

      output.overwrite(spyCallStart, spyCallEnd, `${spy}(${implementation})`);
      output.overwrite(methodStart, argumentStart, 'call(undefined, ');
      output.appendLeft(start, `((${parameter}) => `);
      output.appendLeft(receiverEnd, ')');
    },
  );
  appendRecord(file, rewritten.length);

  return {
    code: output.toString(),
    map: output.generateMap({ source: file, hires: true }),
  };
}

function parseModule(code: string, file: string): unknown {
  try {
    return parse(code, {
      sourceType: 'module',
      plugins: /\.[cm]?ts$/.test(file) ? ['typescript'] : ['typescript', 'jsx'],
    }).program;
  } catch (error: unknown) {
    throw new Error(
      `${packageName}: cannot parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
