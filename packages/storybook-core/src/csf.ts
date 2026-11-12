import { dirname, extname, resolve } from 'node:path';

import { withoutBinding, type Bindings } from './bindings.ts';
import {
  assignmentOf,
  declarationOf,
  isStoryFactoryCall,
  storyArgument,
  unwrap,
  type Assignment,
} from './csf-nodes.ts';
import { isRecord } from './is-record.ts';
import { namesReadElsewhere } from './names-read-elsewhere.ts';
import { field, list } from './node-field.ts';
import {
  isObjectLiteral,
  writtenValue,
  type ObjectLiteral,
} from './object-value.ts';

export interface IndexedStory {
  /** The story's static tags, the meta's first. */
  readonly tags: readonly string[];
  /** The name of each `.test()` call on the story that the index lists. */
  readonly tests: readonly unknown[];
}

export interface CsfShapes {
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

export function csfShapes(program: unknown): CsfShapes {
  const body = list(field(program, 'body'));
  const bindings = topLevelBindings(body);
  const specifiers = body.flatMap((statement) =>
    list(field(statement, 'specifiers')),
  );
  const { metas, stories: exported } = csfFile(body, bindings);
  const metaObjects: readonly unknown[] = metas.map(({ object }) => object);
  const assignments = exported.flatMap((story) => story.assignments);
  const runtime = exported.flatMap((story) => story.runtimeAssignments);
  const stories = [
    ...exported.map(({ init }) => init),
    ...assignedIn(assignments, 'story').map(({ value }) => value),
  ]
    .map((init) => storyNode(unwrap(init), bindings))
    .filter(
      (init) =>
        (field(init, 'type') === 'ObjectExpression' ||
          field(init, 'type') === 'ArrowFunctionExpression') &&
        !metaObjects.includes(init),
    );
  const annotationsIn = (
    from: readonly Assignment[],
    key: string,
  ): readonly unknown[] =>
    [
      ...[...metaObjects, ...stories].map((owner) => writtenValue(owner, key)),
      ...assignedIn(from, key).map(({ value }) => value),
    ].flatMap((value) => withInit(value, bindings));
  const testCodeOf = (key: string): readonly unknown[] => [
    ...annotationsIn(runtime, key),
    ...assignedIn(runtime, key).map(({ statement }) => statement),
  ];
  const locals = exported.map(({ local }) => local);
  const idParameters = stories
    .map((story) => writtenValue(story, 'parameters'))
    .filter((parameters) => writtenValue(parameters, '__id') !== undefined);
  const calls = body.flatMap(testCallOf);
  const testCalls = locals
    .flatMap((local) =>
      firstTestCalls(calls.filter(({ target }) => target === local)),
    )
    .flatMap((call) => {
      // Storybook 10.6.5 CsfFile indexes a .test() call only with two or more arguments; a spread counts as one.
      if (call.args.length < 2) {
        return [];
      }

      const { options, testFunction } = testArguments(call);

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
        withInit(writtenValue(parameters, 'msw'), bindings),
      ),
    ),
    staticValues: new Set([
      ...staticKeys.flatMap((key) => annotationsIn(assignments, key)),
      ...idParameters.map((parameters) => writtenValue(parameters, '__id')),
      bindings.get('__namedExportsOrder'),
      ...testCalls.flatMap(({ name, options }) => [
        name,
        ...withInit(writtenValue(options, 'tags'), bindings),
      ]),
      ...specifiers.map((specifier) => field(specifier, 'exported')),
    ]),
  };
}

function assignedIn(
  from: readonly Assignment[],
  key: string,
): readonly Assignment[] {
  return from.filter(({ path }) => path.length === 1 && path[0] === key);
}

export function defaultExport(body: readonly unknown[]): unknown {
  const declaration = field(
    body.find(
      (statement) => field(statement, 'type') === 'ExportDefaultDeclaration',
    ),
    'declaration',
  );

  return declaration ?? field(defaultSpecifier(body), 'local');
}

function defaultSpecifier(body: readonly unknown[]): unknown {
  return body
    .flatMap((statement) => list(field(statement, 'specifiers')))
    .find(
      (specifier) =>
        (field(specifier, 'exported', 'name') ??
          field(specifier, 'exported', 'value')) === 'default',
    );
}

/** Storybook 10.6.5's Vitest transform names the meta only through `export default`, so it fails on a meta object exported by specifier as default and tests no story. */
function isMetaObjectExportedBySpecifier(
  body: readonly unknown[],
  bindings: Bindings,
): boolean {
  return (
    field(
      unwrap(followed(field(defaultSpecifier(body), 'local'), bindings)),
      'type',
    ) === 'ObjectExpression'
  );
}

/** The family name of the default export, which no identifier can have. */
const defaultExportName = Symbol('export default');

export interface CsfFile {
  /** Each meta object with the family name a write to it marks in `written`: the default export's, or the factory meta's local name. */
  readonly metas: readonly MetaObject[];
  readonly stories: readonly StoryExport[];
  /** The top-level names in a family with a written member, a name assigned to a member the file writes below or whose object it hands on included, so what the file declares for them is not what runs. */
  readonly written: ReadonlySet<unknown>;
  /** The top-level names another top-level object or meta reads when the file loads, so what they hold also reaches code outside their own runs. */
  readonly readByOtherObjects: ReadonlySet<unknown>;
}

export interface MetaObject {
  readonly object: ObjectLiteral;
  readonly owner: unknown;
}

/** `index` gives the stories and their `.test()` children, as Storybook's story index lists them, in place of the package's own reading of the exports. */
export function csfFile(
  body: readonly unknown[],
  bindings: Bindings,
  index?: ReadonlyMap<string, IndexedStory>,
): CsfFile {
  const factories = factoryMetas(body, bindings);
  const isFactoryFile = factories.length > 0;
  const metaBindings: readonly (readonly [unknown, unknown])[] = [
    [defaultExportName, defaultExport(body)],
    ...[...bindings]
      .filter(([, init]) => factories.includes(init))
      .map(
        ([name, init]) => [name, list(field(init, 'arguments'))[0]] as const,
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
  } = namesReadElsewhere(body, bindings, metaBindings);

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
      (name) => list(index?.get(name)?.tests),
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
): (named: NamedExport) => boolean {
  const [includeStories, excludeStories] = [
    'includeStories',
    'excludeStories',
  ].map((key) =>
    metaObjects
      .map((meta) => writtenValue(meta, key))
      .find((value) => value !== undefined),
  );

  return ({ name, init }) =>
    name !== '__namedExportsOrder' &&
    isExportStory(name, includeStories, excludeStories) &&
    (!isFactoryFile || isStoryFactoryCall(unwrap(init)));
}

function storyExports(
  body: readonly unknown[],
  bindings: Bindings,
  isFactoryFile: boolean,
  isStory: (named: NamedExport) => boolean,
  testNames: (name: string) => readonly unknown[],
  isReferencedElsewhere: (local: unknown) => boolean,
): readonly StoryExport[] {
  const assignments = body.flatMap(assignmentOf);
  const testCalls = body.flatMap(testCallOf);
  const metaBySpecifier = isMetaObjectExportedBySpecifier(body, bindings);

  return namedExports(body, bindings)
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
        children: isStoryFactoryCall(unwrap(init))
          ? testNames(name).map((testName) => childOf(testName, storyCalls))
          : [],
        tested:
          !metaBySpecifier &&
          (form === 'declaration' ||
            (init !== undefined &&
              field(init, 'type') !== 'FunctionDeclaration')),
        referencedElsewhere: isReferencedElsewhere(local),
        assignments: storyAssignments,
        runtimeAssignments: runtimeAssignments(storyAssignments, isFactoryFile),
        extendsBase:
          field(unwrap(init), 'callee', 'property', 'name') === 'extend',
      };
    });
}

export interface StoryExport {
  readonly name: string;
  readonly local: unknown;
  readonly init: unknown;
  /** Each `.test()` child of a factory story that the index lists; Storybook 10.6.5 runs other stories' `.test()` calls as the story itself. */
  readonly children: readonly TestChild[];
  /** Storybook 10.6.5's Vitest transform tests a story only when the file's meta object is not exported by specifier and the story's export declares it or names a local variable. */
  readonly tested: boolean;
  /** The file names the story outside its declaration, its export, the `.test()` calls Storybook 10.6.5 CsfFile indexes and their arguments, member assignments and the values of top-level objects and `.story()` or `.extend()` calls, or writes to a top-level object that shares nested objects with it or with the meta, so what runs can differ from what the package reads. */
  readonly referencedElsewhere: boolean;
  readonly assignments: readonly Assignment[];
  /** The writes that the story Storybook runs is composed from, with a factory story's `input` stripped from the path. */
  readonly runtimeAssignments: readonly Assignment[];
  /** Storybook 10.6.5 `extend()` merges the base story into the new input at run time, so the argument is only part of the story. */
  readonly extendsBase: boolean;
}

/** The options argument (`undefined` for a call without one) and the test function of a story's `.test()` call, or `'unmatched'` when that call or its arguments cannot be told. */
export type TestChild = TestArguments | 'unmatched';

export interface TestArguments {
  readonly options: unknown;
  readonly testFunction: unknown;
}

const functionTypes: readonly unknown[] = [
  'ArrowFunctionExpression',
  'FunctionExpression',
];

/** The options and test function of a `.test(name, [options,] fn)` call, as Storybook 10.6.5 `test()` reads them: the second argument is the test function when it is the last or a function, else the options, and any later argument is ignored. */
export function testArguments({ args }: TestCall): TestArguments {
  const [, second, third] = args;

  return third === undefined || functionTypes.includes(field(second, 'type'))
    ? { options: undefined, testFunction: second }
    : { options: second, testFunction: third };
}

/** The first `.test()` call of each name, as Storybook 10.6.5 test-utils.ts `testStory` runs the first child that has the row's name; its CsfFile indexes only a call whose name is a string literal. */
export function firstTestCalls(
  calls: readonly TestCall[],
): readonly TestCall[] {
  const named = calls.filter(
    ({ args: [name] }) => field(name, 'type') === 'StringLiteral',
  );

  return named.filter(
    ({ args: [name] }, index) =>
      named.findIndex(
        ({ args: [other] }) => field(other, 'value') === field(name, 'value'),
      ) === index,
  );
}

function childOf(testName: unknown, calls: readonly TestCall[]): TestChild {
  const call = firstTestCalls(calls).find(
    ({ args: [name] }) => field(name, 'value') === testName,
  );

  return call === undefined ? 'unmatched' : testArguments(call);
}

const previewPath = /\/preview(.(js|jsx|mjs|ts|tsx))?$/;

/** Storybook 10.6.5 CsfFile: a top-level `X.meta()` or `X.type().meta()` call, where `X` is imported from a preview file. */
function factoryMetas(
  body: readonly unknown[],
  bindings: Bindings,
): readonly unknown[] {
  const importSources = new Map(
    body
      .filter((statement) => field(statement, 'type') === 'ImportDeclaration')
      .flatMap((statement) =>
        list(field(statement, 'specifiers')).map(
          (specifier) =>
            [
              field(specifier, 'local', 'name'),
              field(statement, 'source', 'value'),
            ] as const,
        ),
      ),
  );

  return [...bindings.values()].filter((init) => {
    const object = field(init, 'callee', 'object');
    const root =
      field(object, 'type') === 'CallExpression'
        ? field(object, 'callee', 'object')
        : object;
    const source = importSources.get(field(root, 'name'));

    return (
      field(init, 'callee', 'property', 'name') === 'meta' &&
      typeof source === 'string' &&
      previewPath.test(source)
    );
  });
}

export interface NamedExport {
  readonly name: string;
  readonly local: unknown;
  readonly init: unknown;
  readonly form: 'declaration' | 'specifier';
  /** `export type`, `export { type A }` or `export declare`, which TypeScript erases. */
  readonly typeOnly: boolean;
}

export function namedExports(
  body: readonly unknown[],
  bindings: Bindings,
): readonly NamedExport[] {
  return body
    .flatMap((statement) => {
      const typeOnly = field(statement, 'exportKind') === 'type';

      return [
        ...list(field(statement, 'declaration', 'declarations')).map(
          (declarator) => ({
            name: field(declarator, 'id', 'name'),
            local: field(declarator, 'id', 'name'),
            init: field(declarator, 'init'),
            form: 'declaration' as const,
            typeOnly,
          }),
        ),
        ...(field(statement, 'declaration', 'type') === 'FunctionDeclaration'
          ? [
              {
                name: field(statement, 'declaration', 'id', 'name'),
                local: field(statement, 'declaration', 'id', 'name'),
                init: field(statement, 'declaration'),
                form: 'declaration' as const,
                typeOnly,
              },
            ]
          : []),
        ...list(field(statement, 'specifiers')).map((specifier) => ({
          name:
            field(specifier, 'exported', 'name') ??
            field(specifier, 'exported', 'value'),
          local: field(specifier, 'local', 'name'),
          init:
            field(specifier, 'local', 'type') === 'Identifier'
              ? followed(field(specifier, 'local'), bindings)
              : undefined,
          form: 'specifier' as const,
          typeOnly: typeOnly || field(specifier, 'exportKind') === 'type',
        })),
      ];
    })
    .flatMap(({ name, ...named }) =>
      typeof name === 'string' && name !== 'default'
        ? [{ name, ...named }]
        : [],
    );
}

export function topLevelBindings(body: readonly unknown[]): Bindings {
  return new Map(
    body.flatMap((statement) => {
      const declaration = declarationOf(statement);
      const functionName = field(declaration, 'id', 'name');

      if (
        field(declaration, 'type') === 'FunctionDeclaration' &&
        typeof functionName === 'string'
      ) {
        return [[functionName, declaration] as const];
      }

      return list(field(declaration, 'declarations')).flatMap((declarator) => {
        const name = field(declarator, 'id', 'name');
        const init = field(declarator, 'init');

        return typeof name === 'string' && init !== null
          ? [[name, init] as const]
          : [];
      });
    }),
  );
}

/** The top-level bindings whose value the file leaves as declared: none in its `written` set, which holds every name it writes, reassigns or hands to code it does not read. */
export function unchangedBindings(
  bindings: Bindings,
  written: ReadonlySet<unknown>,
): Bindings {
  return new Map([...bindings].filter(([name]) => !written.has(name)));
}

/** `value` is an export specifier's local, a call argument, a property or assigned value, or a `.bind()` callee's object; of these only an Identifier has a string `name`. */
function followed(value: unknown, bindings: Bindings): unknown {
  const name = field(value, 'name');

  return typeof name === 'string' ? bindings.get(name) : value;
}

/** A name's top-level value; a name the file does not bind, or any other node, as it is. */
export function topLevelValueOrSelf(
  node: unknown,
  bindings: Bindings,
): unknown {
  const name = field(node, 'name');

  return (typeof name === 'string' ? bindings.get(name) : undefined) ?? node;
}

function withInit(value: unknown, bindings: Bindings): readonly unknown[] {
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
  if (field(descriptor, 'type') === 'ArrayExpression') {
    return list(field(descriptor, 'elements')).some(
      (element) => field(element, 'value') === name,
    );
  }

  const pattern =
    field(descriptor, 'type') === 'StringLiteral'
      ? field(descriptor, 'value')
      : field(descriptor, 'pattern');
  const flags = field(descriptor, 'flags') ?? '';

  return (
    typeof name === 'string' &&
    typeof pattern === 'string' &&
    typeof flags === 'string' &&
    new RegExp(pattern, flags).test(name)
  );
}

/** Storybook 10.6.5 composes a factory story from the keys of the `input` that `defineStory` closed over, so only writes below `input` count. */
function runtimeAssignments(
  assignments: readonly Assignment[],
  isFactory: boolean,
): readonly Assignment[] {
  if (!isFactory) {
    return assignments;
  }

  return assignments.flatMap((assignment) =>
    assignment.path[0] === 'input' && assignment.path.length > 1
      ? [{ ...assignment, path: assignment.path.slice(1) }]
      : [],
  );
}

export interface TestCall {
  readonly statement: unknown;
  readonly target: unknown;
  readonly args: readonly unknown[];
}

export function testCallOf(statement: unknown): readonly TestCall[] {
  const callee = field(statement, 'expression', 'callee');

  return field(callee, 'property', 'name') === 'test'
    ? [
        {
          statement,
          target: field(callee, 'object', 'name'),
          args: list(field(statement, 'expression', 'arguments')),
        },
      ]
    : [];
}

/** The file holds a string literal that names this file, or loads a module whose specifier is not a string literal. Storybook 10.6.5's Vitest transform composes each story from the file's own bindings, so a write through an import of the file itself changes what runs without naming the story. */
export function mayImportItself(
  body: readonly unknown[],
  fileName: string,
): boolean {
  const file = resolve(fileName);
  const withoutExtension = file.slice(0, file.length - extname(file).length);
  const nodes = nodesIn(body);
  const namesThisFile = (specifier: unknown): boolean => {
    if (typeof specifier !== 'string' || !specifier.startsWith('.')) {
      return false;
    }

    const target = resolve(dirname(file), specifier);

    // Vite resolves a .js, .jsx, .mjs or .cjs specifier to the TypeScript file of the same name.
    return (
      [file, withoutExtension].includes(target) ||
      target.replace(/\.[cm]?jsx?$/, '') === withoutExtension
    );
  };

  return (
    nodes
      .filter((node) => field(node, 'type') === 'StringLiteral')
      .some((literal) => namesThisFile(field(literal, 'value'))) ||
    nodes
      .filter(
        (node) =>
          field(node, 'callee', 'type') === 'Import' ||
          field(node, 'callee', 'name') === 'require',
      )
      .some(
        (call) =>
          field(list(field(call, 'arguments'))[0], 'type') !== 'StringLiteral',
      )
  );
}

function nodesIn(node: object): readonly unknown[] {
  return [node, ...Object.values(node).filter(isRecord).flatMap(nodesIn)];
}

function storyNode(init: unknown, bindings: Bindings): unknown {
  if (isTemplateBind(init)) {
    return followed(field(init, 'callee', 'object'), bindings);
  }

  return storyArgument(init);
}

export function isTemplateBind(init: unknown): boolean {
  const [context, ...more] = list(field(init, 'arguments'));

  return (
    field(init, 'callee', 'property', 'name') === 'bind' &&
    more.length === 0 &&
    (context === undefined ||
      (field(context, 'type') === 'ObjectExpression' &&
        list(field(context, 'properties')).length === 0))
  );
}

function objectOf(
  expression: unknown,
  bindings: Bindings,
): readonly ObjectLiteral[] {
  const node = unwrap(expression);

  if (isObjectLiteral(node)) {
    return [node];
  }

  return field(node, 'type') === 'Identifier'
    ? objectOf(
        followed(node, bindings),
        withoutBinding(bindings, field(node, 'name')),
      )
    : [];
}
