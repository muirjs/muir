import type { NodePath, types } from '@babel/core';
import {
  firstArgumentSite,
  roleSite,
  swapMutator,
  type Site,
} from '@layzee/stryker-mutator-install';

import {
  awaited,
  elementQueryPrefixes,
  fireEventMethod,
  firstCheckAfter,
  hasNegativeCheck,
  isExpectStatement,
  isInteractionBody,
  isInteractionStatement,
  isQueryCall,
  isSkipped,
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

function isAwaited(statement: types.Node): boolean {
  return (
    statement.type === 'ExpressionStatement' &&
    statement.expression.type === 'AwaitExpression'
  );
}

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
        !isSkipped(path, t)
      ) {
        const focus = t.callExpression(
          t.memberExpression(target, t.identifier('focus')),
          [],
        );

        yield t.expressionStatement(
          isAwaited(path.node) ? t.awaitExpression(focus) : focus,
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
      const statement = path.node;

      if (
        (isRepeatedUserEvent(userEventCall(path)) ||
          fireEventMethod(path) === 'click') &&
        statement.type === 'ExpressionStatement' &&
        !isSkipped(path, t)
      ) {
        yield t.blockStatement([
          t.cloneNode(statement),
          t.cloneNode(statement),
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

      if (statement === undefined || isSkipped(statement, t)) {
        return;
      }

      yield* [
        ...swap.mutate(path, {
          cloneNode: (node) => (t.isNode(node) ? t.cloneNode(node) : node),
        }),
      ].filter((node) => t.isNode(node));
    },
  };
}

/** `expect(...).toHaveBeenCalledTimes(0);`, awaited or not. */
function isZeroCallsCheck(statement: types.ExpressionStatement): boolean {
  const call = awaited(statement.expression);
  const [count] = call.type === 'CallExpression' ? call.arguments : [];

  return (
    call.type === 'CallExpression' &&
    call.callee.type === 'MemberExpression' &&
    call.callee.property.type === 'Identifier' &&
    call.callee.property.name === 'toHaveBeenCalledTimes' &&
    count?.type === 'NumericLiteral' &&
    count.value === 0
  );
}

/** Whether `check` reads a name declared after the interaction and before the check, which a copy before the interaction could not read. */
function readsNameDeclaredBetween(
  interaction: NodePath,
  check: NodePath,
): boolean {
  const after = interaction.node.end ?? 0;
  const before = check.node.start ?? 0;
  let found = false;

  check.traverse({
    ReferencedIdentifier(reference) {
      const declared = reference.scope.getBinding(reference.node.name)
        ?.identifier.start;

      if (
        typeof declared === 'number' &&
        declared > after &&
        declared < before
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
  const start = interaction.node.start ?? 0;
  let found = false;

  play?.traverse({
    ExpressionStatement(statement) {
      if (
        (statement.node.end ?? start) <= start &&
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
      const statement = path.node;
      const check = isInteractionStatement(path)
        ? checkToCopy(path, t)
        : undefined;

      if (
        check !== undefined &&
        statement.type === 'ExpressionStatement' &&
        !isSkipped(path, t)
      ) {
        yield t.blockStatement([t.cloneNode(check), t.cloneNode(statement)]);
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
    check.node.type === 'ExpressionStatement' &&
    isExpectStatement(check) &&
    !hasNegativeCheck(check) &&
    !isZeroCallsCheck(check.node) &&
    !readsNameDeclaredBetween(interaction, check) &&
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
      if (isInteractionStatement(path) && !isSkipped(path, t)) {
        yield t.emptyStatement();
      } else if (isInteractionBody(path) && !isSkipped(path, t)) {
        yield t.identifier('undefined');
      }
    },
  };
}
