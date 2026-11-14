import { isCall } from './csf-nodes.ts';
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

export interface StubSite extends StubMethodCall {
  readonly spy: string;
  /** The stub method as the story writes it, such as `mockResolvedValueOnce` where `method` is `mockResolvedValue`. */
  readonly writtenMethod: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly argumentStart: number | undefined;
  /** The start of the spy call the chain starts at, such as `fn()`, inside any parentheses around it. */
  readonly spyCallStart: number;
  readonly spyCallEnd: number;
  /** The end of the call the stub method is called on, inside any parentheses around it; past `spyCallEnd` when calls such as `.mockName('load')` stand between. */
  readonly receiverEnd: number;
  /** The start of the stub method's name, after the dot before it. */
  readonly methodStart: number;
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
  const writtenMethod = field(node, 'callee', 'property', 'name');
  const stub = stubMethodOf(writtenMethod);
  const spyCallStart = field(spyCall, 'start');
  const spyCallEnd = field(spyCall, 'end');
  const receiverEnd = field(node, 'callee', 'object', 'end');
  const methodStart = field(node, 'callee', 'property', 'start');

  if (
    !isCall(node) ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    typeof line !== 'number' ||
    typeof spyCallStart !== 'number' ||
    typeof spyCallEnd !== 'number' ||
    typeof receiverEnd !== 'number' ||
    typeof methodStart !== 'number' ||
    field(node, 'callee', 'computed') === true ||
    !isCall(spyCall) ||
    typeof spy !== 'string' ||
    !spies.has(spy) ||
    typeof writtenMethod !== 'string' ||
    stub === undefined
  ) {
    return undefined;
  }

  const argumentStart = field(node, 'arguments', '0', 'start');

  return {
    spy,
    ...stub,
    writtenMethod,
    start,
    end,
    line,
    argumentStart:
      typeof argumentStart === 'number' ? argumentStart : undefined,
    spyCallStart,
    spyCallEnd,
    receiverEnd,
    methodStart,
  };
}

/** The stubs of `stub`'s chain from its first up to `stub` itself: they start where the chain starts, and each earlier one ends sooner. */
export function chainUpTo<TStub extends Pick<StubSite, 'start' | 'end'>>(
  stub: Pick<StubSite, 'start' | 'end'>,
  stubs: readonly TStub[],
): readonly TStub[] {
  return stubs.filter(
    (other) => other.start === stub.start && other.end <= stub.end,
  );
}

export type StubRewrite =
  | 'rewritten'
  | 'once-not-rewritten'
  | 'chain-not-rewritten';

/** Whether the mock transformer rewrites `stub`: only the first stub of its chain, and only when it is not a `Once` stub. */
export function mockTransformerRewrite(
  stub: Pick<StubSite, 'start' | 'end' | 'once'>,
  stubs: readonly Pick<StubSite, 'start' | 'end'>[],
): StubRewrite {
  if (stub.once) {
    return 'once-not-rewritten';
  }

  return chainUpTo(stub, stubs).length === 1
    ? 'rewritten'
    : 'chain-not-rewritten';
}

/** The spy methods that are no stub but return the spy and leave what it returns alone, so a stub chain goes on through them. */
const passedThrough: readonly unknown[] = ['mockName', 'mockClear'];

/** The call a chain of stub calls starts from, such as `fn()` in `fn().mockName('load').mockResolvedValueOnce(1)`. */
function chainStart(node: unknown): unknown {
  const name = field(node, 'callee', 'property', 'name');
  const chainsOn =
    isCall(node) &&
    field(node, 'callee', 'computed') !== true &&
    (stubMethodOf(name) !== undefined || passedThrough.includes(name));

  return chainsOn ? chainStart(field(node, 'callee', 'object')) : node;
}
