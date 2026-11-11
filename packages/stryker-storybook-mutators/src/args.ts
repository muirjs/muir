import {
  csfFile,
  storyArgument,
  topLevelBindings,
  unwrap,
  withoutBinding,
} from './csf.ts';
import { isRecord } from './is-record.ts';
import type { LzStorybookMutator } from './mutator.ts';
import { field, list } from './node-field.ts';

/** The keys of `args` a play reads, or `'whole'` when it hands the object on, so that it may read any key. */
type Reads = ReadonlySet<unknown> | 'whole';

type Sites = ReadonlyMap<unknown, ReadonlySet<unknown>>;

const sitesByProgram = new WeakMap<object, Sites>();

const functionTypes: readonly unknown[] = [
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'ObjectMethod',
];

/** The context parameters whose reads of `args` can be followed. */
const contextTypes: readonly unknown[] = ['Identifier', 'ObjectPattern'];

export function argsMutator(): LzStorybookMutator & {
  readonly name: 'LzStorybookArgs';
} {
  return {
    name: 'LzStorybookArgs',
    sample:
      "export const Story = {\n  args: { label: 'a', disabled: true },\n  play: async () => {},\n};\n",
    *mutate(path, t) {
      // Stryker places the mutants of a statement when it leaves it, so the file is read before any statement changes.
      if (path.isProgram()) {
        sitesOf(path.node);
      }

      if (!path.isObjectExpression() || path.node.properties.length < 2) {
        return;
      }

      const program = path.findParent((parent) => parent.isProgram())?.node;
      const read =
        program === undefined ? undefined : sitesOf(program).get(path.node);

      if (read === undefined) {
        return;
      }

      const { properties } = path.node;
      const without = (removed: readonly unknown[]) =>
        t.objectExpression(
          properties
            .filter((kept) => !removed.includes(kept))
            .map((kept) => t.cloneNode(kept, true)),
        );
      const eligible = properties.filter(
        (property) =>
          property.type === 'ObjectProperty' &&
          !property.computed &&
          !read.has(keyName(property)),
      );

      yield* eligible.map((removed) => without([removed]));

      if (eligible.length > 1 && eligible.length < properties.length) {
        yield without(eligible);
      }
    },
  };
}

function sitesOf(program: object): Sites {
  const cached = sitesByProgram.get(program);

  if (cached !== undefined) {
    return cached;
  }

  const sites = argsSites(list(field(program, 'body')));

  sitesByProgram.set(program, sites);

  return sites;
}

/** The `args` objects of stories and `.test()` options that a play or test function runs for, each with the keys those functions read. */
function argsSites(body: readonly unknown[]): Sites {
  const bindings = topLevelBindings(body);
  const { metaObjects, stories } = csfFile(body, bindings);
  const metaPlay = metaObjects
    .map((meta) => propertyValue(meta, 'play'))
    .find((play) => play !== undefined);
  const metaArgs = metaObjects
    .map((meta) => propertyValue(meta, 'args'))
    .find((args) => args !== undefined);

  return new Map(
    stories.flatMap(({ init, local }) => {
      const play = followed(
        ownOrBasePlay(init, bindings) ?? metaPlay,
        bindings,
      );
      const plays = play === undefined ? [] : [play];
      const tests = testCallsOn(body, local).map((call) => ({
        ...call,
        testFunction: followed(call.testFunction, bindings),
      }));

      const storyArgs = propertyValue(storyArgument(unwrap(init)), 'args');

      return [
        site(
          storyArgs,
          [...plays, ...tests.map(({ testFunction }) => testFunction)],
          sameLiteralKeys(storyArgs, metaArgs),
        ),
        ...tests.map(({ options, testFunction }) =>
          site(propertyValue(options, 'args'), [...plays, testFunction]),
        ),
      ].flatMap((found) => (found === undefined ? [] : [found]));
    }),
  );
}

const literalTypes: readonly unknown[] = [
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
];

/** The keys whose literal value in `args` equals the meta's, so that removing one falls back to the same value. */
function sameLiteralKeys(
  args: unknown,
  metaArgs: unknown,
): ReadonlySet<unknown> {
  const metaValues = new Map(
    list(field(metaArgs, 'properties')).map(
      (property) => [keyName(property), field(property, 'value')] as const,
    ),
  );

  return new Set(
    list(field(args, 'properties'))
      .filter((property) => {
        const value = field(property, 'value');
        const metaValue = metaValues.get(keyName(property));

        return (
          field(property, 'computed') !== true &&
          literalTypes.includes(field(value, 'type')) &&
          field(value, 'type') === field(metaValue, 'type') &&
          field(value, 'value') === field(metaValue, 'value')
        );
      })
      .map(keyName),
  );
}

/** A name's top-level value; a name the file does not bind, or any other node, as it is. */
function followed(
  node: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const name = field(node, 'name');

  return (typeof name === 'string' ? bindings.get(name) : undefined) ?? node;
}

/** An `args` object literal with the keys that stay: those the functions that run for it read, and `kept`; when one runs and none reads it whole. */
function site(
  argsObject: unknown,
  readers: readonly unknown[],
  kept: ReadonlySet<unknown> = new Set(),
): readonly [unknown, ReadonlySet<unknown>] | undefined {
  const reads = union([...readers.map(keysRead), kept]);

  return field(argsObject, 'type') !== 'ObjectExpression' ||
    readers.length === 0 ||
    reads === 'whole'
    ? undefined
    : [argsObject, reads];
}

function union(reads: readonly Reads[]): Reads {
  return reads.includes('whole')
    ? 'whole'
    : new Set(reads.flatMap((keys) => (keys === 'whole' ? [] : [...keys])));
}

interface TestCall {
  readonly options: unknown;
  readonly testFunction: unknown;
}

/** The top-level `<story>.test(name, [options,] fn)` calls on a story. */
function testCallsOn(
  body: readonly unknown[],
  local: unknown,
): readonly TestCall[] {
  return body
    .map((statement) => field(statement, 'expression'))
    .filter(
      (call) =>
        field(call, 'type') === 'CallExpression' &&
        field(call, 'callee', 'property', 'name') === 'test' &&
        field(call, 'callee', 'object', 'name') === local,
    )
    .map((call) => {
      const args = list(field(call, 'arguments'));

      return {
        options: args.length > 2 ? args[1] : undefined,
        testFunction: args.at(-1),
      };
    });
}

/** The story's own play, or for `Base.extend({...})` the one it takes from `Base`, as Storybook 10.6.5 `extend()` merges the base story in. */
function ownOrBasePlay(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const call = unwrap(init);
  const own = propertyValue(storyArgument(call), 'play');
  const base = field(call, 'callee', 'object', 'name');

  return own === undefined &&
    field(call, 'callee', 'property', 'name') === 'extend' &&
    typeof base === 'string'
    ? ownOrBasePlay(bindings.get(base), withoutBinding(bindings, base))
    : own;
}

/** The keys of `args` that a play function reads. */
function keysRead(play: unknown): Reads {
  if (!functionTypes.includes(field(play, 'type'))) {
    return 'whole';
  }

  const context = list(field(play, 'params'))[0];

  if (context !== undefined && !contextTypes.includes(field(context, 'type'))) {
    return 'whole';
  }

  const value = propertyValue(context, 'args');
  const binding =
    field(value, 'type') === 'AssignmentPattern' ? field(value, 'left') : value;

  if (field(binding, 'type') === 'ObjectPattern') {
    return patternKeys(binding);
  }

  if (hasRest(context)) {
    return 'whole';
  }

  const parents = new Map(
    childrenIn(field(play, 'body'), undefined).map(
      ({ node, parent }) => [node, parent] as const,
    ),
  );
  const readsOf = (name: unknown): readonly unknown[] =>
    [...parents].flatMap(([node, parent]) =>
      field(node, 'type') === 'Identifier' &&
      typeof name === 'string' &&
      field(node, 'name') === name &&
      !isPropertyName(node, parent)
        ? [node]
        : [],
    );
  if (readsOf('arguments').length > 0) {
    return 'whole';
  }

  const keysAt = (node: unknown): Reads => keysReadAt(node, parents.get(node));
  const reads =
    field(context, 'type') === 'Identifier'
      ? readsOf(field(context, 'name')).map((node): Reads => {
          const member = parents.get(node);

          if (!isMemberOf(member, node)) {
            return 'whole';
          }

          return field(member, 'property', 'name') === 'args'
            ? keysAt(member)
            : new Set();
        })
      : readsOf(field(binding, 'name')).map(keysAt);

  return union(reads);
}

/** `node` names a member or an object key rather than a variable. */
function isPropertyName(node: unknown, parent: unknown): boolean {
  return (
    field(parent, 'computed') !== true &&
    (field(parent, 'property') === node || field(parent, 'key') === node)
  );
}

/** The keys of `args` that one read of it, `node` under `parent`, reads; `'whole'` when it hands the object on. */
function keysReadAt(node: unknown, parent: unknown): Reads {
  if (
    field(parent, 'type') === 'VariableDeclarator' &&
    field(parent, 'init') === node
  ) {
    return patternKeys(field(parent, 'id'));
  }

  return isMemberOf(parent, node)
    ? new Set([field(parent, 'property', 'name')])
    : 'whole';
}

/** `parent` is `node.<name>`. */
function isMemberOf(parent: unknown, node: unknown): boolean {
  return (
    field(parent, 'type') === 'MemberExpression' &&
    field(parent, 'object') === node &&
    field(parent, 'computed') !== true
  );
}

function patternKeys(pattern: unknown): Reads {
  return hasRest(pattern)
    ? 'whole'
    : new Set(
        list(field(pattern, 'properties')).map((property) => keyName(property)),
      );
}

function hasRest(pattern: unknown): boolean {
  return list(field(pattern, 'properties')).some(
    (property) => field(property, 'type') === 'RestElement',
  );
}

interface Child {
  readonly node: unknown;
  readonly parent: unknown;
}

function childrenIn(node: unknown, parent: unknown): readonly Child[] {
  if (Array.isArray(node)) {
    return node.flatMap((item) => childrenIn(item, parent));
  }

  return isRecord(node)
    ? [
        { node, parent },
        ...Object.values(node).flatMap((value) => childrenIn(value, node)),
      ]
    : [];
}

/** The key of `label: ...` or `'label': ...`. */
function keyName(property: unknown): unknown {
  return field(property, 'key', 'name') ?? field(property, 'key', 'value');
}

function propertyValue(object: unknown, key: string): unknown {
  const property = list(field(object, 'properties')).find(
    (candidate) => field(candidate, 'key', 'name') === key,
  );

  return field(property, 'type') === 'ObjectMethod'
    ? property
    : field(property, 'value');
}
