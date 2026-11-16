import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

import {
  transformSync,
  types,
  type NodePath,
  type PluginObject,
} from '@babel/core';
import {
  field,
  isRecord,
  list,
  propertyKey,
  type ProofReason,
} from '@layzee/storybook-core';
import { definePreview, getStoryChildren } from 'storybook/internal/csf';
import { composeStories } from 'storybook/preview-api';

import { tempRoot, writeTree } from './temp-tree.ts';

/** A test case of a mutator package: a story file and the name its rows are reported under. */
export interface Case {
  readonly id: string;
  /** A story file. */
  readonly source: string;
}

export interface Skip {
  readonly property: object;
  readonly reason: string;
}

/** What the harness uses of a node:test `TestContext`. */
export interface HarnessContext {
  after(fn: () => void): unknown;
  diagnostic(message: string): void;
  test(name: string, fn: (t: RowContext) => void): Promise<unknown>;
}

/** What the harness uses of the context of one row's test. */
export type RowContext = Pick<HarnessContext, 'diagnostic'>;

export interface ComposeSkips {
  readonly cases: readonly Case[];
  readonly skipsOf: (
    program: NodePath,
  ) => ReadonlyMap<unknown, readonly Skip[]>;
  readonly layer: 'args' | 'globals';
  readonly same: (withProperty: unknown, withoutProperty: unknown) => boolean;
  readonly unloadable: ReadonlyMap<string, string>;
  readonly reasonsRowsMustCut: readonly ProofReason[];
}

/** Keys Storybook reads while it composes a story; a stub spread over a meta that claimed one stops the file loading. */
const structural: readonly string[] = [
  'play',
  'tags',
  'id',
  'title',
  'includeStories',
  'excludeStories',
];

const stubGlobal = '__lzComposeSkipsStub';

// Stryker disable next-line ArrowFunction: composing needs a render to exist and never calls it
const csf3Project = definePreview({ render: () => null }).composed;

interface Row {
  readonly program: NodePath;
  readonly keys: readonly string[];
  readonly freeNames: readonly string[];
  readonly imports: readonly types.ImportDeclaration[];
}

interface RowResult {
  readonly id: string;
  readonly loaded: boolean;
  readonly proofCount: number;
  readonly cuts: readonly {
    readonly reasons: readonly string[];
    readonly same: boolean;
  }[];
  readonly notes: readonly string[];
  readonly failures: readonly string[];
}

/**
 * Registers one test that composes each case's stories with and without each property the mutator skips and fails a
 * row where they differ. `register` takes the place of node:test's `test` in this package's own tests.
 */
export function composeSkips(
  { cases, skipsOf, layer, same, unloadable, reasonsRowsMustCut }: ComposeSkips,
  register: (
    name: string,
    fn: (t: HarnessContext) => Promise<void>,
  ) => unknown = test,
): void {
  register(
    'removing a property the mutator skips leaves every composed story the same',
    async (t) => {
      const root = tempRoot(t, 'compose-skips-');
      redirectBareImports(t, root);
      const rows = cases.map((testCase) => ({
        testCase,
        row: analyse(testCase.source, `${testCase.id}.stories.ts`),
      }));
      defineStubs(
        t,
        rows.map(({ row }) => row.keys),
      );
      const results = await Promise.all(
        rows.map(({ testCase, row }, index) =>
          checkRow(
            testCase,
            row,
            writeRow(join(root, String(index)), index, row),
            { skipsOf, layer, same, unloadable },
          ),
        ),
      );

      await reportRows(t, results);
      reportRun(t, results, { cases, unloadable, reasonsRowsMustCut });
    },
  );
}

/** Sends each bare import a file under the temporary root makes to its stub module, until the test ends. */
function redirectBareImports(t: Pick<HarnessContext, 'after'>, root: string) {
  const rootUrl = pathToFileURL(root).href;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const parent = context.parentURL;

      if (
        parent?.startsWith(rootUrl) !== true ||
        specifier.startsWith('file:') ||
        specifier.startsWith('.')
      ) {
        return nextResolve(specifier, context);
      }

      return {
        url: new URL(`__bare__/${bareFile(specifier)}`, parent).href,
        shortCircuit: true,
      };
    },
  });
  // Stryker disable next-line ArrowFunction,CallExpression: a hook left in place resolves only imports from the deleted temporary folder, which nothing makes
  t.after(() => hooks.deregister());
}

/** Defines the global the stub modules and preludes call for the stub of each row and name, until the test ends. */
function defineStubs(
  t: Pick<HarnessContext, 'after'>,
  keysOfRows: readonly (readonly string[])[],
) {
  const stubs = new Map<string, unknown>();
  Reflect.defineProperty(globalThis, stubGlobal, {
    configurable: true,
    value: (row: number, name: string): unknown => {
      const id = `${row}|${name}`;
      const found = stubs.get(id);

      if (found !== undefined) {
        return found;
      }

      // Stryker disable next-line ArrayDeclaration: a stub module or prelude only calls with the number of its own row
      const stub = claimingStub(keysOfRows[row] ?? []);
      stubs.set(id, stub);

      return stub;
    },
  });
  t.after(() => Reflect.deleteProperty(globalThis, stubGlobal));
}

async function reportRows(
  t: Pick<HarnessContext, 'test'>,
  results: readonly RowResult[],
): Promise<void> {
  await Promise.all(
    results.map(({ id, notes, failures }) =>
      t.test(id, (rowContext) => {
        notes.forEach((note) => rowContext.diagnostic(note));

        if (failures.length > 0) {
          assert.fail(failures.join('\n'));
        }
      }),
    ),
  );
}

/** Counts what the run checked, and fails it when the unloadable list names a missing row or a check cut nothing. */
function reportRun(
  t: Pick<HarnessContext, 'diagnostic'>,
  results: readonly RowResult[],
  {
    cases,
    unloadable,
    reasonsRowsMustCut,
  }: Pick<ComposeSkips, 'cases' | 'unloadable' | 'reasonsRowsMustCut'>,
): void {
  const cuts = results.flatMap((result) => result.cuts);
  const unloaded = results.filter(({ loaded }) => !loaded);
  const withProofs = unloaded
    .filter(({ proofCount }) => proofCount > 0)
    .map(({ id }) => id);
  t.diagnostic(
    `rows composed: ${results.length - unloaded.length} of ${results.length}`,
  );
  t.diagnostic(
    `proofs checked: ${
      [
        ...Map.groupBy(
          cuts.flatMap(({ reasons }) => reasons),
          (reason) => reason,
        ),
      ]
        .map(([reason, all]) => `${reason} ${all.length}`)
        .join(', ') || 'none'
    }`,
  );
  t.diagnostic(
    `properties cut: ${cuts.filter((cut) => cut.same).length} compose the same, ${cuts.filter((cut) => !cut.same).length} compose differently`,
  );
  t.diagnostic(
    `unloadable rows: ${withProofs.length} with proofs (${withProofs.join(', ')}), ${unloaded.length - withProofs.length} without`,
  );

  const ids = new Set(cases.map(({ id }) => id));
  assert.deepEqual(
    [...unloadable.keys()].filter((id) => !ids.has(id)),
    [],
    'the unloadable list names rows no case table has',
  );
  assert.notEqual(cuts.length, 0, 'no row cut a property the mutator skips');
  assert.deepEqual(
    reasonsRowsMustCut.filter(
      (reason) => !cuts.some((cut) => cut.reasons.includes(reason)),
    ),
    [],
    'proof reasons no row cut',
  );
}

interface RowFiles {
  readonly dir: string;
  readonly prelude: string;
  next(): string;
}

async function checkRow(
  testCase: Case,
  row: Row,
  files: RowFiles,
  {
    skipsOf,
    layer,
    same,
    unloadable,
  }: Omit<ComposeSkips, 'cases' | 'reasonsRowsMustCut'>,
): Promise<RowResult> {
  const { id } = testCase;
  const skips = [...skipsOf(row.program)];
  const proofCount = skips.reduce((n, [, proofs]) => n + proofs.length, 0);
  const listed = unloadable.get(id);
  const loaded = await composeOrError(files, testCase.source, layer);

  if ('error' in loaded) {
    const unloaded = { id, loaded: false, proofCount, cuts: [] };

    if (proofCount === 0) {
      return {
        ...unloaded,
        notes: [],
        failures:
          listed === undefined
            ? []
            : [`${id} is listed as unloadable but has no proof`],
      };
    }

    return {
      ...unloaded,
      notes: [`cannot load: ${loaded.error}`],
      failures:
        listed === undefined
          ? [`${id} has ${proofCount} proofs but cannot load: ${loaded.error}`]
          : [],
    };
  }

  if (listed !== undefined) {
    return {
      id,
      loaded: true,
      proofCount,
      cuts: [],
      notes: [],
      failures: [`${id} is listed as unloadable (${listed}) but loads`],
    };
  }

  const base = loaded.composed;
  const cuts = await Promise.all(
    skips.flatMap(([, proofs]) =>
      [...Map.groupBy(proofs, ({ property }) => property)].map(
        async ([property, propertyProofs]) => {
          const reasons = propertyProofs.map(({ reason }) => reason);
          const label = `${id}: removing ${String(propertyKey(property))} (${reasons.join(', ')})`;
          const cut = await composeOrError(
            files,
            without(testCase.source, property),
            layer,
          );

          if ('error' in cut) {
            return {
              reasons,
              same: false,
              failures: [`${label} stops the file loading: ${cut.error}`],
            };
          }

          const failures = [
            ...new Set([...base.keys(), ...cut.composed.keys()]),
          ]
            .filter((story) => !same(base.get(story), cut.composed.get(story)))
            .map(
              (story) =>
                `${label} changes the ${layer} of ${story}: with it ${show(base.get(story))}, without it ${show(cut.composed.get(story))}`,
            );

          return { reasons, same: failures.length === 0, failures };
        },
      ),
    ),
  );

  return {
    id,
    loaded: true,
    proofCount,
    cuts,
    notes: [],
    failures: cuts.flatMap(({ failures }) => failures),
  };
}

/** Reads `source` as the file `fileName`, the name the case runner instruments it under. */
function analyse(source: string, fileName: string): Row {
  const programs: NodePath<types.Program>[] = [];
  const keys = new Set(['args', 'globals']);
  // A plugin's paths carry Babel's File, the place a mutator reads the file name from under Stryker's instrumenter.
  const reader: PluginObject = {
    visitor: {
      Program(path) {
        programs.push(path);
      },
      ObjectProperty({ node }) {
        const key = propertyKey(node);

        if (typeof key === 'string' && !structural.includes(key)) {
          keys.add(key);
        }
      },
    },
  };

  // Stryker disable BooleanLiteral: this repository has no Babel config for the first two to keep out, and code only prints the program
  transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: fileName,
    parserOpts: { plugins: ['typescript'] },
    code: false,
    plugins: [() => reader],
  });
  // Stryker restore BooleanLiteral
  const [program] = programs;
  assert.ok(program);

  return {
    program,
    keys: [...keys],
    // Babel counts the `const` of `as const` as a global.
    freeNames: Object.keys(program.scope.globals).filter(
      (name) => types.isValidIdentifier(name) && !(name in globalThis),
    ),
    imports: program.node.body.filter((statement) =>
      types.isImportDeclaration(statement),
    ),
  };
}

function writeRow(
  dir: string,
  row: number,
  { freeNames, imports }: Row,
): RowFiles {
  const stories = join(dir, 'stories');
  const stub = (name: string) =>
    `globalThis.${stubGlobal}(${row}, ${JSON.stringify(name)})`;
  const modules = Map.groupBy(
    imports.filter(
      ({ source }) => !source.value.endsWith('.storybook/preview'),
    ),
    ({ source }) =>
      relative(
        dir,
        // A relative import's stub sits at the specifier as written, with or without an extension: Node loads an
        // extensionless file in a "type": "module" package as an ES module.
        source.value.startsWith('.')
          ? resolve(stories, source.value)
          : join(stories, '__bare__', bareFile(source.value)),
      ),
  );

  writeTree(dir, {
    'package.json': '{ "type": "module" }\n',
    '.storybook/preview': `import { definePreview } from '${import.meta.resolve('storybook/internal/csf')}';\nexport default definePreview({ render: () => null });\n`,
    ...Object.fromEntries(
      [...modules].map(([file, declarations]) => [
        file,
        [
          ...new Set(
            declarations.flatMap(({ source, specifiers }) =>
              specifiers.flatMap((specifier) =>
                exportLine(specifier, source.value, stub),
              ),
            ),
          ),
        ].join(''),
      ]),
    ),
  });
  let variant = 0;

  return {
    dir: stories,
    prelude: freeNames
      .map((name) => `const ${name} = ${stub(name)};\n`)
      .join(''),
    // The ESM cache is keyed by URL, so each variant needs its own file.
    // Stryker disable next-line UpdateOperator: counting down gives distinct names too
    next: () => `v${variant++}.stories.ts`,
  };
}

/** The line a stub module exports one imported name by; none for a namespace import, which gets an empty module. */
function exportLine(
  specifier: types.ImportDeclaration['specifiers'][number],
  source: string,
  stub: (name: string) => string,
): readonly string[] {
  if (specifier.type === 'ImportDefaultSpecifier') {
    return [`export default ${stub(`default of ${source}`)};`];
  }

  return specifier.type === 'ImportSpecifier' &&
    specifier.imported.type === 'Identifier'
    ? [
        `export const ${specifier.imported.name} = ${stub(specifier.imported.name)};`,
      ]
    : [];
}

function bareFile(specifier: string): string {
  // Stryker disable next-line StringLiteral: any replacement a file name may hold works, as the hook and the file name both use it
  return `${specifier.replaceAll(/[^\w.-]/g, '_')}.ts`;
}

/** The layer of each story `source` composes, or the first line of the error that stops it loading. */
function composeOrError(
  files: RowFiles,
  source: string,
  layer: ComposeSkips['layer'],
): Promise<
  | { readonly composed: ReadonlyMap<string, unknown> }
  | { readonly error: string }
> {
  return compose(files, source, layer).then(
    (composed) => ({ composed }),
    (error: unknown) => ({ error: message(error) }),
  );
}

async function compose(
  files: RowFiles,
  source: string,
  layer: ComposeSkips['layer'],
): Promise<ReadonlyMap<string, unknown>> {
  const file = files.next();
  writeTree(files.dir, { [file]: `${files.prelude}${source}` });
  const module: unknown = await import(
    pathToFileURL(join(files.dir, file)).href
  );
  assert.ok(isRecord(module));
  const factories = Object.entries(module).filter(
    ([, value]) => field(value, '_tag') === 'Story',
  );

  if (factories.length > 0) {
    return new Map(
      factories.flatMap(([name, story]) =>
        withChildren(name, story).map(
          ([label, child]) =>
            [label, member(member(child, 'composed'), layer)] as const,
        ),
      ),
    );
  }

  const stories: unknown = Reflect.apply(composeStories, undefined, [
    module,
    csf3Project,
  ]);
  assert.ok(isRecord(stories));

  return new Map(
    Object.entries(stories).map(
      ([name, story]) => [name, member(story, layer)] as const,
    ),
  );
}

function withChildren(
  name: string,
  story: unknown,
): readonly (readonly [string, unknown])[] {
  const children: unknown = Reflect.apply(getStoryChildren, undefined, [story]);

  return [
    [name, story],
    ...list(children).flatMap((child, index) =>
      withChildren(`${name} .test() ${index + 1}`, child),
    ),
  ];
}

/** `value[key]`, for an object or a function such as a composed CSF3 story. */
function member(value: unknown, key: string): unknown {
  return Reflect.get(Object(value), key);
}

/** `source` without `property` and the comma after it, if one follows; a comma before it then trails the property before. */
function without(source: string, property: object): string {
  const end = offset(property, 'end');
  const comma = /^\s*,/.exec(source.slice(end))?.[0].length ?? 0;

  return source.slice(0, offset(property, 'start')) + source.slice(end + comma);
}

function offset(node: unknown, edge: 'start' | 'end'): number {
  const value = field(node, edge);
  assert.ok(typeof value === 'number');

  return value;
}

function claimingStub(keys: readonly string[]): unknown {
  const claims = (key: string | symbol) =>
    keys.some((claimed) => claimed === key);
  const stub: object = new Proxy(() => undefined, {
    get: (_target, key) =>
      key === Symbol.iterator
        ? () => [].values()
        : claims(key)
          ? stub
          : undefined,
    ownKeys: () => [...keys],
    getOwnPropertyDescriptor: (_target, key) =>
      claims(key) ? { enumerable: true, configurable: true } : undefined,
    apply: () => stub,
  });

  return stub;
}

function show(value: unknown): string {
  return inspect(value, { depth: 4, breakLength: Infinity, compact: true });
}

function message(error: unknown): string {
  return error instanceof Error
    ? // Stryker disable next-line StringLiteral: split always gives a first element
      (error.message.split('\n')[0] ?? '')
    : String(error);
}
