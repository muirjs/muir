import type { types } from '@babel/core';
import {
  fieldOf,
  literalValue,
  swapMutator,
  type Site,
} from '@layzee/stryker-mutator-install';

import {
  fireEventMethod,
  isInteractionBody,
  isInteractionStatement,
  isQueryCall,
  isSkipped,
  targetStatement,
  userEventCall,
  type UserEventCall,
} from './interactions.ts';
import type { LzStorybookTestMutator } from './mutator.ts';

function sampleOf(statement: string): string {
  return `export const Story = {\n  play: async ({ canvas, userEvent }) => {\n    ${statement}\n  },\n};\n`;
}

const clickMethods: readonly string[] = ['click', 'dblClick'];

/** `await <x>;`. */
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

/** The role a `*ByRole` query names in a string literal. */
function queryRole(query: types.Node): string | undefined {
  if (
    query.type !== 'CallExpression' ||
    query.callee.type !== 'MemberExpression' ||
    query.callee.property.type !== 'Identifier' ||
    !query.callee.property.name.endsWith('ByRole')
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

function listOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The `name` of a `getByRole(role, { name })` query, keyed by its role, or the first argument of another query. */
function querySite(call: unknown): Site | undefined {
  const method = fieldOf(fieldOf(fieldOf(call, 'callee'), 'property'), 'name');
  const [first, options] = listOf(fieldOf(call, 'arguments'));

  if (typeof method !== 'string' || !/^(get|find|query)By[A-Z]/.test(method)) {
    return undefined;
  }

  if (method.endsWith('ByRole')) {
    const name = fieldOf(
      listOf(fieldOf(options, 'properties')).find(
        (property) => fieldOf(fieldOf(property, 'key'), 'name') === 'name',
      ),
      'value',
    );
    const value = literalValue(name);

    return value === undefined
      ? undefined
      : { key: `${method}:${literalValue(first)}`, value, node: name };
  }

  const value = literalValue(first);

  return value === undefined ? undefined : { key: method, value, node: first };
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
