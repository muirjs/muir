import type { NodePath, types } from '@babel/core';
import {
  definitionTimeStubs,
  stubMethodOf,
  type StubMethod,
  type StubSite,
} from '@layzee/storybook-csf';

import type { BabelTypes, LzStorybookTestMutator } from './mutator.ts';
import { nameOf } from './nodes.ts';
import { isInStoryTestCode, perFile, readStoryFileAt } from './story-file.ts';

export function spyStubMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookSpyStub';
} {
  return {
    name: 'LzStorybookSpyStub',
    sample: `import { fn } from 'storybook/test';\nexport const Story = {\n  args: { onSave: fn().mockReturnValue(1) },\n};\n`,
    *mutate(path, t) {
      readStoryFileAt(path);

      const { node } = path;

      if (isStubStatement(path)) {
        yield t.emptyStatement();

        return;
      }

      if (
        node.type !== 'CallExpression' &&
        node.type !== 'OptionalCallExpression'
      ) {
        return;
      }

      const { callee } = node;

      if (
        callee.type !== 'MemberExpression' &&
        callee.type !== 'OptionalMemberExpression'
      ) {
        return;
      }

      const site = sitesOf(path).find(
        ({ start, end }) => start === node.start && end === node.end,
      );
      const parent = path.parentPath;
      const stub =
        site ??
        (parent !== null && isStubStatement(parent) ? stubOf(node) : undefined);

      if (stub === undefined) {
        return;
      }

      if (site !== undefined) {
        yield t.cloneNode(callee.object);
      }

      const outcome = outcomeOf(stub.method, t);

      if (outcome !== undefined) {
        const flippedCallee = t.cloneNode(callee);
        const flipped = t.cloneNode(node);

        flippedCallee.computed = false;
        flippedCallee.property = t.identifier(
          `${outcome.method}${stub.once ? 'Once' : ''}`,
        );
        flipped.callee = flippedCallee;
        flipped.arguments = [outcome.argument];

        yield flipped;
      }
    },
  };
}

/** An expression statement in story test code whose call sets a spy stub, such as `mocked(save).mockResolvedValue(note);`. */
function isStubStatement(path: NodePath): boolean {
  const { node } = path;

  return (
    node.type === 'ExpressionStatement' &&
    stubOf(node.expression) !== undefined &&
    isInStoryTestCode(path)
  );
}

function stubOf(node: types.Node): ReturnType<typeof stubMethodOf> {
  return (node.type === 'CallExpression' ||
    node.type === 'OptionalCallExpression') &&
    (node.callee.type === 'MemberExpression' ||
      node.callee.type === 'OptionalMemberExpression')
    ? stubMethodOf(nameOf(node.callee.property))
    : undefined;
}

/** The stub that flips a resolved stub to a rejected one and back. */
function outcomeOf(
  method: StubMethod,
  t: BabelTypes,
):
  | { readonly method: string; readonly argument: types.Expression }
  | undefined {
  switch (method) {
    case 'mockResolvedValue': {
      return {
        method: 'mockRejectedValue',
        argument: t.newExpression(t.identifier('Error'), [
          t.stringLiteral('Stryker'),
        ]),
      };
    }
    case 'mockRejectedValue': {
      return {
        method: 'mockResolvedValue',
        argument: t.identifier('undefined'),
      };
    }
    case 'mockReturnValue':
    case 'mockImplementation': {
      return undefined;
    }
  }
}

const sitesOf = perFile(
  (program): readonly StubSite[] => definitionTimeStubs(program),
  [],
);
