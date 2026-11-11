import type { NodePath } from '@babel/core';
import {
  csfFile,
  field,
  list,
  storyArgument,
  topLevelBindings,
  unwrap,
  withoutBinding,
} from '@layzee/storybook-csf';

import type { LzStorybookMutator } from './mutator.ts';

type Key = string | number;

/** The keys of `args` a play reads, or `'whole'` when it hands the object on, so that it may read any key. */
type Reads = ReadonlySet<Key> | 'whole';

type Sites = ReadonlyMap<unknown, ReadonlySet<Key>>;

/** What a read evaluates to: the `args` object, or the story context that holds it. */
type Read = 'args' | 'context';

const sitesByProgram = new WeakMap<object, Sites>();

/** The keys of the story context that hold the args: Storybook 10.6.5 passes `args` and `initialArgs`. */
const argsKeys: readonly Key[] = ['args', 'initialArgs'];

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
        sitesOf(path);
      }

      if (!path.isObjectExpression() || path.node.properties.length < 2) {
        return;
      }

      const program = path.findParent((parent) => parent.isProgram());
      const read =
        program === null ? undefined : sitesOf(program).get(path.node);

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
      const eligible = properties.filter((property) => {
        const key = keyName(property);

        return (
          property.type === 'ObjectProperty' &&
          !property.computed &&
          key !== undefined &&
          !read.has(key)
        );
      });

      yield* eligible.map((removed) => without([removed]));

      if (eligible.length > 1 && eligible.length < properties.length) {
        yield without(eligible);
      }
    },
  };
}

function sitesOf(program: NodePath): Sites {
  const cached = sitesByProgram.get(program.node);

  if (cached !== undefined) {
    return cached;
  }

  const functions: ReadonlyMap<unknown, NodePath> = new Map(
    descendants(program)
      .filter((path) => path.isFunction())
      .map((path) => [path.node, path] as const),
  );
  const sites = argsSites(list(field(program.node, 'body')), (fn) =>
    keysRead(functions.get(fn)),
  );

  sitesByProgram.set(program.node, sites);

  return sites;
}

/** The `args` objects of stories and `.test()` options that a play or test function runs for, each with the keys those functions read. */
function argsSites(
  body: readonly unknown[],
  readsOf: (fn: unknown) => Reads,
): Sites {
  const bindings = topLevelBindings(body);
  const { metaObjects, stories } = csfFile(body, bindings);
  const metaPlay = metaObjects
    .map((meta) => propertyValue(meta, 'play'))
    .find((play) => play !== undefined);
  const metaArgs = metaObjects
    .map((meta) => propertyValue(meta, 'args'))
    .find((args) => args !== undefined);

  return new Map(
    stories
      .filter(
        ({ tested, init }) =>
          tested && isTaggedTest([...metaObjects, storyArgument(unwrap(init))]),
      )
      .flatMap(({ init, local }) => {
        const play = followed(
          ownOrBasePlay(init, bindings) ?? metaPlay,
          bindings,
        );
        const plays = play === undefined ? [] : [play];
        const tests = testCallsOn(body, local).map((call) => ({
          ...call,
          testFunction: followed(call.testFunction, bindings),
        }));

        const [storyArgs, ...baseArgs] = argsLayers(init, bindings);

        return [
          site(
            storyArgs,
            [...plays, ...tests.map(({ testFunction }) => testFunction)].map(
              readsOf,
            ),
            sameLiteralKeys(storyArgs, [...baseArgs, metaArgs], bindings),
          ),
          ...tests.map(({ options, testFunction }) => {
            const testArgs = propertyValue(options, 'args');

            return site(
              testArgs,
              [...plays, testFunction].map(readsOf),
              sameLiteralKeys(
                testArgs,
                [storyArgs, ...baseArgs, metaArgs],
                bindings,
              ),
            );
          }),
        ].flatMap((found) => (found === undefined ? [] : [found]));
      }),
  );
}

/** Storybook 10.6.5 `combineTags`: a later `test` or `!test` in the static tags of the meta, then the story, wins over an earlier one. */
function isTaggedTest(owners: readonly unknown[]): boolean {
  return (
    owners
      .flatMap((owner) => list(field(propertyValue(owner, 'tags'), 'elements')))
      .map((tag) => field(tag, 'value'))
      .filter((tag) => tag === 'test' || tag === '!test')
      .at(-1) !== '!test'
  );
}

const literalTypes: readonly unknown[] = [
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
];

/** The keys whose literal value in `args` equals the value they fall back to when removed: the one the properties before the key set, else the first layer below that sets it. */
function sameLiteralKeys(
  args: unknown,
  below: readonly unknown[],
  bindings: ReadonlyMap<string, unknown>,
): ReadonlySet<Key> {
  const properties = list(field(args, 'properties'));

  return new Set(
    properties.flatMap((property, index) => {
      const key = keyName(property);
      const value = field(property, 'value');
      const fallbackValue =
        key === undefined
          ? undefined
          : valueIn(
              [
                properties.slice(0, index),
                ...below.map((layer) => list(field(layer, 'properties'))),
              ],
              key,
              bindings,
            );

      return key !== undefined &&
        literalTypes.includes(field(value, 'type')) &&
        field(value, 'type') === field(fallbackValue, 'type') &&
        field(value, 'value') === field(fallbackValue, 'value')
        ? [key]
        : [];
    }),
  );
}

/** The value of `key` that the properties of `layers`, the first layer and its last property first, set; `undefined` when none sets it or a spread or computed key that only running the file resolves comes first. */
function valueIn(
  layers: readonly (readonly unknown[])[],
  key: Key,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const property = byPriority(layers, bindings).find((candidate) => {
    const name = keyName(candidate);

    return name === undefined || name === key;
  });

  return keyName(property) === key ? field(property, 'value') : undefined;
}

/** Each layer's properties, last first, with a spread of a top-level object's `args` (`...Base.args`) replaced by that object's properties. */
function byPriority(
  layers: readonly (readonly unknown[])[],
  bindings: ReadonlyMap<string, unknown>,
): readonly unknown[] {
  return layers.flatMap((properties) =>
    properties.toReversed().flatMap((property) => {
      const object = field(property, 'argument', 'object', 'name');
      const spread = spreadArgs(property, bindings);

      return field(spread, 'type') === 'ObjectExpression'
        ? byPriority(
            [list(field(spread, 'properties'))],
            withoutBinding(bindings, object),
          )
        : [property];
    }),
  );
}

/** The `args` of the top-level object that a `...Base.args` spread names. */
function spreadArgs(
  property: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const argument = field(property, 'argument');
  const object = field(argument, 'object', 'name');

  return field(property, 'type') === 'SpreadElement' &&
    field(argument, 'type') === 'MemberExpression' &&
    field(argument, 'computed') !== true &&
    field(argument, 'property', 'name') === 'args' &&
    typeof object === 'string'
    ? propertyValue(unwrap(bindings.get(object)), 'args')
    : undefined;
}

/** A story's own `args`, then for `Base.extend({...})` those of `Base` and its own base, as Storybook 10.6.5 `extend()` merges the base story in. */
function argsLayers(
  init: unknown,
  bindings: ReadonlyMap<string, unknown>,
): readonly unknown[] {
  const call = unwrap(init);
  const own = propertyValue(storyArgument(call), 'args');
  const base = field(call, 'callee', 'object', 'name');

  return field(call, 'callee', 'property', 'name') === 'extend' &&
    typeof base === 'string'
    ? [own, ...argsLayers(bindings.get(base), withoutBinding(bindings, base))]
    : [own];
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
  readers: readonly Reads[],
  kept: ReadonlySet<Key>,
): readonly [unknown, ReadonlySet<Key>] | undefined {
  const reads = union([...readers, kept]);

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

/** The keys of `args` that a play or test function reads through its context parameter. */
function keysRead(fn: NodePath | undefined): Reads {
  if (fn === undefined || !fn.isFunction()) {
    return 'whole';
  }

  // A TypeScript `this` parameter types `this`; the context is the first argument after it.
  const [context] = fn
    .get('params')
    .filter((param) => !(param.isIdentifier() && param.node.name === 'this'));
  const inner = descendants(fn);

  if (
    context?.isAssignmentPattern() === true ||
    inner.some(
      (path) =>
        path.isIdentifier() &&
        path.node.name === 'arguments' &&
        path.isReferencedIdentifier(),
    )
  ) {
    return 'whole';
  }

  return union([
    context === undefined ? new Set() : boundReads(context, 'context'),
    ...inner.flatMap(stepCallbacks).map(keysRead),
  ]);
}

/** The functions passed to a `step()` call, which Storybook 10.6.5 runs with the story context. */
function stepCallbacks(path: NodePath): readonly NodePath[] {
  if (!path.isCallExpression()) {
    return [];
  }

  const { callee } = path.node;
  const name =
    callee.type === 'MemberExpression'
      ? field(callee, 'property', 'name')
      : field(callee, 'name');

  return name === 'step'
    ? path.get('arguments').filter((argument) => argument.isFunction())
    : [];
}

/** The keys that the reads of a variable or pattern bound to `read` read. */
function boundReads(target: NodePath, read: Read): Reads {
  if (target.isAssignmentPattern()) {
    return boundReads(target.get('left'), read);
  }

  if (target.isIdentifier()) {
    const binding = target.scope.getBinding(target.node.name);

    return binding === undefined
      ? 'whole'
      : union(binding.referencePaths.map((path) => readsAt(path, read)));
  }

  if (!target.isObjectPattern()) {
    return 'whole';
  }

  return union(
    target.get('properties').map((property): Reads => {
      const key = keyName(property.node);

      if (!property.isObjectProperty() || key === undefined) {
        return 'whole';
      }

      return keyReads(key, read, (inner) =>
        boundReads(property.get('value'), inner),
      );
    }),
  );
}

/** The keys that one read, a path that evaluates to `read`, reads. */
function readsAt(path: NodePath, read: Read): Reads {
  const parent = path.parentPath;

  if (
    parent?.isMemberExpression() === true &&
    parent.node.object === path.node
  ) {
    const key = memberKey(parent.node);

    return key === undefined
      ? 'whole'
      : keyReads(key, read, (inner) => readsAt(parent, inner));
  }

  if (
    parent?.isVariableDeclarator() === true &&
    parent.node.init === path.node
  ) {
    return boundReads(parent.get('id'), read);
  }

  return 'whole';
}

/** The keys that reading `key` of `read` reads: that key of `args`, or what the reads of the context's args or context read. */
function keyReads(
  key: Key,
  read: Read,
  readsOfValue: (value: Read) => Reads,
): Reads {
  if (read === 'args') {
    return new Set([key]);
  }

  if (argsKeys.includes(key)) {
    return readsOfValue('args');
  }

  return key === 'context' ? readsOfValue('context') : new Set();
}

/** The key of `object.key` or `object['key']`; `undefined` when only running the code gives it. */
function memberKey(member: unknown): Key | undefined {
  const property = field(member, 'property');

  if (field(member, 'computed') !== true) {
    const name = field(property, 'name');

    return typeof name === 'string' ? name : undefined;
  }

  const value = field(property, 'value');

  return typeof value === 'string' || typeof value === 'number'
    ? value
    : undefined;
}

/** The key of `label: ...`, `'label': ...` or `0: ...`; `undefined` for a computed key or a rest element. */
function keyName(property: unknown): Key | undefined {
  if (field(property, 'computed') === true) {
    return undefined;
  }

  const name =
    field(property, 'key', 'name') ?? field(property, 'key', 'value');

  return typeof name === 'string' || typeof name === 'number'
    ? name
    : undefined;
}

function descendants(path: NodePath): readonly NodePath[] {
  const found: NodePath[] = [];

  path.traverse({
    enter(inner) {
      found.push(inner);
    },
  });

  return found;
}

function propertyValue(object: unknown, key: string): unknown {
  const property = list(field(object, 'properties')).find(
    (candidate) => field(candidate, 'key', 'name') === key,
  );

  return field(property, 'type') === 'ObjectMethod'
    ? property
    : field(property, 'value');
}
