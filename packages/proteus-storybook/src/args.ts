import type { NodePath } from '@babel/core';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookFileNameOf,
  muirMoiraStorybookIsUnknownPlay,
  muirMoiraStorybookList,
  muirMoiraStorybookPropertyKey,
  muirMoiraStorybookReadNamingStoryFile,
  muirMoiraStorybookSitesOf,
  type MuirMoiraStorybookProven,
  type MuirMoiraStorybookSiteRun,
} from '@muirjs/moira-storybook';

import type { MuirProteusStorybookMutator } from './mutator.ts';
import { muirProteusStorybookPackageName } from './package-name.ts';

type Key = NonNullable<ReturnType<typeof muirMoiraStorybookPropertyKey>>;

/** The keys of `args` a play reads, or `'whole'` when it hands the object on, so that it may read any key. */
type Reads = ReadonlySet<Key> | 'whole';

interface Kept {
  /** The keys a site rule leaves alone. */
  readonly leftAlone: ReadonlySet<Key>;
  readonly proofs: readonly MuirMoiraStorybookProven[];
}

type Sites = ReadonlyMap<unknown, Kept>;

/** What a read evaluates to: the `args` object, or the story context that holds it. */
type Read = 'args' | 'context';

const sitesByProgram = new WeakMap<object, Sites>();

/** The keys of the story context that hold the args: Storybook 10.6.5 passes `args` and `initialArgs`. */
const argsKeys: readonly Key[] = ['args', 'initialArgs'];

export function muirProteusStorybookArgsMutator(): MuirProteusStorybookMutator & {
  readonly name: 'MuirProteusStorybookArgs';
} {
  return {
    name: 'MuirProteusStorybookArgs',
    sample:
      "export default { title: 'Sample' };\nexport const Story = {\n  args: { label: 'a', disabled: true },\n  play: async () => {},\n};\n",
    *mutate(path, t) {
      // Stryker places a statement's mutants as it leaves the statement, so the file is read on entering the Program, or, under a line-range `mutate` that skips the Program, on entering the first object in range.
      if (path.isProgram()) {
        muirProteusStorybookSitesIn(path);
      }

      if (!path.isObjectExpression()) {
        return;
      }

      const program = path.findParent((parent) => parent.isProgram());
      const kept =
        program === null
          ? undefined
          : muirProteusStorybookSitesIn(program).get(path.node);

      if (kept === undefined) {
        return;
      }

      const { properties } = path.node;
      const without = (removed: readonly unknown[]) =>
        t.objectExpression(
          properties
            .filter((property) => !removed.includes(property))
            .map((property) => t.cloneNode(property)),
        );
      const eligible = properties.filter((property) => {
        const key = muirMoiraStorybookPropertyKey(property);

        return (
          property.type === 'ObjectProperty' &&
          !property.computed &&
          key !== undefined &&
          !kept.leftAlone.has(key) &&
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

export function muirProteusStorybookSitesIn(program: NodePath): Sites {
  const cached = sitesByProgram.get(program.node);

  if (cached !== undefined) {
    return cached;
  }

  const sites = muirMoiraStorybookReadNamingStoryFile(
    muirProteusStorybookPackageName,
    program,
    () => {
      const paths: ReadonlyMap<unknown, NodePath> = new Map(
        descendants(program).map((path) => [path.node, path] as const),
      );

      return argsSites(
        muirMoiraStorybookList(muirMoiraStorybookField(program.node, 'body')),
        muirMoiraStorybookFileNameOf(program),
        (fn) => keysRead(paths.get(fn)),
      );
    },
  );

  sitesByProgram.set(program.node, sites);

  return sites;
}

function argsSites(
  body: readonly unknown[],
  fileName: string | undefined,
  readsOf: (fn: unknown) => Reads,
): Sites {
  return new Map(
    muirMoiraStorybookSitesOf(body, 'args', fileName).map(
      ({ node, runs, proofs }) =>
        [node, { leftAlone: leftAlone(node, runs, readsOf), proofs }] as const,
    ),
  );
}

/** The keys of `site` a site rule leaves alone (ADR 0001, per key at the meta by ADR 0002): no run surely takes the key from the site, or a play or test function of a run that may take it reads it. */
function leftAlone(
  site: object,
  runs: readonly MuirMoiraStorybookSiteRun[],
  readsOf: (fn: unknown) => Reads,
): ReadonlySet<Key> {
  const readers = runs.map((run) => ({
    run,
    reads: union(readersOf(run, readsOf)),
  }));

  return new Set(
    muirMoiraStorybookList(muirMoiraStorybookField(site, 'properties'))
      .map(muirMoiraStorybookPropertyKey)
      .filter((key) => key !== undefined)
      .filter((key) => {
        const sources = readers.map(({ run, reads }) => ({
          from: run.keyFrom(key),
          reads,
        }));
        const isTaken = sources.some(({ from }) => from === 'site');

        return (
          !isTaken ||
          sources.some(
            ({ from, reads }) =>
              from !== 'elsewhere' && (reads === 'whole' || reads.has(key)),
          )
        );
      }),
  );
}

function readersOf(
  run: MuirMoiraStorybookSiteRun,
  readsOf: (fn: unknown) => Reads,
): readonly Reads[] {
  const { play, tests } = run.story;
  const playReads: readonly Reads[] =
    play === undefined
      ? []
      : [muirMoiraStorybookIsUnknownPlay(play) ? 'whole' : readsOf(play)];

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
  const sets = reads.filter((keys) => keys !== 'whole');

  return sets.length === reads.length
    ? new Set(sets.flatMap((keys) => [...keys]))
    : 'whole';
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
      ? muirMoiraStorybookField(callee, 'property', 'name')
      : muirMoiraStorybookField(callee, 'name');

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
      const key = muirMoiraStorybookPropertyKey(property.node);

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

  // Stryker disable next-line ConditionalExpression,BlockStatement: a read is an identifier or member expression inside the file, and only a Program path has no parent path
  if (parent === null) {
    return 'whole';
  }

  // A read that is the computed key of its member, as in x[context], gets no key from memberKey, so it reads the whole.
  if (parent.isMemberExpression()) {
    const key = memberKey(parent.node);

    return key === undefined
      ? 'whole'
      : keyReads(key, read, (inner) => readsAt(parent, inner));
  }

  // A read is never the id of its declarator, so it is the init.
  if (parent.isVariableDeclarator()) {
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

  return key === 'context' ? readsOfValue(read) : new Set();
}

/** The key of `object.key` or `object['key']`; `undefined` when only running the code gives it. */
function memberKey(member: unknown): Key | undefined {
  const property = muirMoiraStorybookField(member, 'property');

  if (muirMoiraStorybookField(member, 'computed') !== true) {
    const name = muirMoiraStorybookField(property, 'name');

    return typeof name === 'string' ? name : undefined;
  }

  const value = muirMoiraStorybookField(property, 'value');

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
