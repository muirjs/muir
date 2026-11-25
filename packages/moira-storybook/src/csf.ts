import { basename, dirname, resolve, win32 } from 'node:path';

import {
  muirMoiraStorybookWithoutBinding,
  type MuirMoiraStorybookBindings,
} from './bindings.ts';
import {
  muirMoiraStorybookAssignmentOf,
  muirMoiraStorybookDeclarationOf,
  muirMoiraStorybookIsStoryFactoryCall,
  muirMoiraStorybookStoryArgument,
  muirMoiraStorybookUnwrap,
  type MuirMoiraStorybookAssignment,
} from './csf-nodes.ts';
import { muirMoiraStorybookNamesReadElsewhere } from './names-read-elsewhere.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import {
  muirMoiraStorybookEveryRecordIn,
  muirMoiraStorybookLoadedSpecifierOf,
} from './node-tree.ts';
import {
  muirMoiraStorybookIsObjectLiteral,
  muirMoiraStorybookWrittenValue,
  type MuirMoiraStorybookObjectLiteral,
} from './object-value.ts';

export interface MuirMoiraStorybookIndexedStory {
  /** The story's static tags, the meta's first. */
  readonly tags: readonly string[];
  /** The name of each `.test()` call on the story that the index lists. */
  readonly tests: readonly unknown[];
}

export interface MuirMoiraStorybookCsfShapes {
  readonly metaObjects: ReadonlySet<unknown>;
  /** Story objects and functions, `parameters` objects that hold `__id`, and `.test()` options objects. */
  readonly literalContainers: ReadonlySet<unknown>;
  readonly testCode: ReadonlySet<unknown>;
  /** The statements of `.test()` calls with options, which are test code apart from the options. */
  readonly testStatementsWithOptions: ReadonlySet<unknown>;
  readonly mswValues: ReadonlySet<unknown>;
  readonly staticValues: ReadonlySet<unknown>;
}

const testKeys: readonly string[] = ['play', 'beforeEach', 'afterEach'];
const staticKeys: readonly string[] = [
  'title',
  'id',
  'tags',
  'includeStories',
  'excludeStories',
  'name',
  'storyName',
];

export function muirMoiraStorybookCsfShapes(
  program: unknown,
): MuirMoiraStorybookCsfShapes {
  const body = muirMoiraStorybookList(muirMoiraStorybookField(program, 'body'));
  const bindings = muirMoiraStorybookTopLevelBindings(body);
  const specifiers = body.flatMap((statement) =>
    muirMoiraStorybookList(muirMoiraStorybookField(statement, 'specifiers')),
  );
  const { metas, stories: exported } = muirMoiraStorybookCsfFile(
    body,
    bindings,
  );
  const metaObjects: readonly unknown[] = metas.map(({ object }) => object);
  const assignments = exported.flatMap((story) => story.assignments);
  const runtime = exported.flatMap((story) => story.runtimeAssignments);
  const stories = [
    ...exported.map(({ init }) => init),
    ...assignedIn(assignments, 'story').map(({ value }) => value),
  ]
    .map((init) => storyNode(muirMoiraStorybookUnwrap(init), bindings))
    .filter(
      (init) =>
        (muirMoiraStorybookIsObjectLiteral(init) ||
          muirMoiraStorybookField(init, 'type') ===
            'ArrowFunctionExpression') &&
        !metaObjects.includes(init),
    );
  const annotationsIn = (
    from: readonly MuirMoiraStorybookAssignment[],
    key: string,
  ): readonly unknown[] =>
    [
      ...[...metaObjects, ...stories].map((owner) =>
        muirMoiraStorybookWrittenValue(owner, key),
      ),
      ...assignedIn(from, key).map(({ value }) => value),
    ].flatMap((value) => withInit(value, bindings));
  const testCodeOf = (key: string): readonly unknown[] => [
    ...annotationsIn(runtime, key),
    ...assignedIn(runtime, key).map(({ statement }) => statement),
  ];
  const locals = exported.map(({ local }) => local);
  const idParameters = stories
    .map((story) => muirMoiraStorybookWrittenValue(story, 'parameters'))
    .filter(
      (parameters) =>
        muirMoiraStorybookWrittenValue(parameters, '__id') !== undefined,
    );
  const calls = body.flatMap(muirMoiraStorybookTestCallOf);
  const testCalls = locals
    .flatMap((local) =>
      muirMoiraStorybookFirstTestCalls(
        calls.filter(({ target }) => target === local),
      ),
    )
    .flatMap((call) => {
      // Storybook 10.6.5 CsfFile indexes a .test() call only with two or more arguments; a spread counts as one.
      if (call.args.length < 2) {
        return [];
      }

      const { options, testFunction } = muirMoiraStorybookTestArguments(call);

      return [
        {
          statement: call.statement,
          name: call.args[0],
          options: followed(options, bindings),
          testFunction: followed(testFunction, bindings),
        },
      ];
    });

  return {
    metaObjects: new Set(metaObjects),
    literalContainers: new Set([
      ...stories,
      ...idParameters,
      ...testCalls.map(({ options }) => options),
    ]),
    testCode: new Set([
      ...testKeys.flatMap((key) => testCodeOf(key)),
      ...testCalls.flatMap(({ statement, options, testFunction }) =>
        options === undefined ? [statement, testFunction] : [testFunction],
      ),
    ]),
    testStatementsWithOptions: new Set(
      testCalls.flatMap(({ statement, options }) =>
        options === undefined ? [] : [statement],
      ),
    ),
    mswValues: new Set(
      annotationsIn(runtime, 'parameters').flatMap((parameters) =>
        withInit(muirMoiraStorybookWrittenValue(parameters, 'msw'), bindings),
      ),
    ),
    staticValues: new Set([
      ...staticKeys.flatMap((key) => annotationsIn(assignments, key)),
      ...idParameters.map((parameters) =>
        muirMoiraStorybookWrittenValue(parameters, '__id'),
      ),
      bindings.get('__namedExportsOrder'),
      ...testCalls.flatMap(({ name, options }) => [
        name,
        ...withInit(muirMoiraStorybookWrittenValue(options, 'tags'), bindings),
      ]),
      ...specifiers.map((specifier) =>
        muirMoiraStorybookField(specifier, 'exported'),
      ),
    ]),
  };
}

function assignedIn(
  from: readonly MuirMoiraStorybookAssignment[],
  key: string,
): readonly MuirMoiraStorybookAssignment[] {
  return from.filter(({ path }) => path.length === 1 && path[0] === key);
}

export function muirMoiraStorybookDefaultExport(
  body: readonly unknown[],
): unknown {
  const declaration = muirMoiraStorybookField(
    body.find(
      (statement) =>
        muirMoiraStorybookField(statement, 'type') ===
        'ExportDefaultDeclaration',
    ),
    'declaration',
  );

  return (
    declaration ?? muirMoiraStorybookField(defaultSpecifier(body), 'local')
  );
}

function defaultSpecifier(body: readonly unknown[]): unknown {
  return body
    .flatMap((statement) =>
      muirMoiraStorybookList(muirMoiraStorybookField(statement, 'specifiers')),
    )
    .find(
      (specifier) =>
        (muirMoiraStorybookField(specifier, 'exported', 'name') ??
          muirMoiraStorybookField(specifier, 'exported', 'value')) ===
        'default',
    );
}

/** Storybook 10.6.5's Vitest transform names the meta only through `export default`, so it fails on a meta object exported by specifier as default and tests no story. */
function isMetaObjectExportedBySpecifier(
  body: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
): boolean {
  return muirMoiraStorybookIsObjectLiteral(
    muirMoiraStorybookUnwrap(
      followed(
        muirMoiraStorybookField(defaultSpecifier(body), 'local'),
        bindings,
      ),
    ),
  );
}

/** The family name of the default export, which no identifier can have. */
const defaultExportName = Symbol('export default');

/** The owner, as `MetaObject.owner` names it, of the meta a story is made from, given the initializer `extendLevels` ends its chain at: the default export's for a CSF3 story, the name a `.story()` call is made on for a factory story. */
export function muirMoiraStorybookStoryMetaOwner(rootInit: unknown): unknown {
  const call = muirMoiraStorybookUnwrap(rootInit);

  return muirMoiraStorybookIsStoryFactoryCall(call)
    ? muirMoiraStorybookField(call, 'callee', 'object', 'name')
    : defaultExportName;
}

export interface MuirMoiraStorybookCsfFile {
  /** Each meta object with the family name a write to it marks in `written`: the default export's, or the factory meta's local name. */
  readonly metas: readonly MuirMoiraStorybookMetaObject[];
  readonly stories: readonly MuirMoiraStorybookStoryExport[];
  /** The top-level names in a family with a written member, a name assigned to a member the file writes below or whose object it hands on included, so what the file declares for them is not what runs. */
  readonly written: ReadonlySet<unknown>;
  /** The top-level names another top-level object or meta reads when the file loads, so what they hold also reaches code outside their own runs. */
  readonly readByOtherObjects: ReadonlySet<unknown>;
}

export interface MuirMoiraStorybookMetaObject {
  readonly object: MuirMoiraStorybookObjectLiteral;
  readonly owner: unknown;
}

/** `index` gives the stories and their `.test()` children, as Storybook's story index lists them, in place of the package's own reading of the exports. */
export function muirMoiraStorybookCsfFile(
  body: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
  index?: ReadonlyMap<string, MuirMoiraStorybookIndexedStory>,
): MuirMoiraStorybookCsfFile {
  const factories = factoryMetas(body, bindings);
  const isFactoryFile = factories.length > 0;
  const metaBindings: readonly (readonly [unknown, unknown])[] = [
    [defaultExportName, muirMoiraStorybookDefaultExport(body)],
    ...[...bindings]
      .filter(([, init]) => factories.includes(init))
      .map(
        ([name, init]) =>
          [
            name,
            muirMoiraStorybookList(
              muirMoiraStorybookField(init, 'arguments'),
            )[0],
          ] as const,
      ),
  ];
  const metas = metaBindings.flatMap(([owner, meta]) =>
    objectOf(meta, bindings).map((object) => ({ object, owner })),
  );
  const {
    usedOutsideReadForms,
    sharingWithWritten,
    written,
    readByOtherObjects,
  } = muirMoiraStorybookNamesReadElsewhere(body, bindings, metaBindings);

  return {
    metas,
    stories: storyExports(
      body,
      bindings,
      isFactoryFile,
      index === undefined
        ? storyFilter(
            metas.map(({ object }) => object),
            isFactoryFile,
          )
        : ({ name }) => index.has(name),
      (name) => muirMoiraStorybookList(index?.get(name)?.tests),
      (local) =>
        metaBindings.some(([name]) => written.has(name)) ||
        usedOutsideReadForms.has(local) ||
        sharingWithWritten.has(local),
    ),
    written,
    readByOtherObjects,
  };
}

function storyFilter(
  metaObjects: readonly unknown[],
  isFactoryFile: boolean,
): (named: MuirMoiraStorybookNamedExport) => boolean {
  const [includeStories, excludeStories] = [
    'includeStories',
    'excludeStories',
  ].map((key) =>
    metaObjects
      .map((meta) => muirMoiraStorybookWrittenValue(meta, key))
      .find((value) => value !== undefined),
  );

  return ({ name, init }) =>
    name !== '__namedExportsOrder' &&
    isExportStory(name, includeStories, excludeStories) &&
    (!isFactoryFile ||
      muirMoiraStorybookIsStoryFactoryCall(muirMoiraStorybookUnwrap(init)));
}

function storyExports(
  body: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
  isFactoryFile: boolean,
  isStory: (named: MuirMoiraStorybookNamedExport) => boolean,
  testNames: (name: string) => readonly unknown[],
  isReferencedElsewhere: (local: unknown) => boolean,
): readonly MuirMoiraStorybookStoryExport[] {
  const assignments = body.flatMap(muirMoiraStorybookAssignmentOf);
  const testCalls = body.flatMap(muirMoiraStorybookTestCallOf);
  const metaBySpecifier = isMetaObjectExportedBySpecifier(body, bindings);

  return muirMoiraStorybookNamedExports(body, bindings)
    .filter(isStory)
    .map(({ name, local, init, form }) => {
      const storyAssignments = assignments.filter(
        ({ target }) => target === local,
      );
      const storyCalls = testCalls.filter(({ target }) => target === local);

      return {
        name,
        local,
        init,
        children: muirMoiraStorybookIsStoryFactoryCall(
          muirMoiraStorybookUnwrap(init),
        )
          ? testNames(name).map((testName) => childOf(testName, storyCalls))
          : [],
        tested:
          !metaBySpecifier &&
          (form === 'declaration' ||
            (init !== undefined &&
              muirMoiraStorybookField(init, 'type') !== 'FunctionDeclaration')),
        referencedElsewhere: isReferencedElsewhere(local),
        assignments: storyAssignments,
        runtimeAssignments: runtimeAssignments(storyAssignments, isFactoryFile),
        extendsBase:
          muirMoiraStorybookField(
            muirMoiraStorybookUnwrap(init),
            'callee',
            'property',
            'name',
          ) === 'extend',
      };
    });
}

export interface MuirMoiraStorybookStoryExport {
  readonly name: string;
  readonly local: unknown;
  readonly init: unknown;
  /** Each `.test()` child of a factory story that the index lists; Storybook 10.6.5 runs other stories' `.test()` calls as the story itself. */
  readonly children: readonly MuirMoiraStorybookTestChild[];
  /** Storybook 10.6.5's Vitest transform tests a story only when the file's meta object is not exported by specifier and the story's export declares it or names a local variable. */
  readonly tested: boolean;
  /** The file names the story outside its declaration, its export, the `.test()` calls Storybook 10.6.5 CsfFile indexes and their arguments, member assignments and the values of top-level objects and `.story()` or `.extend()` calls, or writes to a top-level object that shares nested objects with it or with the meta, so what runs can differ from what the package reads. */
  readonly referencedElsewhere: boolean;
  readonly assignments: readonly MuirMoiraStorybookAssignment[];
  /** The writes that the story Storybook runs is composed from, with a factory story's `input` stripped from the path. */
  readonly runtimeAssignments: readonly MuirMoiraStorybookAssignment[];
  /** Storybook 10.6.5 `extend()` merges the base story into the new input at run time, so the argument is only part of the story. */
  readonly extendsBase: boolean;
}

/** The options argument (`undefined` for a call without one) and the test function of a story's `.test()` call, or `'unmatched'` when that call or its arguments cannot be told. */
export type MuirMoiraStorybookTestChild =
  | MuirMoiraStorybookTestArguments
  | 'unmatched';

export interface MuirMoiraStorybookTestArguments {
  readonly options: unknown;
  readonly testFunction: unknown;
}

const functionTypes: readonly unknown[] = [
  'ArrowFunctionExpression',
  'FunctionExpression',
];

/** The options and test function of a `.test(name, [options,] fn)` call, as Storybook 10.6.5 `test()` reads them: the second argument is the test function when it is the last or a function, else the options, and any later argument is ignored. */
export function muirMoiraStorybookTestArguments({
  args,
}: MuirMoiraStorybookTestCall): MuirMoiraStorybookTestArguments {
  const [, second, third] = args;

  return third === undefined ||
    functionTypes.includes(muirMoiraStorybookField(second, 'type'))
    ? { options: undefined, testFunction: second }
    : { options: second, testFunction: third };
}

/** The first `.test()` call of each name, as Storybook 10.6.5 test-utils.ts `testStory` runs the first child that has the row's name; its CsfFile indexes only a call whose name is a string literal. */
export function muirMoiraStorybookFirstTestCalls(
  calls: readonly MuirMoiraStorybookTestCall[],
): readonly MuirMoiraStorybookTestCall[] {
  const named = calls.filter(
    ({ args: [name] }) =>
      muirMoiraStorybookField(name, 'type') === 'StringLiteral',
  );

  return named.filter(
    ({ args: [name] }, index) =>
      named.findIndex(
        ({ args: [other] }) =>
          muirMoiraStorybookField(other, 'value') ===
          muirMoiraStorybookField(name, 'value'),
      ) === index,
  );
}

function childOf(
  testName: unknown,
  calls: readonly MuirMoiraStorybookTestCall[],
): MuirMoiraStorybookTestChild {
  const call = muirMoiraStorybookFirstTestCalls(calls).find(
    ({ args: [name] }) => muirMoiraStorybookField(name, 'value') === testName,
  );

  return call === undefined
    ? 'unmatched'
    : muirMoiraStorybookTestArguments(call);
}

const previewPath = /\/preview(.(js|jsx|mjs|ts|tsx))?$/;

/** Storybook 10.6.5 CsfFile: a top-level `X.meta()` or `X.type().meta()` call, where `X` is imported from a preview file. */
function factoryMetas(
  body: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
): readonly unknown[] {
  const importSources = new Map(
    body
      .filter(
        (statement) =>
          muirMoiraStorybookField(statement, 'type') === 'ImportDeclaration',
      )
      .flatMap((statement) =>
        muirMoiraStorybookList(
          muirMoiraStorybookField(statement, 'specifiers'),
        ).map(
          (specifier) =>
            [
              muirMoiraStorybookField(specifier, 'local', 'name'),
              muirMoiraStorybookField(statement, 'source', 'value'),
            ] as const,
        ),
      ),
  );

  return [...bindings.values()].filter((init) => {
    const object = muirMoiraStorybookField(init, 'callee', 'object');
    const root =
      muirMoiraStorybookField(object, 'type') === 'CallExpression'
        ? muirMoiraStorybookField(object, 'callee', 'object')
        : object;
    const source = importSources.get(muirMoiraStorybookField(root, 'name'));

    return (
      muirMoiraStorybookField(init, 'callee', 'property', 'name') === 'meta' &&
      typeof source === 'string' &&
      previewPath.test(source)
    );
  });
}

export interface MuirMoiraStorybookNamedExport {
  readonly name: string;
  readonly local: unknown;
  readonly init: unknown;
  readonly form: 'declaration' | 'specifier';
  /** `export type`, `export { type A }` or `export declare`, which TypeScript erases. */
  readonly typeOnly: boolean;
}

export function muirMoiraStorybookNamedExports(
  body: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
): readonly MuirMoiraStorybookNamedExport[] {
  return body
    .flatMap((statement) => {
      const typeOnly =
        muirMoiraStorybookField(statement, 'exportKind') === 'type';

      return [
        ...muirMoiraStorybookList(
          muirMoiraStorybookField(statement, 'declaration', 'declarations'),
        ).map((declarator) => ({
          name: muirMoiraStorybookField(declarator, 'id', 'name'),
          local: muirMoiraStorybookField(declarator, 'id', 'name'),
          init: muirMoiraStorybookField(declarator, 'init'),
          form: 'declaration' as const,
          typeOnly,
        })),
        ...(muirMoiraStorybookField(statement, 'declaration', 'type') ===
        'FunctionDeclaration'
          ? [
              {
                name: muirMoiraStorybookField(
                  statement,
                  'declaration',
                  'id',
                  'name',
                ),
                local: muirMoiraStorybookField(
                  statement,
                  'declaration',
                  'id',
                  'name',
                ),
                init: muirMoiraStorybookField(statement, 'declaration'),
                form: 'declaration' as const,
                typeOnly,
              },
            ]
          : []),
        ...muirMoiraStorybookList(
          muirMoiraStorybookField(statement, 'specifiers'),
        ).map((specifier) => ({
          name:
            muirMoiraStorybookField(specifier, 'exported', 'name') ??
            muirMoiraStorybookField(specifier, 'exported', 'value'),
          local: muirMoiraStorybookField(specifier, 'local', 'name'),
          init:
            muirMoiraStorybookField(specifier, 'local', 'type') === 'Identifier'
              ? followed(muirMoiraStorybookField(specifier, 'local'), bindings)
              : undefined,
          form: 'specifier' as const,
          typeOnly:
            typeOnly ||
            muirMoiraStorybookField(specifier, 'exportKind') === 'type',
        })),
      ];
    })
    .flatMap(({ name, ...named }) =>
      typeof name === 'string' && name !== 'default'
        ? [{ name, ...named }]
        : [],
    );
}

export function muirMoiraStorybookTopLevelBindings(
  body: readonly unknown[],
): MuirMoiraStorybookBindings {
  return new Map(
    body.flatMap((statement) => {
      const declaration = muirMoiraStorybookDeclarationOf(statement);
      const functionName = muirMoiraStorybookField(declaration, 'id', 'name');

      if (
        muirMoiraStorybookField(declaration, 'type') ===
          'FunctionDeclaration' &&
        typeof functionName === 'string'
      ) {
        return [[functionName, declaration] as const];
      }

      return muirMoiraStorybookList(
        muirMoiraStorybookField(declaration, 'declarations'),
      ).flatMap((declarator) => {
        const name = muirMoiraStorybookField(declarator, 'id', 'name');
        const init = muirMoiraStorybookField(declarator, 'init');

        return typeof name === 'string' && init !== null
          ? [[name, init] as const]
          : [];
      });
    }),
  );
}

/** The top-level bindings whose value the file leaves as declared: none in its `written` set, which holds every name it writes, reassigns or hands to code it does not read. */
export function muirMoiraStorybookUnchangedBindings(
  bindings: MuirMoiraStorybookBindings,
  written: ReadonlySet<unknown>,
): MuirMoiraStorybookBindings {
  return new Map([...bindings].filter(([name]) => !written.has(name)));
}

/** `value` is an export specifier's local, a call argument, a property or assigned value, or a `.bind()` callee's object; of these only an Identifier has a string `name`. */
function followed(
  value: unknown,
  bindings: MuirMoiraStorybookBindings,
): unknown {
  const name = muirMoiraStorybookField(value, 'name');

  return typeof name === 'string' ? bindings.get(name) : value;
}

/** A name's top-level value; a name the file does not bind, or any other node, as it is. */
export function muirMoiraStorybookTopLevelValueOrSelf(
  node: unknown,
  bindings: MuirMoiraStorybookBindings,
): unknown {
  const name = muirMoiraStorybookField(node, 'name');

  return (typeof name === 'string' ? bindings.get(name) : undefined) ?? node;
}

function withInit(
  value: unknown,
  bindings: MuirMoiraStorybookBindings,
): readonly unknown[] {
  return [value, followed(value, bindings)];
}

function isExportStory(
  name: unknown,
  includeStories: unknown,
  excludeStories: unknown,
): boolean {
  return (
    (includeStories === undefined || matchesStories(name, includeStories)) &&
    !matchesStories(name, excludeStories)
  );
}

function matchesStories(name: unknown, descriptor: unknown): boolean {
  if (muirMoiraStorybookField(descriptor, 'type') === 'ArrayExpression') {
    return muirMoiraStorybookList(
      muirMoiraStorybookField(descriptor, 'elements'),
    ).some((element) => muirMoiraStorybookField(element, 'value') === name);
  }

  const pattern =
    muirMoiraStorybookField(descriptor, 'type') === 'StringLiteral'
      ? muirMoiraStorybookField(descriptor, 'value')
      : muirMoiraStorybookField(descriptor, 'pattern');
  const flags = muirMoiraStorybookField(descriptor, 'flags') ?? '';

  return (
    typeof name === 'string' &&
    typeof pattern === 'string' &&
    typeof flags === 'string' &&
    new RegExp(pattern, flags).test(name)
  );
}

/** Storybook 10.6.5 composes a factory story from the keys of the `input` that `defineStory` closed over, so only writes below `input` count. */
function runtimeAssignments(
  assignments: readonly MuirMoiraStorybookAssignment[],
  isFactory: boolean,
): readonly MuirMoiraStorybookAssignment[] {
  if (!isFactory) {
    return assignments;
  }

  return assignments.flatMap((assignment) =>
    assignment.path[0] === 'input' && assignment.path.length > 1
      ? [{ ...assignment, path: assignment.path.slice(1) }]
      : [],
  );
}

export interface MuirMoiraStorybookTestCall {
  readonly statement: unknown;
  readonly target: unknown;
  readonly args: readonly unknown[];
}

export function muirMoiraStorybookTestCallOf(
  statement: unknown,
): readonly MuirMoiraStorybookTestCall[] {
  const callee = muirMoiraStorybookField(statement, 'expression', 'callee');

  return muirMoiraStorybookField(callee, 'property', 'name') === 'test'
    ? [
        {
          statement,
          target: muirMoiraStorybookField(callee, 'object', 'name'),
          args: muirMoiraStorybookList(
            muirMoiraStorybookField(statement, 'expression', 'arguments'),
          ),
        },
      ]
    : [];
}

/** The file holds a relative string literal that names this file in any letter case, loads a module whose specifier is not a string literal or is a path whose last segment names this file, or calls `import.meta.glob`. Storybook 10.6.5's Vitest transform composes each story from the file's own bindings, so a write through an import of the file itself changes what runs without naming the story. */
export function muirMoiraStorybookMayImportItself(
  body: readonly unknown[],
  fileName: string,
): boolean {
  const file = resolve(fileName).toLowerCase();
  const withoutExtension = withoutScriptExtension(file);
  const baseName = basename(withoutExtension);
  // Vite resolves a relative path from the file's folder, and a .js, .jsx, .mjs or .cjs one to the TypeScript file
  // of the same name. Any other path may be the file under a root, alias or drive when its last segment names it; a
  // bare package name such as 'Button.stories' is a package's entry.
  const namesThisFile = (path: string): boolean =>
    path.startsWith('.')
      ? withoutScriptExtension(resolve(dirname(file), path.toLowerCase())) ===
        withoutExtension
      : /[\\/]/.test(path) &&
        withoutScriptExtension(win32.basename(path.toLowerCase())) === baseName;

  return muirMoiraStorybookEveryRecordIn(body).some((node) => {
    const held = stringLiteralValue(node);

    // A relative string counts wherever the file holds it, as a vi.mock path or a name passed to import() later; a
    // non-relative one only where the file loads it, since titles and parameters hold such paths too.
    if (held?.startsWith('.') === true && namesThisFile(held)) {
      return true;
    }

    const specifier = muirMoiraStorybookLoadedSpecifierOf(node);

    if (specifier !== undefined) {
      const loaded = stringLiteralValue(specifier);

      return loaded === undefined || namesThisFile(loaded);
    }

    return isImportMetaGlob(node);
  });
}

function stringLiteralValue(node: unknown): string | undefined {
  const value = muirMoiraStorybookField(node, 'value');

  return muirMoiraStorybookField(node, 'type') === 'StringLiteral' &&
    typeof value === 'string'
    ? value
    : undefined;
}

function withoutScriptExtension(path: string): string {
  return path.replace(/\.[cm]?[jt]sx?$/, '');
}

/** A call of `import.meta.glob`: only a `MetaProperty` node has a `meta` field. */
function isImportMetaGlob(node: unknown): boolean {
  return (
    muirMoiraStorybookField(node, 'callee', 'object', 'meta', 'name') ===
      'import' &&
    muirMoiraStorybookField(node, 'callee', 'property', 'name') === 'glob'
  );
}

function storyNode(
  init: unknown,
  bindings: MuirMoiraStorybookBindings,
): unknown {
  if (muirMoiraStorybookIsTemplateBind(init)) {
    return followed(
      muirMoiraStorybookField(init, 'callee', 'object'),
      bindings,
    );
  }

  return muirMoiraStorybookStoryArgument(init);
}

export function muirMoiraStorybookIsTemplateBind(init: unknown): boolean {
  const [context, ...more] = muirMoiraStorybookList(
    muirMoiraStorybookField(init, 'arguments'),
  );

  return (
    muirMoiraStorybookField(init, 'callee', 'property', 'name') === 'bind' &&
    more.length === 0 &&
    (context === undefined ||
      (muirMoiraStorybookIsObjectLiteral(context) &&
        muirMoiraStorybookList(muirMoiraStorybookField(context, 'properties'))
          .length === 0))
  );
}

function objectOf(
  expression: unknown,
  bindings: MuirMoiraStorybookBindings,
): readonly MuirMoiraStorybookObjectLiteral[] {
  const node = muirMoiraStorybookUnwrap(expression);

  if (muirMoiraStorybookIsObjectLiteral(node)) {
    return [node];
  }

  return muirMoiraStorybookField(node, 'type') === 'Identifier'
    ? objectOf(
        followed(node, bindings),
        muirMoiraStorybookWithoutBinding(
          bindings,
          muirMoiraStorybookField(node, 'name'),
        ),
      )
    : [];
}
