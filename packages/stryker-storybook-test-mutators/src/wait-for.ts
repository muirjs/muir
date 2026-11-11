import type { types } from '@babel/core';

import type { LzStorybookTestMutator } from './mutator.ts';

/** `waitForElementToBeRemoved(...);`, awaited or not. */
function isRemovalWait(node: types.Node): boolean {
  if (node.type !== 'ExpressionStatement') {
    return false;
  }

  const call =
    node.expression.type === 'AwaitExpression'
      ? node.expression.argument
      : node.expression;

  return (
    call.type === 'CallExpression' &&
    call.callee.type === 'Identifier' &&
    call.callee.name === 'waitForElementToBeRemoved'
  );
}

export function waitForMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookWaitFor';
} {
  return {
    name: 'LzStorybookWaitFor',
    sample: `export const Story = {\n  play: async ({ canvas }) => {\n    await waitFor(() => expect(canvas.getByText('a')).toBeVisible());\n  },\n};\n`,
    *mutate(path, t) {
      const call = path.node;

      if (isRemovalWait(call)) {
        yield t.emptyStatement();
      } else if (
        call.type === 'CallExpression' &&
        call.callee.type === 'Identifier' &&
        call.callee.name === 'waitFor' &&
        call.arguments[0]?.type === 'ArrowFunctionExpression'
      ) {
        yield t.callExpression(
          t.arrowFunctionExpression(
            [],
            t.cloneNode(call.arguments[0].body),
            true,
          ),
          [],
        );
      } else if (
        call.type === 'CallExpression' &&
        call.callee.type === 'MemberExpression' &&
        call.callee.property.type === 'Identifier' &&
        /^find(All)?By[A-Z]/.test(call.callee.property.name)
      ) {
        yield t.callExpression(
          t.memberExpression(
            t.cloneNode(call.callee.object),
            t.identifier(call.callee.property.name.replace(/^find/, 'get')),
          ),
          call.arguments.map((argument) => t.cloneNode(argument)),
        );
      }
    },
  };
}
