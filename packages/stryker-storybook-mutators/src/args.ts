import type { NodePath } from '@babel/core';
import {
  csfFile,
  field,
  lastWinsProperties,
  list,
  ownStoryValue,
  playedStories,
  propertyValue,
  storyValues,
  topLevelBindings,
  unwrap,
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

/** One story's use of an args object: what the functions that run for it read, and its keys equal to the value below. */
type Use = readonly [
  argsObject: unknown,
  reads: Reads,
  sameAsBelow: ReadonlySet<Key>,
];

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
  const file = csfFile(body, bindings);
  const metaArgs = file.metaObjects
    .map((meta) => propertyValue(meta, 'args'))
    .find((args) => args !== undefined);

  return sitesFrom(
    playedStories(body, bindings, file).flatMap(
      ({ story: { init }, play, tests }) => {
        const plays = play === undefined ? [] : [play];
        const [storyArgs, ...baseArgs] = storyValues(init, bindings, 'args');

        return [
          ...site(
            ownStoryValue(init, bindings, 'args'),
            [
              ...plays.map(readsOf),
              ...tests.map((test) =>
                test === 'unmatched' ? 'whole' : readsOf(test.testFunction),
              ),
            ],
            sameLiteralKeys(storyArgs, [...baseArgs, metaArgs], bindings),
          ),
          ...tests.flatMap((test) => {
            if (test === 'unmatched') {
              return [];
            }

            const { options, testFunction } = test;
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
      },
    ),
  );
}

const literalTypes: readonly unknown[] = [
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
];

/** The keys whose literal value in `args` equals the value they fall back to when removed: the one the properties before the key set, else the first layer below that sets it, where a layer that is a spread that does not resolve may set any key. */
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
                ...below.map((layer) =>
                  field(layer, 'type') === 'SpreadElement'
                    ? [layer]
                    : list(field(layer, 'properties')),
                ),
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
    lastWinsProperties(properties, bindings, spreadArgs),
  );
}

const memberTypes: readonly unknown[] = [
  'MemberExpression',
  'OptionalMemberExpression',
];

/** The `args` of the top-level object that a `...Base.args`, `...Base?.args` or `...Base['args']` spread names. */
function spreadArgs(
  argument: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const object = field(argument, 'object', 'name');

  return memberTypes.includes(field(argument, 'type')) &&
    memberKey(argument) === 'args' &&
    typeof object === 'string'
    ? propertyValue(unwrap(bindings.get(object)), 'args')
    : undefined;
}

/** One story's use of `argsObject` when it is an object literal that at least one function runs for; none otherwise. */
function site(
  argsObject: unknown,
  readers: readonly Reads[],
  sameAsBelow: ReadonlySet<Key>,
): readonly Use[] {
  return field(argsObject, 'type') !== 'ObjectExpression' ||
    readers.length === 0
    ? []
    : [[argsObject, union(readers), sameAsBelow]];
}

/** The args sites of every story's uses, as a `.test()` options object can serve several stories: the keys any of them reads stay, a key stays as equal to the value below only when it is for all of them, and an object one of them reads whole is no site. */
function sitesFrom(uses: readonly Use[]): Sites {
  return new Map(
    [...Map.groupBy(uses, ([argsObject]) => argsObject)].flatMap(
      ([argsObject, all]): readonly Site[] => {
        const read = union(all.map(([, reads]) => reads));

        return read === 'whole'
          ? []
          : [
              [
                argsObject,
                {
                  read,
                  sameAsBelow: all
                    .map(([, , sameAsBelow]) => sameAsBelow)
                    .reduce(
                      (kept, same) =>
                        new Set([...kept].filter((key) => same.has(key))),
                    ),
                },
              ],
            ];
      },
    ),
  );
}

function union(reads: readonly Reads[]): Reads {
  return reads.includes('whole')
    ? 'whole'
    : new Set(reads.flatMap((keys) => (keys === 'whole' ? [] : [...keys])));
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
