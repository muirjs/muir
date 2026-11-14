import { parse } from '@babel/parser';
import {
  appendRecord,
  definitionTimeStubs,
  field,
  list,
  mockTransformerRewrite,
  type StubMethod,
  type StubSite,
} from '@layzee/storybook-core';
import MagicString, { type SourceMap } from 'magic-string';

import { packageName } from './package-name.ts';

export interface TransformResult {
  readonly code: string;
  readonly map: SourceMap;
}

const implementationFactories: Readonly<
  Record<StubMethod, string | undefined>
> = {
  mockReturnValue: '(value) => () => value',
  mockResolvedValue: '(value) => async () => value',
  mockRejectedValue: '(value) => async () => { throw value; }',
  mockImplementation: undefined,
};

export function transform(
  code: string,
  id: string,
): TransformResult | undefined {
  const [file = id] = id.split('?');

  if (!/\.[cm]?[jt]sx?$/.test(file) || !code.includes('storybook/test')) {
    return undefined;
  }

  const { program, tokens } = parseModule(code, file);
  const stubs = definitionTimeStubs(program);
  const rewritten = stubs.filter(
    (stub) => mockTransformerRewrite(stub, stubs) === 'rewritten',
  );

  if (rewritten.length === 0) {
    return undefined;
  }

  const output = new MagicString(code);
  rewritten.forEach((stub) => {
    rewriteStub(output, stub, memberAccessStart(tokens, stub.methodStart));
  });
  appendRecord(file, rewritten.length);

  return {
    code: output.toString(),
    map: output.generateMap({ source: file, hires: true }),
  };
}

/** Moves the stub's arguments into the spy call, as `fn(((value) => () => value)(<arguments>))`, and removes the stub call from the chain. */
function rewriteStub(
  output: MagicString,
  { spy, method, end, spyCall, argumentSpan }: StubSite,
  accessStart: number,
): void {
  const factory = implementationFactories[method];
  const [open, close] =
    factory === undefined ? ['', ''] : [`(${factory})(`, ')'];

  if (argumentSpan === undefined) {
    output.overwrite(spyCall.start, spyCall.end, `${spy}(${open}${close})`);
    output.remove(accessStart, end);

    return;
  }

  output.overwrite(spyCall.start, spyCall.end, `${spy}(${open}`);
  output.remove(accessStart, argumentSpan.start);
  output.remove(argumentSpan.end, end);
  output.appendLeft(argumentSpan.end, `${close})`);
  output.move(argumentSpan.start, argumentSpan.end, spyCall.end);
}

function memberAccessStart(
  tokens: readonly unknown[],
  nameStart: number,
): number {
  const start = field(
    tokens.findLast((token) => {
      const end = field(token, 'end');
      const label = field(token, 'type', 'label');

      return (
        typeof end === 'number' &&
        end <= nameStart &&
        (label === '.' || label === '?.')
      );
    }),
    'start',
  );

  if (typeof start !== 'number') {
    throw new Error(
      `${packageName}: no member access before the stub method at ${nameStart}`,
    );
  }

  return start;
}

function parseModule(
  code: string,
  file: string,
): { readonly program: unknown; readonly tokens: readonly unknown[] } {
  try {
    const parsed = parse(code, {
      sourceType: 'module',
      plugins: /\.[cm]?ts$/.test(file) ? ['typescript'] : ['typescript', 'jsx'],
      tokens: true,
    });

    return { program: parsed.program, tokens: list(parsed.tokens) };
  } catch (error: unknown) {
    throw new Error(
      `${packageName}: cannot parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
