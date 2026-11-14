import { isCall, unwrap } from './csf-nodes.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';

const stubMethods = [
  'mockReturnValue',
  'mockResolvedValue',
  'mockRejectedValue',
  'mockImplementation',
] as const;

export type StubMethod = (typeof stubMethods)[number];

/** The stub method a spy call names, and whether it is the `Once` form. */
export interface StubMethodCall {
  readonly method: StubMethod;
  readonly once: boolean;
}

/** The stub method call of a spy method name; `undefined` for any other name. */
export function stubMethodOf(name: unknown): StubMethodCall | undefined {
  const method = stubMethods.find(
    (candidate) => name === candidate || name === `${candidate}Once`,
  );

  return method === undefined ? undefined : { method, once: name !== method };
}

/** The spy method name of a stub method call, the reverse of `stubMethodOf`. */
export type WrittenStubMethod = StubMethod | `${StubMethod}Once`;

export function writtenMethodOf({
  method,
  once,
}: StubMethodCall): WrittenStubMethod {
  return once ? `${method}Once` : method;
}

export interface StubSite extends StubMethodCall, Span {
  readonly spy: string;
  readonly line: number;
  readonly hasArguments: boolean;
  /** The spy call's span, inside any parentheses, cast or non-null assertion around it. */
  readonly spyCall: Span;
  readonly methodStart: number;
  /** The end of the stub call's callee and of its type arguments: the `(` of its argument list comes next, after the `?.` of an optional call. */
  readonly calleeEnd: number;
}

export interface Span {
  readonly start: number;
  readonly end: number;
}

const functionType = /Function|ObjectMethod|ClassMethod|ClassPrivateMethod/;

export function definitionTimeStubs(program: unknown): readonly StubSite[] {
  return collectStubs(program, storybookTestFnNames(program));
}

function storybookTestFnNames(program: unknown): ReadonlySet<string> {
  return new Set(
    list(field(program, 'body'))
      .filter(
        (statement) => field(statement, 'source', 'value') === 'storybook/test',
      )
      .flatMap((statement) => list(field(statement, 'specifiers')))
      .filter(
        (specifier) =>
          (field(specifier, 'imported', 'name') ??
            field(specifier, 'imported', 'value')) === 'fn',
      )
      .map((specifier) => field(specifier, 'local', 'name'))
      .filter((local) => typeof local === 'string'),
  );
}

function collectStubs(
  node: unknown,
  spies: ReadonlySet<string>,
): readonly StubSite[] {
  const type = field(node, 'type');

  if (!isRecord(node) || typeof type !== 'string' || functionType.test(type)) {
    return [];
  }

  const site = stubSite(node, spies);
  const children: readonly unknown[] = Object.values(node).flatMap(
    (value: unknown) => (Array.isArray(value) ? list(value) : [value]),
  );

  return [
    ...(site ? [site] : []),
    ...children.flatMap((child) => collectStubs(child, spies)),
  ];
}

function stubSite(
  node: unknown,
  spies: ReadonlySet<string>,
): StubSite | undefined {
  const start = field(node, 'start');
  const end = field(node, 'end');
  const line = field(node, 'loc', 'start', 'line');
  const spyCall = chainStart(field(node, 'callee', 'object'));
  const spy = field(spyCall, 'callee', 'name');
  const stub = stubMethodOf(field(node, 'callee', 'property', 'name'));
  const spyCallStart = field(spyCall, 'start');
  const spyCallEnd = field(spyCall, 'end');
  const methodStart = field(node, 'callee', 'property', 'start');
  const calleeEnd =
    field(node, 'typeArguments', 'end') ??
    field(node, 'typeParameters', 'end') ??
    field(node, 'callee', 'end');

  if (
    !isCall(node) ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    typeof line !== 'number' ||
    typeof spyCallStart !== 'number' ||
    typeof spyCallEnd !== 'number' ||
    typeof methodStart !== 'number' ||
    typeof calleeEnd !== 'number' ||
    field(node, 'callee', 'computed') === true ||
    !isCall(spyCall) ||
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
    hasArguments: list(field(node, 'arguments')).length > 0,
    spyCall: { start: spyCallStart, end: spyCallEnd },
    methodStart,
    calleeEnd,
  };
}

/** The stubs of `stub`'s chain from its first up to `stub`: the stubs that share its spy call and end no later. */
export function chainUpTo<TStub extends Pick<StubSite, 'spyCall' | 'end'>>(
  stub: Pick<StubSite, 'spyCall' | 'end'>,
  stubs: readonly TStub[],
): readonly TStub[] {
  return stubs.filter(
    (other) =>
      other.spyCall.start === stub.spyCall.start && other.end <= stub.end,
  );
}

export type StubRewrite =
  | 'rewritten'
  | 'once-not-rewritten'
  | 'chain-not-rewritten';

export function mockTransformerRewrite(
  stub: Pick<StubSite, 'spyCall' | 'end' | 'once'>,
  stubs: readonly Pick<StubSite, 'spyCall' | 'end'>[],
): StubRewrite {
  if (stub.once) {
    return 'once-not-rewritten';
  }

  return chainUpTo(stub, stubs).some((other) => other.end < stub.end)
    ? 'chain-not-rewritten'
    : 'rewritten';
}

/** The spy methods that are not stubs but return the spy and leave what it returns alone, so a stub chain goes on through them. */
const passedThrough: ReadonlySet<unknown> = new Set(['mockName', 'mockClear']);

function chainStart(written: unknown): unknown {
  const node = unwrap(written);
  const name = field(node, 'callee', 'property', 'name');
  const chainsOn =
    isCall(node) &&
    field(node, 'callee', 'computed') !== true &&
    (stubMethodOf(name) !== undefined || passedThrough.has(name));

  return chainsOn ? chainStart(field(node, 'callee', 'object')) : node;
}
