import { muirMoiraStorybookWithoutBinding } from './bindings.ts';
import {
  muirMoiraStorybookCsfFile,
  muirMoiraStorybookDefaultExport,
  muirMoiraStorybookIsTemplateBind,
  muirMoiraStorybookMayImportItself,
  muirMoiraStorybookNamedExports,
  muirMoiraStorybookTopLevelBindings,
  muirMoiraStorybookUnchangedBindings,
} from './csf.ts';
import {
  muirMoiraStorybookStoryArgument,
  muirMoiraStorybookUnwrap,
} from './csf-nodes.ts';
import {
  muirMoiraStorybookIsRecord,
  muirMoiraStorybookIsStringArray,
} from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';
import { muirMoiraStorybookStoryIndex } from './story-index.ts';
import { muirMoiraStorybookInternalCsf } from './storybook-internals.ts';
import {
  muirMoiraStorybookDefinitionTimeStubs,
  type MuirMoiraStorybookDefinitionTimeStub,
} from './stub-shape.ts';

export type MuirMoiraStorybookResetBranch =
  | 'reset'
  | 'clear'
  | 'restore'
  | 'none'
  | 'unknown';

export type MuirMoiraStorybookStubVerdict =
  | 'kept'
  | 'erased'
  | 'order-dependent'
  | 'unknown';

export interface MuirMoiraStorybookStoryReset {
  readonly name: string;
  readonly branch: MuirMoiraStorybookResetBranch;
}

export interface MuirMoiraStorybookClassifiedStub
  extends MuirMoiraStorybookDefinitionTimeStub {
  readonly verdict: MuirMoiraStorybookStubVerdict;
}

export interface MuirMoiraStorybookStubClassification {
  readonly stories: readonly MuirMoiraStorybookStoryReset[];
  readonly stubs: readonly MuirMoiraStorybookClassifiedStub[];
}

export type MuirMoiraStorybookResetSetting = boolean | 'unreadable';

export type MuirMoiraStorybookResetSettings = Readonly<
  Partial<Record<ResetKey, MuirMoiraStorybookResetSetting>>
>;

/** In the order Storybook 10.6.5's mock-reset loader checks them. */
const resetKeys = ['mockReset', 'clearMocks', 'restoreMocks'] as const;

type ResetKey = (typeof resetKeys)[number];

export const muirMoiraStorybookUnreadableSettings: Readonly<
  Record<ResetKey, MuirMoiraStorybookResetSetting>
> = {
  mockReset: 'unreadable',
  clearMocks: 'unreadable',
  restoreMocks: 'unreadable',
};

export function muirMoiraStorybookReadPreviewTest(
  program: unknown,
): MuirMoiraStorybookResetSettings {
  const body = muirMoiraStorybookList(muirMoiraStorybookField(program, 'body'));
  const bindings = muirMoiraStorybookTopLevelBindings(body);
  const exported = muirMoiraStorybookDefaultExport(body);

  if (exported !== undefined) {
    return testSettings(
      member(evaluate(definePreviewArgument(exported), bindings), 'parameters'),
    );
  }

  const parameters = muirMoiraStorybookNamedExports(body, bindings).find(
    ({ name, typeOnly }) => name === 'parameters' && !typeOnly,
  );

  return testSettings(
    parameters === undefined ? undefined : evaluate(parameters.init, bindings),
  );
}

function definePreviewArgument(node: unknown): unknown {
  const current = muirMoiraStorybookUnwrap(node);

  return muirMoiraStorybookField(current, 'type') === 'CallExpression' &&
    muirMoiraStorybookField(current, 'callee', 'name') === 'definePreview'
    ? muirMoiraStorybookField(current, 'arguments', '0')
    : current;
}

function testSettings(parameters: unknown): MuirMoiraStorybookResetSettings {
  const test = member(parameters, 'test');

  // Storybook 10.6.5 combineParameters lets any value that is not a plain object replace an object instead of merging into it.
  if (
    test !== undefined &&
    (!muirMoiraStorybookIsRecord(test) || Array.isArray(test))
  ) {
    return muirMoiraStorybookUnreadableSettings;
  }

  return resetKeys.reduce<
    Partial<Record<ResetKey, MuirMoiraStorybookResetSetting>>
  >((settings, key) => {
    const value = member(test, key);

    if (value !== undefined) {
      settings[key] = typeof value === 'boolean' ? value : 'unreadable';
    }

    return settings;
  }, {});
}

/** The tag filter of Storybook's Vitest plugin, and the preview's tags that every story starts from. */
export interface MuirMoiraStorybookTestTags {
  readonly previewTags: readonly string[];
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly skip: readonly string[];
}

export type MuirMoiraStorybookTagFilter = Omit<
  MuirMoiraStorybookTestTags,
  'previewTags'
>;

export const muirMoiraStorybookDefaultTestTags: MuirMoiraStorybookTagFilter = {
  include: ['test'],
  exclude: [],
  skip: [],
};

export interface MuirMoiraStorybookStoryFile {
  readonly program: unknown;
  readonly code: string;
  readonly fileName: string;
}

export function muirMoiraStorybookClassifyStubs(
  { program, code, fileName }: MuirMoiraStorybookStoryFile,
  previewTest: MuirMoiraStorybookResetSettings,
  testTags: MuirMoiraStorybookTestTags,
): MuirMoiraStorybookStubClassification {
  const body = muirMoiraStorybookList(muirMoiraStorybookField(program, 'body'));
  const topLevel = muirMoiraStorybookTopLevelBindings(body);
  const index = muirMoiraStorybookStoryIndex(code, fileName);
  const {
    metas: [meta],
    stories: exported,
    written: writtenNames,
  } = muirMoiraStorybookCsfFile(body, topLevel, index);
  const bindings = muirMoiraStorybookUnchangedBindings(topLevel, writtenNames);
  const isSelfImported = muirMoiraStorybookMayImportItself(body, fileName);
  const metaValue = evaluate(meta?.object, bindings);
  const metaTest = testSettings(member(metaValue, 'parameters'));
  const declared = exported
    .filter(({ name, tested }) => {
      const tags = index.get(name)?.tags;

      return tested && tags !== undefined && isTestedByTags(testTags, tags);
    })
    .flatMap(
      ({
        name,
        init,
        runtimeAssignments,
        extendsBase,
        children,
        referencedElsewhere,
      }) => {
        const story = runtimeAssignments.reduce(
          (value, assignment) =>
            written(
              value,
              assignment.path,
              evaluate(assignment.value, bindings),
            ),
          extendsBase
            ? unknownValue
            : evaluate(muirMoiraStorybookStoryArgument(init), bindings),
        );
        const isSkipped =
          referencedElsewhere || isSelfImported
            ? 'unknown'
            : storySkipped(
                testTags,
                member(metaValue, 'tags'),
                story,
                children.map((child) => {
                  if (child === 'unmatched') {
                    return unknownValue;
                  }

                  return child.options === undefined
                    ? undefined
                    : evaluate(child.options, bindings);
                }),
              );

        if (isSkipped === true) {
          return [];
        }

        // Storybook 10.6.5 normalizeStory: { ...story.story?.parameters, ...story.parameters }
        const storyTest = testSettings(
          spread([
            member(member(story, 'story'), 'parameters'),
            member(story, 'parameters'),
          ]),
        );

        return [
          {
            story: {
              name,
              branch:
                isSkipped === 'unknown'
                  ? 'unknown'
                  : branchOf([previewTest, metaTest, storyTest]),
            },
            init,
          },
        ];
      },
    );
  const stories = declared.map(({ story }) => story);
  const stubs = muirMoiraStorybookDefinitionTimeStubs(program).map((stub) => {
    const owner = declared.findIndex(({ init }) => contains(init, stub.start));
    const users = owner === -1 ? stories.map((_, index) => index) : [owner];

    return { ...stub, verdict: siteVerdict(stories, users) };
  });

  return { stories, stubs };
}

/** Storybook 10.6.5 runs each `.test()` call on a factory story as a test of its own, so one of them can run when the story's own test is skipped, and with parameters of its own. */
function storySkipped(
  testTags: MuirMoiraStorybookTestTags,
  metaTags: unknown,
  story: unknown,
  testOptions: readonly unknown[],
): boolean | 'unknown' {
  const storyTags = tagList(member(story, 'tags'));
  const base = skipped(testTags, metaTags, storyTags);
  const children = testOptions.map((options) => {
    const child = skipped(
      testTags,
      metaTags,
      storyTags && childTags(storyTags, member(options, 'tags')),
    );

    return child === false && member(options, 'parameters') !== undefined
      ? 'unknown'
      : child;
  });

  if (children.includes('unknown')) {
    return 'unknown';
  }

  return base === true ? children.every((child) => child === true) : base;
}

/** Storybook 10.6.5 test-utils.ts `testStory` checks skip tags on the tags prepareStory.ts composes at run time, which hold no play-fn. */
function skipped(
  { previewTags, skip }: MuirMoiraStorybookTestTags,
  metaTags: unknown,
  story: readonly string[] | undefined,
): boolean | 'unknown' {
  if (skip.length === 0) {
    return false;
  }

  const meta = tagList(metaTags);

  if (meta === undefined || story === undefined) {
    return 'unknown';
  }

  const tags = muirMoiraStorybookInternalCsf().combineTags(
    'dev',
    'test',
    ...previewTags,
    ...meta,
    ...story,
  );

  return skip.some((tag) => tags.includes(tag));
}

/** Storybook 10.6.5 csf-factories.ts `test` extends the story with these tags, which `extend` combines. */
function childTags(
  storyTags: readonly string[],
  optionTags: unknown,
): readonly string[] | undefined {
  const own = tagList(optionTags);

  return own === undefined
    ? undefined
    : muirMoiraStorybookInternalCsf().combineTags(
        ...storyTags,
        'test-fn',
        '!autodocs',
        ...own,
      );
}

function tagList(value: unknown): readonly string[] | undefined {
  if (value === undefined) {
    // Stryker disable next-line ArrayDeclaration: these tags reach only skipped(), which matches them against skip, and no skip list names Stryker's placeholder tag
    return [];
  }

  return muirMoiraStorybookIsStringArray(value) ? value : undefined;
}

/** Storybook 10.6.5 vitest-plugin transformer.ts `isValidTest`. */
function isTestedByTags(
  { previewTags, include, exclude }: MuirMoiraStorybookTestTags,
  fileTags: readonly string[],
): boolean {
  const tags = muirMoiraStorybookInternalCsf().combineTags(
    'test',
    'dev',
    ...previewTags,
    ...fileTags,
  );

  return (
    (include.length === 0 || include.some((tag) => tags.includes(tag))) &&
    !exclude.some((tag) => tags.includes(tag))
  );
}

function written(
  object: unknown,
  path: readonly unknown[],
  value: unknown,
): unknown {
  const [key, ...rest] = path;

  if (path.length === 0) {
    return value;
  }

  if (typeof key !== 'string') {
    return unknownValue;
  }

  const base = muirMoiraStorybookIsRecord(object) ? object : {};

  return { ...base, [key]: written(member(base, key), rest, value) };
}

function siteVerdict(
  stories: readonly MuirMoiraStorybookStoryReset[],
  users: readonly number[],
): MuirMoiraStorybookStubVerdict {
  const firstEraser = stories.findIndex(({ branch }) => erases(branch));

  if (firstEraser === -1) {
    return stories.some(({ branch }) => branch === 'unknown')
      ? 'unknown'
      : 'kept';
  }

  return users.every((user) => user >= firstEraser)
    ? 'erased'
    : 'order-dependent';
}

function erases(branch: MuirMoiraStorybookResetBranch): boolean {
  return branch === 'reset' || branch === 'restore';
}

function contains(node: unknown, position: number): boolean {
  const start = muirMoiraStorybookField(node, 'start');
  const end = muirMoiraStorybookField(node, 'end');

  return (
    typeof start === 'number' &&
    typeof end === 'number' &&
    start <= position &&
    position < end
  );
}

const decisiveSettings: Readonly<
  Record<ResetKey, readonly [boolean, MuirMoiraStorybookResetBranch]>
> = {
  mockReset: [true, 'reset'],
  clearMocks: [true, 'clear'],
  restoreMocks: [false, 'none'],
};

function branchOf(
  levels: readonly MuirMoiraStorybookResetSettings[],
): MuirMoiraStorybookResetBranch {
  return (
    resetKeys
      .map((key) => {
        const [decisive, branch] = decisiveSettings[key];
        const setting = levels.reduce<
          MuirMoiraStorybookResetSetting | undefined
        >((value, level) => level[key] ?? value, undefined);

        if (setting === 'unreadable') {
          return 'unknown';
        }

        return setting === decisive ? branch : undefined;
      })
      .find((branch) => branch !== undefined) ?? 'restore'
  );
}

function evaluate(
  node: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  const current = muirMoiraStorybookUnwrap(node);

  switch (muirMoiraStorybookField(current, 'type')) {
    case 'BooleanLiteral': {
      return muirMoiraStorybookField(current, 'value');
    }
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      return undefined;
    }
    case 'CallExpression': {
      return muirMoiraStorybookIsTemplateBind(current)
        ? undefined
        : unknownValue;
    }
    case 'Identifier': {
      const name = muirMoiraStorybookField(current, 'name');

      if (name === 'undefined') {
        return undefined;
      }

      return typeof name === 'string' && bindings.has(name)
        ? evaluate(
            bindings.get(name),
            muirMoiraStorybookWithoutBinding(bindings, name),
          )
        : unknownValue;
    }
    case 'ArrayExpression': {
      return muirMoiraStorybookList(
        muirMoiraStorybookField(current, 'elements'),
      ).map((element) =>
        muirMoiraStorybookField(element, 'type') === 'StringLiteral'
          ? muirMoiraStorybookField(element, 'value')
          : unknownValue,
      );
    }
    case 'ObjectExpression': {
      return spread(
        muirMoiraStorybookList(
          muirMoiraStorybookField(current, 'properties'),
        ).map((property) => objectPart(property, bindings)),
      );
    }
    default: {
      return unknownValue;
    }
  }
}

function spread(parts: readonly unknown[]): unknown {
  return parts.reduce<Readonly<Record<PropertyKey, unknown>>>(
    (object, part) => {
      if (!muirMoiraStorybookIsRecord(part)) {
        return object;
      }

      return Object.hasOwn(part, unknownRest) ? part : { ...object, ...part };
    },
    {},
  );
}

function objectPart(
  property: unknown,
  bindings: ReadonlyMap<string, unknown>,
): unknown {
  if (muirMoiraStorybookField(property, 'type') === 'SpreadElement') {
    return evaluate(muirMoiraStorybookField(property, 'argument'), bindings);
  }

  if (muirMoiraStorybookField(property, 'computed') === true) {
    return unknownValue;
  }

  return {
    [String(
      muirMoiraStorybookField(property, 'key', 'name') ??
        muirMoiraStorybookField(property, 'key', 'value'),
    )]: evaluate(muirMoiraStorybookField(property, 'value'), bindings),
  };
}

const unknownRest = Symbol('unknown rest');

const unknownValue: Readonly<Record<symbol, true>> = { [unknownRest]: true };

function member(value: unknown, key: string): unknown {
  if (
    muirMoiraStorybookIsRecord(value) &&
    !Object.hasOwn(value, key) &&
    Object.hasOwn(value, unknownRest)
  ) {
    return unknownValue;
  }

  return muirMoiraStorybookField(value, key);
}
