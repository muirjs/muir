import type { types } from '@babel/core';

import {
  isInteractionBody,
  isInteractionStatement,
  isQueryCall,
  isSkipped,
  userEventCall,
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
