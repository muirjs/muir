import type { NodePath } from '@babel/core';
import {
  field,
  isUnknownPlay,
  list,
  propertyKey,
  sitesOf,
  type Proven,
  type SiteRun,
} from '@layzee/storybook-csf';

import type { LzStorybookMutator } from './mutator.ts';

type Key = NonNullable<ReturnType<typeof propertyKey>>;

/** The keys of `args` a play reads, or `'whole'` when it hands the object on, so that it may read any key. */
type Reads = ReadonlySet<Key> | 'whole';

/** What stays in every mutant of an args site. */
interface Kept {
  /** The keys a function that runs for the site reads. */
  readonly read: ReadonlySet<Key>;
  /** The properties whose removal the file proves changes nothing. */
  readonly proofs: readonly Proven[];
}

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
        sitesIn(path);
      }

      if (!path.isObjectExpression()) {
        return;
      }

      const program = path.findParent((parent) => parent.isProgram());
      const kept =
        program === null ? undefined : sitesIn(program).get(path.node);

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
      const eligible = properties.filter((property) => {
        const key = propertyKey(property);

        return (
          property.type === 'ObjectProperty' &&
          !property.computed &&
          key !== undefined &&
          !kept.read.has(key) &&
          !kept.proofs.some((proof) => proof.property === property)
        );
      });
      // A mutant whose keys left all equal the value they fall back to behaves like Stryker's ObjectLiteral `{}`.
      const differsFromEmpty = (removed: readonly unknown[]) =>
        properties.some(
          (property) =>
            !removed.includes(property) &&
            !kept.proofs.some(
              (proof) =>
                proof.property === property && proof.reason === 'same-as-below',
            ),
        );

      yield* [
        ...eligible.map((removed) => [removed]),
        ...(eligible.length > 1 ? [eligible] : []),
      ]
        .filter(differsFromEmpty)
        .map(without);
    },
  };
}

function sitesIn(program: NodePath): Sites {
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

/** The `args` sites of stories and `.test()` options that a play or test function runs for, each with what stays. The meta's args are no args site, and an object a function reads whole is none. */
function argsSites(
  body: readonly unknown[],
  readsOf: (fn: unknown) => Reads,
): Sites {
  return new Map(
    sitesOf(body, 'args').flatMap(({ node, runs, proofs }) => {
      const read = union(runs.flatMap((run) => readersOf(run, readsOf)));

      return runs.every(({ owner }) => owner === 'meta') || read === 'whole'
        ? []
        : [[node, { read, proofs }] as const];
    }),
  );
}

/** What the functions that run for one run of a site read: the play, and every `.test()` call for the story's own args or that call's for its options. An unknown play may read any key. */
function readersOf(
  run: SiteRun,
  readsOf: (fn: unknown) => Reads,
): readonly Reads[] {
  if (run.owner === 'meta') {
    return [];
  }

  const { play, tests } = run.story;
  const playReads: readonly Reads[] =
    play === undefined ? [] : [isUnknownPlay(play) ? 'whole' : readsOf(play)];

  return run.owner === 'test'
    ? [...playReads, readsOf(run.test.testFunction)]
    : [
        ...playReads,
        ...tests.map((test) =>
          test === 'unmatched' ? 'whole' : readsOf(test.testFunction),
        ),
      ];
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
      const key = propertyKey(property.node);

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

function descendants(path: NodePath): readonly NodePath[] {
  const found: NodePath[] = [];

  path.traverse({
    enter(inner) {
      found.push(inner);
    },
  });

  return found;
}
