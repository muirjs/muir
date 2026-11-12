// Composes each case row with Storybook 10.6.5, with and without each property the mutator proves changes nothing,
// and fails when a composed story differs: such a skip would hide a killable mutant (ADR 0006). Names the row leaves
// unbound and modules it imports get a stub that claims every key the row names, so a skip over an unknown value
// shows as a change.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

import { parseSync, traverse, types, type NodePath } from '@babel/core';
import { field, isRecord, list, propertyKey } from '@layzee/storybook-csf';
import { definePreview, getStoryChildren } from 'storybook/internal/csf';
import { composeStories } from 'storybook/preview-api';

import type { Case } from './case.ts';
import { tempRoot, writeTree } from './temp-tree.ts';

/** A property the mutator skips, and why. */
export interface Skip {
  readonly property: object;
  readonly reason: string;
}

export interface ComposeSkips {
  readonly cases: readonly Case[];
  /** The properties the mutator skips, per site, from its own analysis of the file. */
  readonly skipsOf: (
    program: NodePath,
  ) => ReadonlyMap<unknown, readonly Skip[]>;
  readonly layer: 'args' | 'globals';
  /** Whether two composed values of the layer act the same. */
  readonly same: (withProperty: unknown, withoutProperty: unknown) => boolean;
  /** Rows with a skip that Storybook itself cannot load, each with the reason. */
  readonly unloadable: ReadonlyMap<string, string>;
}

/** Keys Storybook reads as story structure; a stub that claimed them would break composition of every row. */
const structural: readonly string[] = [
  'play',
  'tags',
  'render',
  'decorators',
  'loaders',
  'beforeEach',
  'afterEach',
  'parameters',
  'title',
  'component',
  'name',
  'id',
];

const stubGlobal = '__lzComposeSkipsStub';

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
  /** For each property cut, its proofs' reasons and whether every story composed the same. */
  readonly cuts: readonly {
    readonly reasons: readonly string[];
    readonly same: boolean;
  }[];
  readonly notes: readonly string[];
  readonly failures: readonly string[];
}

export function composeSkips({
  cases,
  skipsOf,
  layer,
  same,
  unloadable,
}: ComposeSkips): void {
  test('removing a property the mutator skips leaves every composed story the same', async (t) => {
    const root = tempRoot(t, 'compose-skips-');
    const rootUrl = pathToFileURL(root).href;
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        const parent = context.parentURL;

        if (
          parent?.startsWith(rootUrl) !== true ||
          specifier.startsWith('file:')
        ) {
          return nextResolve(specifier, context);
        }

        // Story files import without an extension, as Storybook's bundler allows; a package is a stub in the tree.
        if (!specifier.startsWith('.')) {
          return {
            url: new URL(`__bare__/${bareFile(specifier)}`, parent).href,
            shortCircuit: true,
          };
        }

        return nextResolve(
          specifier.endsWith('.ts') ? specifier : `${specifier}.ts`,
          context,
        );
      },
    });
    t.after(() => hooks.deregister());

    const keysByRow = new Map<number, readonly string[]>();
    const stubs = new Map<string, unknown>();
    Reflect.defineProperty(globalThis, stubGlobal, {
      configurable: true,
      value: (row: number, name: string): unknown => {
        const id = `${row}|${name}`;
        const found = stubs.get(id);

        if (found !== undefined) {
          return found;
        }

        const stub = claimingStub(keysByRow.get(row) ?? []);
        stubs.set(id, stub);

        return stub;
      },
    });
    t.after(() => Reflect.deleteProperty(globalThis, stubGlobal));

    const results = await Promise.all(
      cases.map((testCase, index) => {
        const row = analyse(testCase.source);
        keysByRow.set(index, row.keys);

        return checkRow(
          testCase,
          row,
          writeRow(join(root, String(index)), index, row),
          { skipsOf, layer, same, unloadable },
        );
      }),
    );

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
  });
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
  { skipsOf, layer, same, unloadable }: Omit<ComposeSkips, 'cases'>,
): Promise<RowResult> {
  const { id } = testCase;
  const skips = [...skipsOf(row.program)];
  const proofCount = skips.reduce((n, [, proofs]) => n + proofs.length, 0);
  const listed = unloadable.get(id);
  const loaded = await compose(files, testCase.source, layer).then(
    (composed) => ({ composed }),
    (error: unknown) => ({ error: message(error) }),
  );

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
    skips.flatMap(([site, proofs]) =>
      [...Map.groupBy(proofs, ({ property }) => property)].map(
        async ([property, propertyProofs]) => {
          const reasons = propertyProofs.map(({ reason }) => reason);
          const label = `${id}: removing ${String(propertyKey(property))} (${reasons.join(', ')})`;
          const cut = await compose(
            files,
            without(testCase.source, site, property),
            layer,
          ).then(
            (composed) => ({ composed }),
            (error: unknown) => ({ error: message(error) }),
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

function analyse(source: string): Row {
  const file = parseSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'case.stories.ts',
    parserOpts: { plugins: ['typescript'] },
  });
  assert.ok(file);
  const programs: NodePath[] = [];
  const keys = new Set(['args', 'globals']);

  traverse(file, {
    Program(path) {
      programs.push(path);
    },
    ObjectProperty({ node }) {
      const key = propertyKey(node);

      if (typeof key === 'string' && !structural.includes(key)) {
        keys.add(key);
      }
    },
  });
  const [program] = programs;
  assert.ok(program);

  return {
    program,
    keys: [...keys],
    // Babel counts the `const` of `as const` as a global.
    freeNames: Object.keys(program.scope.globals).filter(
      (name) => types.isValidIdentifier(name) && !(name in globalThis),
    ),
    imports: file.program.body.filter((statement) =>
      types.isImportDeclaration(statement),
    ),
  };
}

/** The row's tree: the preview, a stub module for each import other than the preview, and a prelude that stubs each free name. */
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
        source.value.startsWith('.')
          ? resolve(stories, `${source.value}.ts`)
          : join(stories, '__bare__', bareFile(source.value)),
      ),
  );

  writeTree(dir, {
    'package.json': '{ "type": "module" }\n',
    '.storybook/preview.ts': `import { definePreview } from '${import.meta.resolve('storybook/internal/csf')}';\nexport default definePreview({ render: () => null });\n`,
    ...Object.fromEntries(
      [...modules].map(([file, declarations]) => [
        file,
        [
          ...new Set(
            declarations.flatMap(({ source, specifiers }) =>
              specifiers.map((specifier) =>
                specifier.type === 'ImportDefaultSpecifier'
                  ? `export default ${stub(`default of ${source.value}`)};`
                  : specifier.type === 'ImportSpecifier' &&
                      specifier.imported.type === 'Identifier'
                    ? `export const ${specifier.imported.name} = ${stub(specifier.imported.name)};`
                    : '',
              ),
            ),
          ),
          '',
        ].join('\n'),
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
    next: () => `v${variant++}.stories.ts`,
  };
}

function bareFile(specifier: string): string {
  return `${specifier.replaceAll(/[^\w.-]/g, '_')}.ts`;
}

/** The composed `layer` of every story the file exports and of every `.test()` child, by name. */
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
  return (typeof value === 'object' && value !== null) ||
    typeof value === 'function'
    ? Reflect.get(value, key)
    : undefined;
}

/** The source without `property`, with the separator that went with it. */
function without(source: string, site: unknown, property: object): string {
  const properties = list(field(site, 'properties'));
  const index = properties.indexOf(property);
  const [from, to] =
    index + 1 < properties.length
      ? [offset(property, 'start'), offset(properties[index + 1], 'start')]
      : index > 0
        ? [offset(properties[index - 1], 'end'), offset(property, 'end')]
        : [offset(property, 'start'), offset(property, 'end')];

  return source.slice(0, from) + source.slice(to);
}

function offset(node: unknown, edge: 'start' | 'end'): number {
  const value = field(node, edge);
  assert.ok(typeof value === 'number');

  return value;
}

/** A value that claims every key in `keys`, so that a spread or read of it may set any key the row names. */
function claimingStub(keys: readonly string[]): unknown {
  const claims = (key: string | symbol) =>
    typeof key === 'string' && keys.includes(key);
  const stub: object = new Proxy(() => undefined, {
    get: (_target, key) =>
      key === Symbol.iterator
        ? () => [].values()
        : claims(key)
          ? stub
          : undefined,
    ownKeys: () => [...keys],
    getOwnPropertyDescriptor: (_target, key) =>
      claims(key)
        ? { value: stub, enumerable: true, configurable: true, writable: true }
        : undefined,
    apply: () => stub,
  });

  return stub;
}

function show(value: unknown): string {
  return inspect(value, { depth: 4, breakLength: Infinity });
}

function message(error: unknown): string {
  return error instanceof Error
    ? (error.message.split('\n')[0] ?? '')
    : String(error);
}
