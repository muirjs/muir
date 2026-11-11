import type { NodePath, types } from '@babel/core';
import {
  definitionTimeStubs,
  stubMethods,
  type StubMethod,
  type StubSite,
} from '@layzee/storybook-csf';

import { isInStoryTestCode, readStoryFileAt } from './interactions.ts';
import type { BabelTypes, LzStorybookTestMutator } from './mutator.ts';
import { nameOf } from './nodes.ts';

const sitesByProgram = new WeakMap<object, readonly StubSite[]>();

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
        node.type !== 'CallExpression' ||
        node.callee.type !== 'MemberExpression'
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
        yield t.cloneNode(node.callee.object);
      }

      const outcome = outcomeOf(stub.method, t);

      if (outcome !== undefined) {
        yield t.callExpression(
          t.memberExpression(
            t.cloneNode(node.callee.object),
            t.identifier(`${outcome.method}${stub.once ? 'Once' : ''}`),
          ),
          [outcome.argument],
        );
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

function stubOf(
  node: types.Node,
): { readonly method: StubMethod; readonly once: boolean } | undefined {
  const name =
    node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
      ? nameOf(node.callee.property)
      : undefined;
  const method = stubMethods.find(
    (candidate) => name === candidate || name === `${candidate}Once`,
  );

  return method === undefined ? undefined : { method, once: name !== method };
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

function sitesOf(path: NodePath): readonly StubSite[] {
  const program = path.isProgram()
    ? path
    : path.findParent((parent) => parent.isProgram());

  if (program === null) {
    return [];
  }

  const read = sitesByProgram.get(program.node);

  if (read !== undefined) {
    return read;
  }

  const sites = definitionTimeStubs(program.node);

  sitesByProgram.set(program.node, sites);

  return sites;
}
