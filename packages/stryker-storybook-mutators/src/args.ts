import type { NodePath } from '@babel/core';
import {
  csfFile,
  field,
  isIndexedTestCall,
  list,
  ownOrBasePlay,
  propertyValue,
  storyArgument,
  testCallOf,
  topLevelBindings,
  unwrap,
  withoutBinding,
} from '@layzee/storybook-csf';

import type { LzStorybookMutator } from './mutator.ts';

type Key = string | number;

/** The keys of `args` a play reads, or `'whole'` when it hands the object on, so that it may read any key. */
type Reads = ReadonlySet<Key> | 'whole';

/** The keys of an args site that stay in every mutant. */
interface Kept {
  /** The keys a function that runs for the site reads. */
  readonly read: ReadonlySet<Key>;
  /** The keys whose literal value equals the one they fall back to when removed. */
  readonly sameAsBelow: ReadonlySet<Key>;
}

type Site = readonly [argsObject: unknown, kept: Kept];

type Sites = ReadonlyMap<unknown, Kept>;

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
      "export default { title: 'Sample' };\nexport const Story = {\n  args: { label: 'a', disabled: true },\n  play: async () => {},\n};\n",
    *mutate(path, t) {
      // Stryker places a statement's mutants as it leaves the statement, so the file is read on entering the Program, or, under a line-range `mutate` that skips the Program, on entering the first object in range.
      if (path.isProgram()) {
        sitesOf(path);
      }

      if (!path.isObjectExpression()) {
        return;
      }

      const program = path.findParent((parent) => parent.isProgram());
      const kept =
        program === null ? undefined : sitesOf(program).get(path.node);

      if (kept === undefined) {
        return;
      }

      const { properties } = path.node;
      const without = (removed: readonly unknown[]) =>
        t.objectExpression(
          properties
            .filter((property) => !removed.includes(property))
            .map((property) => t.cloneNode(property, true)),
        );
      const eligible = properties.filter((property, index) => {
        const key = keyName(property);

        return (
          property.type === 'ObjectProperty' &&
          !property.computed &&
          key !== undefined &&
          !kept.read.has(key) &&
          !kept.sameAsBelow.has(key) &&
          !properties.slice(index + 1).some((later) => keyName(later) === key)
        );
      });
      // A mutant whose keys left all equal the value they fall back to behaves like Stryker's ObjectLiteral `{}`.
      const differsFromEmpty = (removed: readonly unknown[]) =>
        properties.some((property) => {
          const key = keyName(property);

          return (
            !removed.includes(property) &&
            (key === undefined || !kept.sameAsBelow.has(key))
          );
        });

      yield* [
        ...eligible.map((removed) => [removed]),
        ...(eligible.length > 1 ? [eligible] : []),
      ]
        .filter(differsFromEmpty)
        .map(without);
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

/** The `args` objects of stories and `.test()` options that a play or test function runs for, each with the keys that stay. In a file with a meta object, for each story Storybook 10.6.5's Vitest transform tests and whose static tags do not end in `!test`, the play is the last one assigned to the story, else its own or the one it spreads or `.extend()` takes from its base, else the meta's. */
function argsSites(
  body: readonly unknown[],
  readsOf: (fn: unknown) => Reads,
): Sites {
  const bindings = topLevelBindings(body);
  const { metaObjects, stories } = csfFile(body, bindings);

  if (metaObjects.length === 0) {
    return new Map();
  }

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
      .flatMap(({ init, local, runtimeAssignments }) => {
        const assignedPlay = runtimeAssignments
          .filter(({ path }) => path.length === 1 && path[0] === 'play')
          .at(-1)?.value;
        const play = topLevelValueOrSelf(
          assignedPlay ?? ownOrBasePlay(init, bindings) ?? metaPlay,
          bindings,
        );
        const plays = play === undefined ? [] : [play];
        const tests = testCallsOn(body, local).map((call) => ({
          ...call,
          testFunction: topLevelValueOrSelf(call.testFunction, bindings),
        }));

        const [storyArgs, ...baseArgs] = argsLayers(init, bindings);

        return [
          ...site(
            storyArgs,
            [...plays, ...tests.map(({ testFunction }) => testFunction)].map(
              readsOf,
            ),
            sameLiteralKeys(storyArgs, [...baseArgs, metaArgs], bindings),
          ),
          ...tests.flatMap(({ options, testFunction }) => {
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
        ];
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

      const literal = literalOf(value);
      const fallbackLiteral = literalOf(fallbackValue);

      return key !== undefined &&
        literal !== undefined &&
        fallbackLiteral !== undefined &&
        Object.is(literal.value, fallbackLiteral.value)
        ? [key]
        : [];
    }),
  );
}

/** The value of a literal, a negative number or a template literal without expressions; `undefined` for any other node. */
function literalOf(node: unknown): { readonly value: unknown } | undefined {
  const type = field(node, 'type');

  if (type === 'NullLiteral') {
    return { value: null };
  }

  if (literalTypes.includes(type)) {
    return { value: field(node, 'value') };
  }

  const [quasi, ...more] = list(field(node, 'quasis'));
  const cooked = field(quasi, 'value', 'cooked');

  if (
    type === 'TemplateLiteral' &&
    more.length === 0 &&
    typeof cooked === 'string'
  ) {
    return { value: cooked };
  }

  const negated = field(node, 'argument', 'value');

  return type === 'UnaryExpression' &&
    field(node, 'operator') === '-' &&
    field(node, 'argument', 'type') === 'NumericLiteral' &&
    typeof negated === 'number'
    ? { value: -negated }
    : undefined;
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
function topLevelValueOrSelf(
  node: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const name = field(node, 'name');

  return (typeof name === 'string' ? bindings.get(name) : undefined) ?? node;
}

/** The args site of `argsObject` when it is an object literal, at least one function runs for it and none reads it whole; none otherwise. */
function site(
  argsObject: unknown,
  readers: readonly Reads[],
  sameAsBelow: ReadonlySet<Key>,
): readonly Site[] {
  const read = union(readers);

  return field(argsObject, 'type') !== 'ObjectExpression' ||
    readers.length === 0 ||
    read === 'whole'
    ? []
    : [[argsObject, { read, sameAsBelow }]];
}

function union(reads: readonly Reads[]): Reads {
  return reads.includes('whole')
    ? 'whole'
    : new Set(reads.flatMap((keys) => (keys === 'whole' ? [] : [...keys])));
}

/** The top-level `<story>.test(name, [options,] fn)` calls on a story that Storybook 10.6.5 indexes and runs, the first of each name; a call with a spread argument has an unknown test function. */
function testCallsOn(
  body: readonly unknown[],
  local: unknown,
): readonly { readonly options: unknown; readonly testFunction: unknown }[] {
  return body
    .flatMap(testCallOf)
    .filter(({ target }) => target === local)
    .filter(
      ({ args: [name] }, index, calls) =>
        calls.findIndex(
          ({ args: [other] }) => field(other, 'value') === field(name, 'value'),
        ) === index,
    )
    .flatMap(({ statement, args }) => {
      const [, ...rest] = args;

      if (isIndexedTestCall(statement)) {
        return [
          {
            options: rest.length > 1 ? rest[0] : undefined,
            testFunction: rest.at(-1),
          },
        ];
      }

      return args.some((arg) => field(arg, 'type') === 'SpreadElement')
        ? [{ options: undefined, testFunction: undefined }]
        : [];
    });
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
