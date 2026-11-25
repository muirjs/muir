import { waitCall } from '@muirjs/moira-storybook';

import { queryMethods } from './queries.ts';
import type { LzStorybookTestMutator } from './mutator.ts';

const findQueries = queryMethods(['findBy', 'findAllBy']);

export function waitForMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookWaitFor';
} {
  return {
    name: 'LzStorybookWaitFor',
    sample: `export const Story = {\n  play: async ({ canvas }) => {\n    await waitFor(() => expect(canvas.getByText('a')).toBeVisible());\n  },\n};\n`,
    *mutate(path, t) {
      const call = path.node;

      if (call.type === 'ExpressionStatement' && waitCall(call) === 'removal') {
        yield t.emptyStatement();
      } else if (
        call.type === 'CallExpression' &&
        waitCall(call) === 'waitFor' &&
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
        findQueries.includes(call.callee.property.name)
      ) {
        yield t.callExpression(
          t.memberExpression(
            t.cloneNode(call.callee.object),
            t.identifier(call.callee.property.name.replace('find', 'get')),
          ),
          call.arguments.map((argument) => t.cloneNode(argument)),
        );
      }
    },
  };
}
