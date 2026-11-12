import type { NodePath, types } from '@babel/core';
import {
  firstArgumentSite,
  roleSite,
  swapMutator,
  type Site,
} from '@layzee/stryker-mutator-install';

import {
  hasNegativeCheck,
  hasZeroCallsCheck,
  isExpectStatement,
} from './checks.ts';
import {
  firstCheckAfter,
  interactionAt,
  isSkipped,
  targetInteraction,
  type Interaction,
} from './interactions.ts';
import { awaited } from './nodes.ts';
import {
  elementQueryPrefixes,
  isQueryCall,
  queryKinds,
  queryMethods,
} from './queries.ts';
import type { BabelTypes, LzStorybookTestMutator } from './mutator.ts';

function sampleOf(statement: string): string {
  return `export const Story = {\n  play: async ({ canvas, userEvent }) => {\n    ${statement}\n  },\n};\n`;
}

const clickMethods: readonly string[] = ['click', 'dblClick'];

/** A click target with no effects of its own: an identifier, a query, or an awaited query, any of them under `!`. */
function focusTarget(
  target: types.Node | undefined,
  path: NodePath,
): types.Expression | undefined {
  if (target?.type === 'TSNonNullExpression') {
    return focusTarget(target.expression, path) === undefined
      ? undefined
      : target;
  }

  if (target?.type === 'Identifier') {
    const binding = path.scope.getBinding(target.name);
    const init =
      binding?.kind === 'const' &&
      binding.path.node.type === 'VariableDeclarator'
        ? binding.path.node.init
        : undefined;

    return init != null && isTextFieldQuery(awaited(init)) ? undefined : target;
  }

  if (target?.type !== 'AwaitExpression' && target?.type !== 'CallExpression') {
    return undefined;
  }

  const query = target.type === 'AwaitExpression' ? target.argument : target;

  return isQueryCall(query) && !isTextFieldQuery(query) ? target : undefined;
}

// Queries that find form fields, which a click is meant to focus.
const fieldQueries = queryMethods(elementQueryPrefixes, [
  'LabelText',
  'PlaceholderText',
]);

/** A query for a text field: by a text field role, by label or by placeholder. */
function isTextFieldQuery(query: types.Node): boolean {
  const role = queryRole(query);

  return (
    (role !== undefined && textFieldRoles.includes(role)) ||
    fieldQueries.includes(methodOf(query) ?? '')
  );
}

/** The method name of `<x>.<method>(...)`. */
function methodOf(call: types.Node): string | undefined {
  return call.type === 'CallExpression' &&
    call.callee.type === 'MemberExpression' &&
    call.callee.property.type === 'Identifier'
    ? call.callee.property.name
    : undefined;
}

// Clicking an element of these roles is meant to focus it.
const textFieldRoles: readonly string[] = ['textbox', 'searchbox', 'combobox'];

const roleQueries = queryMethods(elementQueryPrefixes, ['Role']);

/** The role a `*ByRole` query names in a string literal. */
function queryRole(query: types.Node): string | undefined {
  if (
    query.type !== 'CallExpression' ||
    !roleQueries.includes(methodOf(query) ?? '')
  ) {
    return undefined;
  }

  const [role] = query.arguments;

  return role?.type === 'StringLiteral' ? role.value : undefined;
}

export function clickFocusMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookClickFocus';
} {
  return {
    name: 'LzStorybookClickFocus',
    sample: sampleOf('await userEvent.click(button);'),
    *mutate(path, t) {
      const interaction = interactionAt(path);
      const target =
        interaction?.kind === 'userEvent' &&
        clickMethods.includes(interaction.method)
          ? focusTarget(interaction.call.arguments[0], path)
          : undefined;

      if (
        interaction === undefined ||
        target === undefined ||
        isSkipped(interaction, t)
      ) {
        return;
      }

      const focus = t.callExpression(
        t.memberExpression(t.cloneNode(target), t.identifier('focus')),
        [],
      );

      yield interaction.site === 'statement'
        ? t.expressionStatement(
            interaction.node.expression.type === 'AwaitExpression'
              ? t.awaitExpression(focus)
              : focus,
          )
        : focus;
    },
  };
}

const repeatedMethods: readonly string[] = ['click', 'dblClick', 'keyboard'];

/** A fireEvent click, or a user-event click, dblClick or key press other than one that a second press repeats with no change. */
function isRepeated(interaction: Interaction): boolean {
  if (interaction.kind === 'fireEvent') {
    return interaction.method === 'click';
  }

  const [key] = interaction.call.arguments;

  return (
    interaction.kind === 'userEvent' &&
    repeatedMethods.includes(interaction.method) &&
    !(
      interaction.method === 'keyboard' &&
      key?.type === 'StringLiteral' &&
      idempotentKeys.includes(key.value)
    )
  );
}

const idempotentKeys: readonly string[] = ['{Home}', '{End}'];

export function interactionRepeatMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookInteractionRepeat';
} {
  return {
    name: 'LzStorybookInteractionRepeat',
    sample: sampleOf('await userEvent.click(button);'),
    *mutate(path, t) {
      const interaction = interactionAt(path);

      if (
        interaction === undefined ||
        !isRepeated(interaction) ||
        isSkipped(interaction, t)
      ) {
        return;
      }

      if (interaction.site === 'statement') {
        yield t.blockStatement([
          t.cloneNode(interaction.node),
          t.cloneNode(interaction.node),
        ]);
      } else {
        const twice = [interaction.node, interaction.node].map((body) =>
          t.expressionStatement(t.awaitExpression(t.cloneNode(body))),
        );

        yield t.callExpression(
          t.arrowFunctionExpression([], t.blockStatement(twice), true),
          [],
        );
      }
    },
  };
}

const roleQuerySite = roleSite(roleQueries);
const argumentQuerySite = firstArgumentSite(
  queryMethods(
    elementQueryPrefixes,
    queryKinds.filter((kind) => kind !== 'Role'),
  ),
);

/** The `name` of a `*ByRole(role, { name })` query, keyed by its role, or the first argument of another query. */
function querySite(call: unknown): Site | undefined {
  return roleQuerySite(call) ?? argumentQuerySite(call);
}

export function interactionTargetMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookInteractionTarget';
} {
  const swap = swapMutator(
    'LzStorybookInteractionTarget',
    sampleOf(
      "await userEvent.click(canvas.getByRole('button', { name: 'a' }));\n    await userEvent.click(canvas.getByRole('button', { name: 'b' }));",
    ),
    querySite,
  );

  return {
    name: swap.name,
    sample: swap.sample,
    *mutate(path, t) {
      const interaction = targetInteraction(path);

      if (interaction === undefined || isSkipped(interaction, t)) {
        return;
      }

      yield* [...swap.mutate(path, { cloneNode: (node) => node })]
        .filter((node) => t.isNode(node))
        .map((node) => t.cloneNode(node));
    },
  };
}

function positionOf(node: types.Node, edge: 'start' | 'end'): number {
  const position = node[edge];

  if (typeof position !== 'number') {
    throw new Error(
      `LzStorybookAssertionBefore: a ${node.type} node has no ${edge} position, which it needs to tell what runs before the interaction.`,
    );
  }

  return position;
}

/** Whether `check` reads a name declared or assigned after the interaction and before the check, which a copy before the interaction could not read. */
function readsNameBoundBetween(
  interaction: NodePath,
  check: NodePath,
): boolean {
  const after = positionOf(interaction.node, 'end');
  const before = positionOf(check.node, 'start');
  let found = false;

  check.traverse({
    ReferencedIdentifier(reference) {
      const binding = reference.scope.getBinding(reference.node.name);
      const bound = [
        binding?.identifier.start,
        ...(binding?.constantViolations ?? []).map(
          (assignment) => assignment.node.start,
        ),
      ];

      if (
        bound.some(
          (start) =>
            typeof start === 'number' && start >= after && start < before,
        )
      ) {
        found = true;
        reference.stop();
      }
    },
  });

  return found;
}

/** Whether a statement equal to `check` ends before the interaction, in the outermost function around it. */
function standsEarlier(
  check: NodePath,
  interaction: NodePath,
  t: BabelTypes,
): boolean {
  const play = interaction
    .getAncestry()
    .filter((ancestor) => ancestor.isFunction())
    .at(-1);
  const start = positionOf(interaction.node, 'start');
  let found = false;

  play?.traverse({
    ExpressionStatement(statement) {
      const { end } = statement.node;

      // A statement with no position is a replacement in a mutant Stryker has placed already, not the play's code.
      if (
        typeof end === 'number' &&
        end <= start &&
        t.isNodesEquivalent(statement.node, check.node)
      ) {
        found = true;
        statement.stop();
      }
    },
  });

  return found;
}

export function assertionBeforeMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookAssertionBefore';
} {
  return {
    name: 'LzStorybookAssertionBefore',
    sample: sampleOf(
      'await userEvent.click(button);\n    await expect(args.onClick).toHaveBeenCalled();',
    ),
    *mutate(path, t) {
      const interaction = interactionAt(path);

      if (interaction?.site !== 'statement') {
        return;
      }

      const check = checkToCopy(path, t);

      if (check !== undefined && !isSkipped(interaction, t)) {
        yield t.blockStatement([
          t.cloneNode(check),
          t.cloneNode(interaction.node),
        ]);
      }
    },
  };
}

/** The first check after the interaction, when it is an expect statement whose copy before the interaction can tell whether it held already. */
function checkToCopy(
  interaction: NodePath,
  t: BabelTypes,
): types.ExpressionStatement | undefined {
  const check = firstCheckAfter(interaction);

  return check !== undefined &&
    isExpectStatement(check) &&
    !hasNegativeCheck(check) &&
    !hasZeroCallsCheck(check) &&
    !readsNameBoundBetween(interaction, check) &&
    !standsEarlier(check, interaction, t)
    ? check.node
    : undefined;
}

export function interactionMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookInteraction';
} {
  return {
    name: 'LzStorybookInteraction',
    sample: sampleOf("await userEvent.click(canvas.getByRole('button'));"),
    *mutate(path, t) {
      const interaction = interactionAt(path);

      if (interaction !== undefined && !isSkipped(interaction, t)) {
        yield interaction.site === 'statement'
          ? t.emptyStatement()
          : t.identifier('undefined');
      }
    },
  };
}
