import {
  muirMoiraStorybookIsCall,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import { muirMoiraStorybookIsRecord } from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';

const stubMethods = [
  'mockReturnValue',
  'mockResolvedValue',
  'mockRejectedValue',
  'mockImplementation',
] as const;

export type MuirMoiraStorybookStubMethod = (typeof stubMethods)[number];

/** The stub method a spy call names, and whether it is the `Once` form. */
export interface MuirMoiraStorybookStubMethodCall {
  readonly method: MuirMoiraStorybookStubMethod;
  readonly once: boolean;
}

/** The stub method call of a spy method name; `undefined` for any other name. */
export function muirMoiraStorybookStubMethodOf(
  name: unknown,
): MuirMoiraStorybookStubMethodCall | undefined {
  const method = stubMethods.find(
    (candidate) => name === candidate || name === `${candidate}Once`,
  );

  return method === undefined ? undefined : { method, once: name !== method };
}

export type MuirMoiraStorybookWrittenStubMethod =
  | MuirMoiraStorybookStubMethod
  | `${MuirMoiraStorybookStubMethod}Once`;

/** The spy method name of a stub method call, the reverse of `stubMethodOf`. */
export function muirMoiraStorybookWrittenMethodOf({
  method,
  once,
}: MuirMoiraStorybookStubMethodCall): MuirMoiraStorybookWrittenStubMethod {
  return once ? `${method}Once` : method;
}

export interface MuirMoiraStorybookDefinitionTimeStub
  extends MuirMoiraStorybookStubMethodCall,
    MuirMoiraStorybookSpan {
  readonly spy: string;
  /** Where the stub call starts: at the start of its chain, before any parentheses or cast around the spy call. */
  readonly start: number;
  /** Where the stub call ends, after the `)` of its argument list. */
  readonly end: number;
  /** The line the stub call starts on, which is the line its chain starts on, not the line of the stub method. */
  readonly line: number;
  /** The spy call's span, inside any parentheses, cast or non-null assertion around it. */
  readonly spyCall: MuirMoiraStorybookSpan;
  /** Where the stub method's name starts, after the `.` or `?.` that reads it. */
  readonly methodStart: number;
  /** The end of the stub call's callee and of its type arguments. The `(` of its argument list comes next, after any `)` of parentheses around the callee and the `?.` of an optional call that has no type arguments. */
  readonly calleeEnd: number;
  /** Whether no stub stands between the spy call and this stub in its chain. */
  readonly firstOfChain: boolean;
  /** Whether the spy call takes arguments, an implementation for `fn(impl)`. */
  readonly spyCallHasArguments: boolean;
}

export interface MuirMoiraStorybookSpan {
  readonly start: number;
  readonly end: number;
}

const functionType = /Function|ObjectMethod|ClassMethod|ClassPrivateMethod/;

export function muirMoiraStorybookDefinitionTimeStubs(
  program: unknown,
): readonly MuirMoiraStorybookDefinitionTimeStub[] {
  return collectStubs(program, storybookTestFnNames(program));
}

function storybookTestFnNames(program: unknown): ReadonlySet<string> {
  return new Set(
    muirMoiraStorybookList(muirMoiraStorybookField(program, 'body'))
      .filter(
        (statement) =>
          muirMoiraStorybookField(statement, 'source', 'value') ===
          'storybook/test',
      )
      .flatMap((statement) =>
        muirMoiraStorybookList(
          muirMoiraStorybookField(statement, 'specifiers'),
        ),
      )
      .filter(
        (specifier) =>
          (muirMoiraStorybookField(specifier, 'imported', 'name') ??
            muirMoiraStorybookField(specifier, 'imported', 'value')) === 'fn',
      )
      .map((specifier) => muirMoiraStorybookField(specifier, 'local', 'name'))
      .filter((local) => typeof local === 'string'),
  );
}

function collectStubs(
  node: unknown,
  spies: ReadonlySet<string>,
): readonly MuirMoiraStorybookDefinitionTimeStub[] {
  const type = muirMoiraStorybookField(node, 'type');

  if (
    !muirMoiraStorybookIsRecord(node) ||
    typeof type !== 'string' ||
    functionType.test(type)
  ) {
    return [];
  }

  const stub = definitionTimeStubAt(node, spies);
  const children: readonly unknown[] = Object.values(node).flatMap(
    (value: unknown) =>
      Array.isArray(value) ? muirMoiraStorybookList(value) : [value],
  );

  return [
    ...(stub ? [stub] : []),
    ...children.flatMap((child) => collectStubs(child, spies)),
  ];
}

function definitionTimeStubAt(
  node: unknown,
  spies: ReadonlySet<string>,
): MuirMoiraStorybookDefinitionTimeStub | undefined {
  const start = muirMoiraStorybookField(node, 'start');
  const end = muirMoiraStorybookField(node, 'end');
  const line = muirMoiraStorybookField(node, 'loc', 'start', 'line');
  const callsBelow = chainBelow(
    muirMoiraStorybookField(node, 'callee', 'object'),
  );
  const spyCall = callsBelow.at(-1);
  const spy = muirMoiraStorybookField(spyCall, 'callee', 'name');
  const stub = muirMoiraStorybookStubMethodOf(
    muirMoiraStorybookField(node, 'callee', 'property', 'name'),
  );
  const spyCallStart = muirMoiraStorybookField(spyCall, 'start');
  const spyCallEnd = muirMoiraStorybookField(spyCall, 'end');
  const methodStart = muirMoiraStorybookField(
    node,
    'callee',
    'property',
    'start',
  );
  const calleeEnd =
    muirMoiraStorybookField(node, 'typeArguments', 'end') ??
    muirMoiraStorybookField(node, 'typeParameters', 'end') ??
    muirMoiraStorybookField(node, 'callee', 'end');

  if (
    !muirMoiraStorybookIsCall(node) ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    typeof line !== 'number' ||
    typeof spyCallStart !== 'number' ||
    typeof spyCallEnd !== 'number' ||
    typeof methodStart !== 'number' ||
    typeof calleeEnd !== 'number' ||
    muirMoiraStorybookField(node, 'callee', 'computed') === true ||
    !muirMoiraStorybookIsCall(spyCall) ||
    typeof spy !== 'string' ||
    !spies.has(spy) ||
    stub === undefined
  ) {
    return undefined;
  }

  return {
    spy,
    ...stub,
    start,
    end,
    line,
    spyCall: { start: spyCallStart, end: spyCallEnd },
    methodStart,
    calleeEnd,
    firstOfChain: !callsBelow.some(
      (call) =>
        muirMoiraStorybookStubMethodOf(
          muirMoiraStorybookField(call, 'callee', 'property', 'name'),
        ) !== undefined,
    ),
    spyCallHasArguments:
      muirMoiraStorybookList(muirMoiraStorybookField(spyCall, 'arguments'))
        .length > 0,
  };
}

/** The stubs of `stub`'s chain from its first up to `stub`: the stubs that share its spy call and end no later. */
export function muirMoiraStorybookChainUpTo<
  TStub extends Pick<MuirMoiraStorybookDefinitionTimeStub, 'spyCall' | 'end'>,
>(
  stub: Pick<MuirMoiraStorybookDefinitionTimeStub, 'spyCall' | 'end'>,
  stubs: readonly TStub[],
): readonly TStub[] {
  return stubs.filter(
    (other) =>
      other.spyCall.start === stub.spyCall.start && other.end <= stub.end,
  );
}

export type MuirMoiraStorybookStubRewrite =
  | 'rewritten'
  | 'once-not-rewritten'
  | 'chain-not-rewritten'
  | 'spy-arguments-not-rewritten';

/** How the mock transformer's rule treats `stub`: rewritten, or left alone as a `Once` stub, a stub after the first of its chain, or a stub whose spy call takes arguments, which the rewrite would replace. */
export function muirMoiraStorybookMockTransformerRewrite(
  stub: Pick<
    MuirMoiraStorybookDefinitionTimeStub,
    'once' | 'firstOfChain' | 'spyCallHasArguments'
  >,
): MuirMoiraStorybookStubRewrite {
  if (stub.once) {
    return 'once-not-rewritten';
  }

  if (!stub.firstOfChain) {
    return 'chain-not-rewritten';
  }

  return stub.spyCallHasArguments ? 'spy-arguments-not-rewritten' : 'rewritten';
}

/** The spy methods that are not stubs but return the spy and leave what it returns alone, so a stub chain goes on through them. */
const passedThrough: ReadonlySet<unknown> = new Set(['mockName', 'mockClear']);

/** The nodes a stub is chained on, read down from it with parentheses and casts unwrapped, nearest first: each stub or passed-through call, then the node that ends the chain, which is the spy call when the chain starts at one. */
function chainBelow(written: unknown): readonly unknown[] {
  const node = muirMoiraStorybookUnwrap(written);
  const name = muirMoiraStorybookField(node, 'callee', 'property', 'name');
  const chainsOn =
    muirMoiraStorybookIsCall(node) &&
    muirMoiraStorybookField(node, 'callee', 'computed') !== true &&
    (muirMoiraStorybookStubMethodOf(name) !== undefined ||
      passedThrough.has(name));

  return chainsOn
    ? [node, ...chainBelow(muirMoiraStorybookField(node, 'callee', 'object'))]
    : [node];
}
