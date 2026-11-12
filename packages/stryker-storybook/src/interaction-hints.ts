import { resolve } from 'node:path';

import { field, isRecord, list, unwrap } from '@layzee/storybook-core';
import type { schema } from '@stryker-mutator/api/core';

import { packageName } from './package-name.ts';
import { parseProgram } from './parse.ts';
import { storybookPluginName } from './stub-verdict.ts';

export const interactionMutatorNames = [
  'LzStorybookInteraction',
  'LzStorybookClickFocus',
  'LzStorybookInteractionRepeat',
  'LzStorybookInteractionTarget',
  'LzStorybookAssertionBefore',
] as const;

type InteractionMutatorName = (typeof interactionMutatorNames)[number];

const interactionShapes = [
  'negative-only',
  'click-before-type',
  'cleared-later',
] as const;

export type InteractionShape = (typeof interactionShapes)[number];

export interface InteractionHint {
  readonly file: string;
  readonly line: number;
  readonly shape: InteractionShape;
  readonly mutatorNames: readonly InteractionMutatorName[];
  readonly reason: string;
  readonly fix: string;
  readonly comment: string;
}

export type ReportMutant = Pick<
  schema.MutantResult,
  'mutatorName' | 'status' | 'location'
>;

export type ReportFiles = Readonly<
  Record<
    string,
    Pick<schema.FileResult, 'source'> & {
      readonly mutants: readonly ReportMutant[];
    }
  >
>;

/** One hint per line and shape of the surviving interaction mutants in `files`; `warn` names each file that gets none for a reason the run should show. */
export function interactionHints(
  files: ReportFiles,
  mutate: readonly string[],
  warn: (message: string) => void,
): readonly InteractionHint[] {
  return Object.entries(files).flatMap(([file, { source, mutants }]) => {
    if (!mutants.some(isInteractionSurvivor)) {
      return [];
    }

    const rangePattern = mutate.find((pattern) =>
      namesWithLineRange(pattern, file),
    );

    if (rangePattern !== undefined) {
      warn(
        `${packageName}: the mutate pattern ${rangePattern} gives ${file} a line range, so lz-storybook gave it no interaction hints: an interaction outside the range has no ${siteMutatorName} mutant to end a hint's window`,
      );

      return [];
    }

    const program = parsed(source, file, warn);
    const shaped =
      program === undefined ? [] : shapedSurvivors(program, mutants);

    if (shaped === undefined) {
      warn(
        `${packageName}: ${file} has a surviving interaction mutant outside every ${siteMutatorName} mutant, so lz-storybook gave it no interaction hints`,
      );

      return [];
    }

    return groupedHints(file, mutants, shaped);
  });
}

// StrykerJS 10.1.1 core, src/fs/mutate-pattern-constants.ts
const mutationRange = /(.*?):((\d+)(?::(\d+))?-(\d+)(?::(\d+))?)$/;

/** StrykerJS 10.1.1 refuses a line range on a glob (src/config/options-validator.ts), so a ranged pattern names one file. */
function namesWithLineRange(pattern: string, file: string): boolean {
  const path = mutationRange.exec(pattern)?.[1];

  return path !== undefined && resolve(path) === resolve(file);
}

function isInteractionSurvivor({ mutatorName, status }: ReportMutant): boolean {
  return (
    status === 'Survived' &&
    interactionMutatorNames.some((name) => name === mutatorName)
  );
}

function parsed(
  source: string,
  file: string,
  warn: (message: string) => void,
): ReturnType<typeof parseProgram> | undefined {
  try {
    return parseProgram(source, file);
  } catch (error) {
    warn(
      `${packageName}: Babel could not parse ${file}, so lz-storybook gave no interaction hints for it: ${error instanceof Error ? error.message : String(error)}`,
    );

    return undefined;
  }
}

/** A surviving interaction mutant, with the shape of the interaction it belongs to. */
interface ShapedSurvivor {
  readonly mutant: ReportMutant;
  readonly name: InteractionMutatorName;
  readonly line: number;
  readonly shape: InteractionShape;
}

/** `undefined` when a survivor lies in no interaction site, so the windows cannot be trusted to end where they should. */
function shapedSurvivors(
  program: unknown,
  mutants: readonly ReportMutant[],
): readonly ShapedSurvivor[] | undefined {
  const located = locate(program);
  const siteRanges = mutants
    .filter(({ mutatorName }) => mutatorName === siteMutatorName)
    .map(({ location }) => location);
  const sites = new Set(siteRanges.map(locationKey));
  const index: InteractionIndex = {
    located,
    isSite: (node) => sites.has(rangeKey(node)),
    vitestBrowserNames: vitestBrowserNames(program),
  };
  const siteNodes = new Map<string, Located>();
  located.forEach((entry) => {
    const key = rangeKey(entry.node);

    if (sites.has(key) && !siteNodes.has(key)) {
      siteNodes.set(key, entry);
    }
  });
  const shapeOf = (site: Located): InteractionShape | undefined =>
    interactionShapes.find((shape) => hasShape[shape](site, index));

  const survivors = mutants.flatMap((mutant) => {
    const name = interactionMutatorNames.find(
      (candidate) => candidate === mutant.mutatorName,
    );

    if (name === undefined || mutant.status !== 'Survived') {
      return [];
    }

    const range = siteHolding(siteRanges, mutant.location.start);

    return [
      {
        mutant,
        name,
        site:
          range === undefined ? undefined : siteNodes.get(locationKey(range)),
      },
    ];
  });

  return survivors.some(({ site }) => site === undefined)
    ? undefined
    : survivors.flatMap(({ mutant, name, site }) => {
        const shape = site === undefined ? undefined : shapeOf(site);

        return shape === undefined
          ? []
          : [{ mutant, name, line: mutant.location.start.line, shape }];
      });
}

/** One hint per line and shape, naming only the mutators whose every placed mutant on that line is in it. */
function groupedHints(
  file: string,
  mutants: readonly ReportMutant[],
  shaped: readonly ShapedSurvivor[],
): readonly InteractionHint[] {
  return Object.values(
    Object.groupBy(shaped, ({ line, shape }) => `${line} ${shape}`),
  ).flatMap((group = []) => {
    const [first] = group;
    // A next-line comment disables every mutant of a named mutator that starts on its line.
    const names = interactionMutatorNames.filter(
      (name) =>
        group.some((member) => member.name === name) &&
        mutants
          .filter(
            ({ mutatorName, status, location }) =>
              mutatorName === name &&
              status !== 'Ignored' &&
              location.start.line === first?.line,
          )
          .every((mutant) => group.some((member) => member.mutant === mutant)),
    );

    return first === undefined || names.length === 0
      ? []
      : [hintOf(file, first.line, first.shape, names)];
  });
}

/** The innermost site whose range holds `position`: a target literal lies inside its interaction. */
function siteHolding(
  ranges: readonly schema.Location[],
  position: schema.Position,
): schema.Location | undefined {
  return ranges
    .filter(
      ({ start, end }) =>
        !isBefore(position, start) && !isBefore(end, position),
    )
    .toSorted(({ start: first }, { start: second }) =>
      isBefore(first, second) ? 1 : -1,
    )[0];
}

function isBefore(first: schema.Position, second: schema.Position): boolean {
  return (
    first.line < second.line ||
    (first.line === second.line && first.column < second.column)
  );
}

/** The nodes of one file, and which of them are interactions. */
interface InteractionIndex {
  readonly located: ReadonlyMap<AstNode, Located>;
  readonly isSite: (node: AstNode) => boolean;
  /** The names a top-level import binds from Vitest browser, whose `userEvent.type` does not click first. */
  readonly vitestBrowserNames: ReadonlySet<string>;
}

const vitestBrowserModules: readonly unknown[] = [
  'vitest/browser',
  '@vitest/browser/context',
];

function vitestBrowserNames(program: unknown): ReadonlySet<string> {
  return new Set(
    list(field(program, 'body'))
      .filter(
        (statement) =>
          field(statement, 'type') === 'ImportDeclaration' &&
          vitestBrowserModules.includes(field(statement, 'source', 'value')),
      )
      .flatMap((statement) => list(field(statement, 'specifiers')))
      .flatMap((specifier) => nameOf(field(specifier, 'local')) ?? []),
  );
}

/** The identifier a member chain such as `user.keyboard` starts at. */
function rootName(node: unknown): string | undefined {
  return ['MemberExpression', 'OptionalMemberExpression'].includes(
    String(field(node, 'type')),
  )
    ? rootName(unwrap(field(node, 'object')))
    : nameOf(node);
}

/** The shapes cannot overlap: a click before a type and a clear later need no check before the next interaction. */
const hasShape: Readonly<
  Record<InteractionShape, (site: Located, index: InteractionIndex) => boolean>
> = {
  'negative-only': isNegativeOnly,
  'click-before-type': isClickBeforeType,
  'cleared-later': isClearedLater,
};

/**
 * A `type` or `clear` with no check before the next statement in its own block that holds an interaction, when that
 * statement is a `clear` of an equivalent target.
 */
function isClearedLater(site: Located, index: InteractionIndex): boolean {
  const current = callOf(site.node);
  const siblings = nextSiblings(site);
  const between = statementsBefore(siblings, (statement) =>
    holdsInteraction(statement, index.isSite),
  );
  const end = siblings[between.length];
  const later =
    end !== undefined && index.isSite(end) ? callOf(end) : undefined;

  return (
    current !== undefined &&
    later !== undefined &&
    ['type', 'clear'].includes(current.method ?? '') &&
    later.method === 'clear' &&
    actsOnSameTarget(current, later) &&
    between.every((statement) => checksIn(statement).length === 0)
  );
}

/** A click or hover directly before a `type` of an equivalent target. */
function isClickBeforeType(site: Located, index: InteractionIndex): boolean {
  const current = callOf(site.node);
  const [next] = nextSiblings(site);
  const following =
    next !== undefined && index.isSite(next) ? callOf(next) : undefined;

  return (
    current !== undefined &&
    following !== undefined &&
    ['click', 'hover'].includes(current.method ?? '') &&
    rootName(current.receiver) !== 'fireEvent' &&
    following.method === 'type' &&
    actsOnSameTarget(current, following) &&
    !skipsClick(following.args[2]) &&
    !index.vitestBrowserNames.has(rootName(following.receiver) ?? '')
  );
}

function skipsClick(options: unknown): boolean {
  return list(field(options, 'properties')).some(
    (property) =>
      nameOf(field(property, 'key')) === 'skipClick' &&
      !(
        field(property, 'value', 'type') === 'BooleanLiteral' &&
        field(property, 'value', 'value') === false
      ),
  );
}

/** The call of an interaction site: the statement's expression or the step body, without `await` or type wrappers. */
interface InteractionCall {
  /** The callee's property name for `<receiver>.<method>(...)`. */
  readonly method: string | undefined;
  readonly receiver: unknown;
  readonly args: readonly unknown[];
}

function actsOnSameTarget(
  first: InteractionCall,
  second: InteractionCall,
): boolean {
  return (
    first.args[0] !== undefined && equivalent(first.args[0], second.args[0])
  );
}

function callOf(node: AstNode): InteractionCall | undefined {
  const call = awaited(
    node['type'] === 'ExpressionStatement' ? node['expression'] : node,
  );
  const callee = unwrap(field(call, 'callee'));
  const isMember = ['MemberExpression', 'OptionalMemberExpression'].includes(
    String(field(callee, 'type')),
  );

  return ['CallExpression', 'OptionalCallExpression'].includes(
    String(field(call, 'type')),
  )
    ? {
        method: isMember ? nameOf(field(callee, 'property')) : undefined,
        receiver: isMember ? unwrap(field(callee, 'object')) : undefined,
        args: list(field(call, 'arguments')),
      }
    : undefined;
}

/** Babel's `isNodesEquivalent` over plain nodes: the same type and fields, whatever the positions, comments and `extra`. */
function equivalent(first: unknown, second: unknown): boolean {
  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((item: unknown, at) => equivalent(item, second[at]))
    );
  }

  if (!isNode(first) || !isNode(second)) {
    return first === second;
  }

  const keys = new Set(
    [...Object.keys(first), ...Object.keys(second)].filter(
      (key) => !positionKeys.has(key),
    ),
  );

  return [...keys].every((key) => equivalent(first[key], second[key]));
}

/**
 * At least one following check, and every check before the next interaction negative; both are looked for past the
 * end of the interaction's block and of a step callback that holds it.
 */
function isNegativeOnly(site: Located, index: InteractionIndex): boolean {
  const later = laterStatements(site, index.located);
  const holds = (statement: AstNode): boolean =>
    holdsInteraction(statement, index.isSite);
  const isNext = (statement: AstNode): boolean =>
    index.isSite(statement) ||
    (isStepCall(awaited(field(statement, 'expression'))) && holds(statement));

  return (
    statementsBefore(later, holds).some(
      (statement) => checksIn(statement).length > 0,
    ) &&
    statementsBefore(later, isNext)
      .flatMap(checksIn)
      .every((chain) => chain.includes('not'))
  );
}

/** A node with its ancestors, parent first, and the statement list that holds it, when one does. */
interface Located {
  readonly node: AstNode;
  readonly ancestors: readonly AstNode[];
  readonly statements: readonly AstNode[] | undefined;
}

type AstNode = Readonly<Record<string, unknown>>;

const positionKeys: ReadonlySet<string> = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

const statementLists: ReadonlySet<string> = new Set(['body', 'consequent']);

function isNode(value: unknown): value is AstNode {
  return isRecord(value) && typeof value['type'] === 'string';
}

/** Every node of `program` in source order, outer before inner. */
function locate(program: unknown): ReadonlyMap<AstNode, Located> {
  const located = new Map<AstNode, Located>();
  const visit = (
    node: AstNode,
    ancestors: readonly AstNode[],
    statements: readonly AstNode[] | undefined,
  ): void => {
    located.set(node, { node, ancestors, statements });
    childEntries(node).forEach(([key, value]) => {
      const children = list(value).filter(isNode);

      if (Array.isArray(value)) {
        children.forEach((child) =>
          visit(
            child,
            [node, ...ancestors],
            statementLists.has(key) ? children : undefined,
          ),
        );
      } else if (isNode(value)) {
        visit(value, [node, ...ancestors], undefined);
      }
    });
  };

  if (isNode(program)) {
    visit(program, [], undefined);
  }

  return located;
}

function childEntries(node: AstNode): readonly (readonly [string, unknown])[] {
  return Object.entries(node).filter(([key]) => !positionKeys.has(key));
}

/**
 * `LzStorybookInteraction` places a mutant at every interaction outside a `beforeEach` or `afterEach`, and Stryker
 * keeps a mutant it ignores in the report as Ignored, so the ranges of its mutants, whatever their status, are the
 * interactions the test mutators read.
 */
const siteMutatorName: InteractionMutatorName = 'LzStorybookInteraction';

/** The statements before the first one among them that `ends`. */
function statementsBefore(
  statements: readonly AstNode[],
  ends: (statement: AstNode) => boolean,
): readonly AstNode[] {
  const end = statements.findIndex(ends);

  return end === -1 ? statements : statements.slice(0, end);
}

/** The statements that run after `site` in its function, and after the step call when that function is a step callback. */
function laterStatements(
  site: Located,
  located: ReadonlyMap<AstNode, Located>,
): readonly AstNode[] {
  const outer = continuationOf(site, located);

  return [
    ...nextSiblings(site),
    ...(outer === undefined ? [] : laterStatements(outer, located)),
  ];
}

/** Where the statements after `node` go on: its parent, or the step call around a step callback; none past another function. */
function continuationOf(
  { ancestors: [parent, grandparent] }: Located,
  located: ReadonlyMap<AstNode, Located>,
): Located | undefined {
  if (parent === undefined) {
    return undefined;
  }

  if (!isFunction(parent)) {
    return located.get(parent);
  }

  return isStepCall(grandparent) && grandparent !== undefined
    ? located.get(grandparent)
    : undefined;
}

/**
 * Whether `statement` is or holds an interaction that runs within it: outside a step callback only step and `waitFor`
 * callbacks are entered, inside one every function is.
 */
function holdsInteraction(
  statement: AstNode,
  isSite: (node: AstNode) => boolean,
): boolean {
  const holds = (node: AstNode, insideStep: boolean): boolean =>
    isSite(node) ||
    childEntries(node).some(([key, value]) =>
      list(Array.isArray(value) ? value : [value])
        .filter(isNode)
        .some((child) => {
          const isArgument = key === 'arguments';
          const entersStep = isArgument && isStepCall(node);
          const runsHere =
            insideStep ||
            !isFunction(child) ||
            entersStep ||
            (isArgument && nameOf(node['callee']) === 'waitFor');

          return runsHere && holds(child, insideStep || entersStep);
        }),
    );

  return holds(statement, false);
}

/** The expression without `await` and the type wrappers around it. */
function awaited(expression: unknown): unknown {
  const inner = unwrap(expression);

  return unwrap(
    field(inner, 'type') === 'AwaitExpression'
      ? field(inner, 'argument')
      : inner,
  );
}

const functionTypes: ReadonlySet<unknown> = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
]);

function isFunction(node: AstNode): boolean {
  return functionTypes.has(node['type']);
}

/** `step(...)`, or `<context>.step(...)` on a play context that is not destructured. */
function isStepCall(node: unknown): boolean {
  const callee = field(node, 'callee');

  return (
    field(node, 'type') === 'CallExpression' &&
    (nameOf(callee) === 'step' ||
      (field(callee, 'type') === 'MemberExpression' &&
        nameOf(field(callee, 'object')) !== undefined &&
        nameOf(field(callee, 'property')) === 'step'))
  );
}

function nextSiblings({ node, statements }: Located): readonly AstNode[] {
  return statements === undefined
    ? []
    : statements.slice(statements.indexOf(node) + 1);
}

/** The member names after each `expect(...)` call in `node`, nearest first, from the outermost chain around it. */
function checksIn(node: unknown): readonly (readonly string[])[] {
  const checks = new Map<AstNode, readonly string[]>();
  const visit = (current: unknown): void => {
    if (!isNode(current)) {
      return;
    }

    const check = chainTo(current, []);

    if (check !== undefined && !checks.has(check.expect)) {
      checks.set(check.expect, check.names);
    }

    childEntries(current).forEach(([, value]) =>
      (Array.isArray(value) ? value : [value]).forEach(visit),
    );
  };

  visit(node);

  return [...checks.values()];
}

function chainTo(
  node: unknown,
  names: readonly string[],
): { readonly expect: AstNode; readonly names: readonly string[] } | undefined {
  if (!isNode(node)) {
    return undefined;
  }

  if (node['type'] === 'CallExpression') {
    return field(node, 'callee', 'name') === 'expect'
      ? { expect: node, names }
      : chainTo(node['callee'], names);
  }

  return node['type'] === 'MemberExpression'
    ? chainTo(node['object'], [nameOf(node['property']) ?? '', ...names])
    : undefined;
}

function nameOf(node: unknown): string | undefined {
  const name = field(node, 'name');

  return field(node, 'type') === 'Identifier' && typeof name === 'string'
    ? name
    : undefined;
}

/** The report's 1-based range of a Babel node, whose columns are 0-based. */
function rangeKey(node: AstNode): string {
  return [
    field(node, 'loc', 'start', 'line'),
    Number(field(node, 'loc', 'start', 'column')) + 1,
    field(node, 'loc', 'end', 'line'),
    Number(field(node, 'loc', 'end', 'column')) + 1,
  ].join(':');
}

function locationKey({ start, end }: schema.Location): string {
  return [start.line, start.column, end.line, end.column].join(':');
}

const shapeTexts: Readonly<
  Record<
    InteractionShape,
    { readonly reason: string; readonly fix: string; readonly short: string }
  >
> = {
  'negative-only': {
    reason:
      'every check after this interaction up to the next one is negative, so the play also passes when the interaction does nothing',
    fix: 'if the control is meant to ignore it, such as a disabled one, disable the mutant, otherwise add a check that the interaction makes true',
    short: 'every check up to the next interaction is negative',
  },
  'click-before-type': {
    reason:
      "the type in the next statement clicks the same target first (user-event 14's type does, unless given skipClick), so this click repeats it",
    fix: 'disable the mutant or remove the click, unless the click itself must do something, then add a check for that before the type',
    short: 'the next type clicks the same target first',
  },
  'cleared-later': {
    reason:
      'the next interaction clears the same target with no check between them, so nothing reads what this one leaves',
    fix: 'disable the mutant if no handler records the input, otherwise add a check of what it records before the clear',
    short: 'the next interaction clears the same target before any check',
  },
};

function hintOf(
  file: string,
  line: number,
  shape: InteractionShape,
  mutatorNames: readonly InteractionMutatorName[],
): InteractionHint {
  const { reason, fix, short } = shapeTexts[shape];

  return {
    file,
    line,
    shape,
    mutatorNames,
    reason,
    fix,
    comment: `// Stryker disable next-line ${mutatorNames.join(', ')}: ${storybookPluginName}: ${shape}: ${short}`,
  };
}
