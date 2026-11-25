import {
  muirMoiraStorybookCsfShapes,
  muirMoiraStorybookField,
  muirMoiraStorybookFileNameOf,
  muirMoiraStorybookIsRecord,
  muirMoiraStorybookIsStoryFile,
  muirMoiraStorybookList,
  muirMoiraStorybookPropertyKey,
  type MuirMoiraStorybookCsfShapes,
  type MuirMoiraStorybookProjectLog,
} from '@muirjs/moira-storybook';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import { muirShadowcatStorybookStrykerStorybookProject } from './options.ts';
import { muirShadowcatStorybookPackageName } from './package-name.ts';

export const muirShadowcatStorybookCsfIgnorerName =
  'muir-shadowcat-storybook-csf';

const staticReason = `${muirShadowcatStorybookCsfIgnorerName}: Storybook reads this CSF value without running the file, so it stays as written`;
const metaReason = `${muirShadowcatStorybookCsfIgnorerName}: Storybook reads the meta object without running the file, so it stays an object literal`;
const containerReason = `${muirShadowcatStorybookCsfIgnorerName}: Storybook reads this story, its parameters or its test options without running the file, so it stays an object or a function`;
const testReason = `${muirShadowcatStorybookCsfIgnorerName}: test code in a story file is mutated by the Stryker config with muirShadowcatStorybookCsf.play set to mutate`;
const mswReason = `${muirShadowcatStorybookCsfIgnorerName}: msw handlers in a story file are mutated by the Stryker config with muirShadowcatStorybookCsf.play set to mutate`;

export function muirShadowcatStorybookCsfIgnorer(
  options: object,
  log: MuirMoiraStorybookProjectLog,
): Ignorer {
  const ignoreMode =
    muirMoiraStorybookField(options, 'muirShadowcatStorybookCsf', 'play') !==
    'mutate';
  let reasons: ReadonlyMap<unknown, string> = new Map();
  const fileReasons = (
    program: unknown,
    fileName: string | undefined,
  ): ReadonlyMap<unknown, string> => {
    if (
      fileName === undefined ||
      !muirMoiraStorybookIsStoryFile(
        muirShadowcatStorybookStrykerStorybookProject(
          options,
          log,
          muirShadowcatStorybookPackageName,
        ),
        fileName,
      )
    ) {
      return new Map();
    }

    const shapes = muirMoiraStorybookCsfShapes(program);

    if (!ignoreMode) {
      return staticReasons(shapes);
    }

    // StrykerJS reads a node's leading comments when it enters that node, after the ignorer has seen the Program node.
    shapes.literalContainers.forEach(keepLiteralContainer);
    shapes.testStatementsWithOptions.forEach(keepTestCall);
    shapes.metaObjects.forEach(keepMetaObject);

    return ignoreModeReasons(shapes);
  };

  return {
    shouldIgnore(path) {
      const node = muirMoiraStorybookField(path, 'node');

      if (muirMoiraStorybookField(node, 'type') === 'Program') {
        reasons = fileReasons(node, muirMoiraStorybookFileNameOf(path));
      }

      return reasons.get(node);
    },
  };
}

muirShadowcatStorybookCsfIgnorer.inject = tokens(
  commonTokens.options,
  commonTokens.logger,
);

function staticReasons(
  shapes: MuirMoiraStorybookCsfShapes,
): ReadonlyMap<unknown, string> {
  return new Map(
    [...shapes.staticValues].map((node) => [node, staticReason] as const),
  );
}

function ignoreModeReasons(
  shapes: MuirMoiraStorybookCsfShapes,
): ReadonlyMap<unknown, string> {
  // A later entry wins: meta over test code over msw over static values.
  return new Map([
    ...staticReasons(shapes),
    ...[...shapes.mswValues].map((node) => [node, mswReason] as const),
    ...[...shapes.testCode].map((node) => [node, testReason] as const),
    ...[...shapes.metaObjects]
      .flatMap(metaPartsKept)
      .map((node) => [node, metaReason] as const),
  ]);
}

/** Every property of a meta object but its `args`, which are story data, mutated as a story's are. */
function metaPartsKept(meta: unknown): readonly unknown[] {
  return muirMoiraStorybookList(
    muirMoiraStorybookField(meta, 'properties'),
  ).filter((property) => muirMoiraStorybookPropertyKey(property) !== 'args');
}

// An ignorer skips a whole subtree, so the meta object itself is kept by a directive, leaving its args unignored. A next-line directive matches every ObjectLiteral mutant on the meta's first line, so the `{}` of args written on that line is kept too, as a story's own is.
function keepMetaObject(meta: unknown): void {
  addDirective(meta, `Stryker disable next-line ObjectLiteral: ${metaReason}`);
}

// A Stryker ignorer skips a whole subtree; a next-line directive skips only the mutants on the container's first line.
function keepLiteralContainer(container: unknown): void {
  addDirective(
    container,
    `Stryker disable next-line ObjectLiteral,ArrowFunction: ${containerReason}`,
  );
}

// The statement stays unignored so that its options are mutated; the directive keeps out the mutant that removes the call.
function keepTestCall(statement: unknown): void {
  addDirective(
    statement,
    `Stryker disable next-line CallExpression: ${testReason}`,
  );
}

function addDirective(node: unknown, directive: string): void {
  if (!muirMoiraStorybookIsRecord(node)) {
    return;
  }

  node['leadingComments'] = [
    ...muirMoiraStorybookList(node['leadingComments']),
    {
      // Stryker disable next-line StringLiteral: the type keeps the node a well-formed Babel comment, but no output depends on its value: StrykerJS reads only the comment's value, and Babel's generator prints a comment of any type but CommentBlock as a line comment
      type: 'CommentLine',
      value: ` ${directive}`,
    },
  ];
}
