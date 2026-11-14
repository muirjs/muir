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

/** The text around a stub's arguments that makes them the implementation `fn()` takes. The arrow called at once evaluates the arguments once, where the stub stood, so an `await` in them stays outside any function. */
const implementationWrappers: Readonly<
  Record<StubMethod, readonly [open: string, close: string]>
> = {
  mockReturnValue: ['((value) => () => value)(', ')'],
  mockResolvedValue: ['((value) => async () => value)(', ')'],
  mockRejectedValue: ['((value) => async () => { throw value; })(', ')'],
  mockImplementation: ['', ''],
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
  const rewrites = stubs.filter(
    (stub) => mockTransformerRewrite(stub, stubs) === 'rewritten',
  );
  // A stub in another rewritten stub's spy call goes with the text of that spy call.
  const rewritten = rewrites.filter(
    (stub) =>
      !rewrites.some(
        ({ spyCall }) => spyCall.start < stub.start && stub.start < spyCall.end,
      ),
  );

  if (rewritten.length === 0) {
    return undefined;
  }

  const output = new MagicString(code);
  rewritten.forEach((stub) => {
    rewriteStub(output, stub, tokens, file);
  });
  appendRecord(file, rewritten.length);

  return {
    code: output.toString(),
    map: output.generateMap({ source: file, hires: true }),
  };
}

/** Replaces the spy call with `<spy>(<open><arguments><close>)`, its method's wrapper around the stub's arguments (`fn(((value) => () => value)(1))` for `fn().mockReturnValue(1)`), and removes the stub call from the chain, keeping each parenthesis that closes around its callee. */
function rewriteStub(
  output: MagicString,
  { spy, method, end, spyCall, methodStart, calleeEnd }: StubSite,
  tokens: readonly unknown[],
  file: string,
): void {
  const [open, close] = implementationWrappers[method];
  const accessStart = memberAccessStart(tokens, methodStart, file);
  const listStart = argumentListStart(tokens, calleeEnd, file);
  const listEnd = end - ')'.length;
  const closers = parenthesesClosedIn(
    tokens,
    accessStart,
    listStart - '('.length,
  );

  output.overwrite(spyCall.start, spyCall.end, `${spy}(${open}`);
  output.remove(accessStart, listStart);
  output.overwrite(listEnd, end, `${close})${')'.repeat(closers)}`);
  output.move(listStart, end, spyCall.end);
}

/** How many more `)` than `(` the tokens from `start` to `end` hold. */
function parenthesesClosedIn(
  tokens: readonly unknown[],
  start: number,
  end: number,
): number {
  const labels = tokens
    .filter((token) => {
      const tokenStart = field(token, 'start');

      return (
        typeof tokenStart === 'number' &&
        tokenStart >= start &&
        tokenStart < end
      );
    })
    .map(labelOf);

  return (
    labels.filter((label) => label === ')').length -
    labels.filter((label) => label === '(').length
  );
}

function memberAccessStart(
  tokens: readonly unknown[],
  nameStart: number,
  file: string,
): number {
  return positionIn(
    tokens.findLast((token) => {
      const end = field(token, 'end');

      return (
        typeof end === 'number' &&
        end <= nameStart &&
        ['.', '?.'].includes(labelOf(token))
      );
    }),
    'start',
    `no member access before the stub method at ${file}, offset ${nameStart}`,
  );
}

/** Just past the `(` that opens a stub call's argument list. */
function argumentListStart(
  tokens: readonly unknown[],
  calleeEnd: number,
  file: string,
): number {
  return positionIn(
    tokens.find((token) => {
      const start = field(token, 'start');

      return (
        typeof start === 'number' &&
        start >= calleeEnd &&
        labelOf(token) === '('
      );
    }),
    'end',
    `no argument list after the stub method at ${file}, offset ${calleeEnd}`,
  );
}

function labelOf(token: unknown): string {
  const label = field(token, 'type', 'label');

  return typeof label === 'string' ? label : '';
}

function positionIn(
  token: unknown,
  edge: 'start' | 'end',
  missing: string,
): number {
  const position = field(token, edge);

  if (typeof position !== 'number') {
    throw new Error(`${packageName}: ${missing}`);
  }

  return position;
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
