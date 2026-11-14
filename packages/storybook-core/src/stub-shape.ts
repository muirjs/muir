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
  readonly writtenMethod: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly argumentSpan: Span | undefined;
  /** Inside any parentheses around it. */
  readonly spyCall: Span;
  readonly methodStart: number;
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
  const writtenMethod = field(node, 'callee', 'property', 'name');
  const stub = stubMethodOf(writtenMethod);
  const spyCallStart = field(spyCall, 'start');
  const spyCallEnd = field(spyCall, 'end');
  const methodStart = field(node, 'callee', 'property', 'start');

  if (
    !isCall(node) ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    typeof line !== 'number' ||
    typeof spyCallStart !== 'number' ||
    typeof spyCallEnd !== 'number' ||
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
  const argumentsEnd = field(list(field(node, 'arguments')).at(-1), 'end');

  return {
    spy,
    ...stub,
    writtenMethod,
    start,
    end,
    line,
    argumentSpan:
      typeof argumentStart === 'number' && typeof argumentsEnd === 'number'
        ? { start: argumentStart, end: argumentsEnd }
        : undefined,
    spyCall: { start: spyCallStart, end: spyCallEnd },
    methodStart,
  };
}

/** The stubs of one chain share its start, and each earlier one ends sooner. */
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
const passedThrough: ReadonlySet<unknown> = new Set(['mockName', 'mockClear']);

function chainStart(node: unknown): unknown {
  const name = field(node, 'callee', 'property', 'name');
  const chainsOn =
    isCall(node) &&
    field(node, 'callee', 'computed') !== true &&
    (stubMethodOf(name) !== undefined || passedThrough.has(name));

  return chainsOn ? chainStart(field(node, 'callee', 'object')) : node;
}
