import { parse } from '@babel/parser';
import {
  appendRecord,
  definitionTimeStubs,
  field,
  list,
  mockTransformerRewrite,
  type StubMethod,
  type DefinitionTimeStub,
} from '@muirjs/moira-storybook';
import MagicString, { type SourceMap } from 'magic-string';

import { packageName } from './package-name.ts';

export interface TransformResult {
  readonly code: string;
  readonly map: SourceMap;
}

/** The text around a stub's arguments that makes them the implementation `fn()` takes. The arrow called at once evaluates the arguments once, when the spy is made, so an `await` in them stays outside any function. */
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
  const rewritten = definitionTimeStubs(program).filter(
    (stub) => mockTransformerRewrite(stub) === 'rewritten',
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

/** Replaces the spy call with `<spy>(<open><arguments><close>)`, its method's wrapper around the stub's arguments (`fn(((value) => () => value)(1))` for `fn().mockReturnValue(1)`), and removes the stub call from the chain. Each `)` that closed parentheses around the stub's callee is written back after the rewritten spy call, where it closes them again. */
function rewriteStub(
  output: MagicString,
  { spy, method, end, spyCall, methodStart, calleeEnd }: DefinitionTimeStub,
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
        // Stryker disable next-line EqualityOperator: the token at start is the . or ?. of the member access, which counts as no parenthesis
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
        // Stryker disable next-line ConditionalExpression: every Babel token has a number end, so this check only narrows the type, and without it the type check fails
        typeof end === 'number' &&
        end <= nameStart &&
        ['.', '?.'].includes(labelOf(token))
      );
    }),
    'start',
    // Stryker disable next-line StringLiteral: no input reaches this error, as Babel reads a stub method only through a . or ?. token
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
        // Stryker disable next-line ConditionalExpression: every Babel token has a number start, so this check only narrows the type, and without it the type check fails
        typeof start === 'number' &&
        start >= calleeEnd &&
        labelOf(token) === '('
      );
    }),
    'end',
    // Stryker disable next-line StringLiteral: no input reaches this error, as a stub call's argument list always opens with a ( token after its callee
    `no argument list after the stub method at ${file}, offset ${calleeEnd}`,
  );
}

function labelOf(token: unknown): string {
  const label = field(token, 'type', 'label');

  // Stryker disable next-line StringLiteral: only a comment token has no label, and no text it could get here is a . ?. ( or ) the callers look for
  return typeof label === 'string' ? label : '';
}

function positionIn(
  token: unknown,
  edge: 'start' | 'end',
  missing: string,
): number {
  const position = field(token, edge);

  if (typeof position !== 'number') {
    // Stryker disable next-line StringLiteral: no input reaches this throw; see the two token lookups that call it
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
