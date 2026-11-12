import type { NodePath, types } from '@babel/core';
import {
  definitionTimeStubs,
  stubMethodOf,
  type StubMethod,
  type StubMethodCall,
  type StubSite,
} from '@layzee/storybook-core';

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
      readStoryFileAt(path, sitesOf);

      if (isStubStatement(path)) {
        yield t.emptyStatement();

        return;
      }

      // A definition-time stub is removed by leaving its receiver.
      const call = stubCallAt(path);

      if (call?.site !== undefined) {
        yield t.cloneNode(call.callee.object);
      }
    },
  };
}

export function spyStubOutcomeMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookSpyStubOutcome';
} {
  return {
    name: 'LzStorybookSpyStubOutcome',
    sample: `import { fn } from 'storybook/test';\nexport const Story = {\n  args: { onSave: fn().mockResolvedValue(1) },\n};\n`,
    *mutate(path, t) {
      readStoryFileAt(path, sitesOf);

      const call = stubCallAt(path);
      const flipped = call === undefined ? undefined : outcomeMutant(call, t);

      if (flipped !== undefined) {
        yield flipped;
      }
    },
  };
}

/** A stub call: a definition-time stub, with its site, or the call of a stub statement. */
interface StubCall {
  readonly node: types.CallExpression | types.OptionalCallExpression;
  readonly callee: types.MemberExpression | types.OptionalMemberExpression;
  readonly site: StubSite | undefined;
  readonly stub: StubMethodCall;
}

function stubCallAt(path: NodePath): StubCall | undefined {
  const member = memberCall(path.node);

  if (member === undefined) {
    return undefined;
  }

  const { call: node, callee } = member;
  const site = sitesOf(path).find(
    ({ start, end }) => start === node.start && end === node.end,
  );
  const parent = path.parentPath;
  const stub =
    site ??
    (parent !== null && isStubStatement(parent) ? stubOf(node) : undefined);

  return stub === undefined ? undefined : { node, callee, site, stub };
}

/** The stub call with a resolved stub made a rejected one or back; `undefined` for a stub that settles no promise. */
function outcomeMutant(
  { node, callee, stub }: StubCall,
  t: BabelTypes,
): types.Node | undefined {
  const outcome = outcomeOf(stub.method, t);

  if (outcome === undefined) {
    return undefined;
  }

  const flippedCallee = t.cloneNode(callee);
  const flipped = t.cloneNode(node);

  flippedCallee.property = t.identifier(
    `${outcome.method}${stub.once ? 'Once' : ''}`,
  );
  flipped.callee = flippedCallee;
  flipped.arguments = [outcome.argument];

  return flipped;
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

function stubOf(node: types.Node): StubMethodCall | undefined {
  const member = memberCall(node);

  return member === undefined || member.callee.computed
    ? undefined
    : stubMethodOf(nameOf(member.callee.property));
}

/** A call, optional or not, on a member such as `x.y()` or `x?.y()`, with that member. */
function memberCall(node: types.Node):
  | {
      readonly call: types.CallExpression | types.OptionalCallExpression;
      readonly callee: types.MemberExpression | types.OptionalMemberExpression;
    }
  | undefined {
  if (
    node.type !== 'CallExpression' &&
    node.type !== 'OptionalCallExpression'
  ) {
    return undefined;
  }

  const { callee } = node;

  return callee.type === 'MemberExpression' ||
    callee.type === 'OptionalMemberExpression'
    ? { call: node, callee }
    : undefined;
}

/** The stub that flips a resolved stub to a rejected one and back. */
function outcomeOf(
  method: StubMethod,
  t: BabelTypes,
):
  | { readonly method: StubMethod; readonly argument: types.Expression }
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
