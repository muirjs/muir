import type { NodePath, types } from '@babel/core';
import {
  firstArgumentSite,
  roleSite,
  swapMutator,
  type Site,
} from '@layzee/stryker-mutator-install';

import {
  elementQueryPrefixes,
  fireEventMethod,
  firstCheckAfter,
  hasNegativeCheck,
  hasZeroCallsCheck,
  isExpectStatement,
  isInteractionBody,
  isInteractionStatement,
  isQueryCall,
  isSkipped,
  isUnskippedInteraction,
  queryKinds,
  queryMethods,
  targetStatement,
  userEventCall,
  type UserEventCall,
} from './interactions.ts';
import type { BabelTypes, LzStorybookTestMutator } from './mutator.ts';

function sampleOf(statement: string): string {
  return `export const Story = {\n  play: async ({ canvas, userEvent }) => {\n    ${statement}\n  },\n};\n`;
}

const clickMethods: readonly string[] = ['click', 'dblClick'];

/** A click target with no effects of its own: an identifier, a query, or an awaited query. */
function focusTarget(
  target: types.Node | undefined,
): types.Expression | undefined {
  if (target?.type === 'Identifier') {
    return target;
  }

  if (target?.type !== 'AwaitExpression' && target?.type !== 'CallExpression') {
    return undefined;
  }

  const query = target.type === 'AwaitExpression' ? target.argument : target;

  return isQueryCall(query) && !textFieldRoles.includes(queryRole(query))
    ? target
    : undefined;
}

// Clicking an element of these roles is meant to focus it.
const textFieldRoles: readonly (string | undefined)[] = [
  'textbox',
  'searchbox',
  'combobox',
];

const roleQueries = queryMethods(elementQueryPrefixes, ['Role']);

/** The role a `*ByRole` query names in a string literal. */
function queryRole(query: types.Node): string | undefined {
  if (
    query.type !== 'CallExpression' ||
    query.callee.type !== 'MemberExpression' ||
    query.callee.property.type !== 'Identifier' ||
    !roleQueries.includes(query.callee.property.name)
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
      const call = userEventCall(path);
      const target = focusTarget(call?.target);

      if (
        call !== undefined &&
        clickMethods.includes(call.method) &&
        target !== undefined &&
        isUnskippedInteraction(path, t)
      ) {
        const focus = t.callExpression(
          t.memberExpression(t.cloneNode(target), t.identifier('focus')),
          [],
        );

        yield t.expressionStatement(
          path.node.expression.type === 'AwaitExpression'
            ? t.awaitExpression(focus)
            : focus,
        );
      }
    },
  };
}

const repeatedMethods: readonly string[] = ['click', 'dblClick', 'keyboard'];

/** A click, a dblClick, or a key press other than one that a second press repeats with no change. */
function isRepeatedUserEvent(call: UserEventCall | undefined): boolean {
  return (
    call !== undefined &&
    repeatedMethods.includes(call.method) &&
    !(
      call.method === 'keyboard' &&
      call.target?.type === 'StringLiteral' &&
      idempotentKeys.includes(call.target.value)
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
      if (
        (isRepeatedUserEvent(userEventCall(path)) ||
          fireEventMethod(path) === 'click') &&
        isUnskippedInteraction(path, t)
      ) {
        yield t.blockStatement([
          t.cloneNode(path.node),
          t.cloneNode(path.node),
        ]);
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
      const statement = targetStatement(path);

      if (statement === undefined || !isUnskippedInteraction(statement, t)) {
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
            typeof start === 'number' && start > after && start < before,
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
      const check = isInteractionStatement(path)
        ? checkToCopy(path, t)
        : undefined;

      if (check !== undefined && isUnskippedInteraction(path, t)) {
        yield t.blockStatement([t.cloneNode(check), t.cloneNode(path.node)]);
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
      if (isUnskippedInteraction(path, t)) {
        yield t.emptyStatement();
      } else if (isInteractionBody(path) && !isSkipped(path, t)) {
        yield t.identifier('undefined');
      }
    },
  };
}
