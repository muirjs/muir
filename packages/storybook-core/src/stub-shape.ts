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

export type WrittenStubMethod = StubMethod | `${StubMethod}Once`;

/** The spy method name of a stub method call, the reverse of `stubMethodOf`. */
export function writtenMethodOf({
  method,
  once,
}: StubMethodCall): WrittenStubMethod {
  return once ? `${method}Once` : method;
}

export interface StubSite extends StubMethodCall, Span {
  readonly spy: string;
  /** Where the stub call starts: at the start of its chain, before any parentheses or cast around the spy call. */
  readonly start: number;
  /** Where the stub call ends, after the `)` of its argument list. */
  readonly end: number;
  /** The line the stub call starts on, which is the line its chain starts on, not the line of the stub method. */
  readonly line: number;
  /** The spy call's span, inside any parentheses, cast or non-null assertion around it. */
  readonly spyCall: Span;
  /** Where the stub method's name starts, after the `.` or `?.` that reads it. */
  readonly methodStart: number;
  /** The end of the stub call's callee and of its type arguments. The `(` of its argument list comes next, after any `)` of parentheses around the callee and the `?.` of an optional call that has no type arguments. */
  readonly calleeEnd: number;
  /** Whether no stub stands between the spy call and this stub in its chain. */
  readonly firstOfChain: boolean;
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
  const callsBelow = chainBelow(field(node, 'callee', 'object'));
  const spyCall = callsBelow.at(-1);
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
    spyCall: { start: spyCallStart, end: spyCallEnd },
    methodStart,
    calleeEnd,
    firstOfChain: !callsBelow.some(
      (call) =>
        stubMethodOf(field(call, 'callee', 'property', 'name')) !== undefined,
    ),
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

/** How the mock transformer's rule treats `stub`: rewritten, or left alone as a `Once` stub or a stub after the first of its chain. The transformer then drops a rewritten stub that stands in another rewritten stub's spy call, with that call's arguments. */
export function mockTransformerRewrite(
  stub: Pick<StubSite, 'once' | 'firstOfChain'>,
): StubRewrite {
  if (stub.once) {
    return 'once-not-rewritten';
  }

  return stub.firstOfChain ? 'rewritten' : 'chain-not-rewritten';
}

/** The spy methods that are not stubs but return the spy and leave what it returns alone, so a stub chain goes on through them. */
const passedThrough: ReadonlySet<unknown> = new Set(['mockName', 'mockClear']);

/** The nodes a stub is chained on, read down from it with parentheses and casts unwrapped, nearest first: each stub or passed-through call, then the node that ends the chain, which is the spy call when the chain starts at one. */
function chainBelow(written: unknown): readonly unknown[] {
  const node = unwrap(written);
  const name = field(node, 'callee', 'property', 'name');
  const chainsOn =
    isCall(node) &&
    field(node, 'callee', 'computed') !== true &&
    (stubMethodOf(name) !== undefined || passedThrough.has(name));

  return chainsOn
    ? [node, ...chainBelow(field(node, 'callee', 'object'))]
    : [node];
}
