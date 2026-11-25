import type { NodePath, types } from '@babel/core';
import {
  muirMoiraStorybookDefinitionTimeStubs,
  muirMoiraStorybookField,
  muirMoiraStorybookStubMethodOf,
  type MuirMoiraStorybookStubMethod,
  type MuirMoiraStorybookStubMethodCall,
  type MuirMoiraStorybookDefinitionTimeStub,
  muirMoiraStorybookWrittenMethodOf,
} from '@muirjs/moira-storybook';

import type {
  MuirProteusStorybookTestBabelTypes,
  MuirProteusStorybookTestMutator,
} from './mutator.ts';
import {
  muirProteusStorybookTestIsInStoryTestCode,
  muirProteusStorybookTestPerFile,
  muirProteusStorybookTestReadStoryFileAt,
} from './story-file.ts';

export function muirProteusStorybookTestSpyStubMutator(): MuirProteusStorybookTestMutator & {
  readonly name: 'MuirProteusStorybookTestSpyStub';
} {
  return {
    name: 'MuirProteusStorybookTestSpyStub',
    sample: `import { fn } from 'storybook/test';\nexport const Story = {\n  args: { onSave: fn().mockReturnValue(1) },\n};\n`,
    *mutate(path, t) {
      muirProteusStorybookTestReadStoryFileAt(path, definitionTimeStubsIn);

      if (isStubStatement(path)) {
        yield t.emptyStatement();

        return;
      }

      // A definition-time stub is removed by leaving its receiver.
      const call = stubCallAt(path);

      if (call?.definitionTimeStub !== undefined) {
        yield t.cloneNode(call.callee.object);
      }
    },
  };
}

export function muirProteusStorybookTestSpyStubOutcomeMutator(): MuirProteusStorybookTestMutator & {
  readonly name: 'MuirProteusStorybookTestSpyStubOutcome';
} {
  return {
    name: 'MuirProteusStorybookTestSpyStubOutcome',
    sample: `import { fn } from 'storybook/test';\nexport const Story = {\n  args: { onSave: fn().mockResolvedValue(1) },\n};\n`,
    *mutate(path, t) {
      muirProteusStorybookTestReadStoryFileAt(path, definitionTimeStubsIn);

      const call = stubCallAt(path);
      const flipped = call === undefined ? undefined : outcomeMutant(call, t);

      if (flipped !== undefined) {
        yield flipped;
      }
    },
  };
}

/** A stub call: a definition-time stub, or the call of a stub statement. */
interface StubCall {
  readonly node: types.CallExpression | types.OptionalCallExpression;
  readonly callee: types.MemberExpression | types.OptionalMemberExpression;
  readonly definitionTimeStub: MuirMoiraStorybookDefinitionTimeStub | undefined;
  readonly stub: MuirMoiraStorybookStubMethodCall;
}

function stubCallAt(path: NodePath): StubCall | undefined {
  const member = memberCall(path.node);

  if (member === undefined) {
    return undefined;
  }

  const { call: node, callee } = member;
  // No two calls end at the same offset (a chain's calls share their start), so the end alone names this call.
  const definitionTimeStub = definitionTimeStubsIn(path).find(
    ({ end }) => end === node.end,
  );
  const parent = path.parentPath;

  // Stryker disable next-line ConditionalExpression,BlockStatement: only a Program path has no parent path, and a Program is no member call, so stubCallAt has returned above for it
  if (parent === null) {
    return undefined;
  }

  const stub =
    definitionTimeStub ?? (isStubStatement(parent) ? stubOf(node) : undefined);

  return stub === undefined
    ? undefined
    : { node, callee, definitionTimeStub, stub };
}

/** The stub call with a resolved stub made a rejected one or back; `undefined` for a stub that settles no promise. */
function outcomeMutant(
  { node, callee, stub }: StubCall,
  t: MuirProteusStorybookTestBabelTypes,
): types.Node | undefined {
  const outcome = outcomeOf(stub.method, t);

  if (outcome === undefined) {
    return undefined;
  }

  const flippedCallee = t.cloneNode(callee);
  const flipped = t.cloneNode(node);

  flippedCallee.property = t.identifier(
    muirMoiraStorybookWrittenMethodOf({
      method: outcome.method,
      once: stub.once,
    }),
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
    muirProteusStorybookTestIsInStoryTestCode(path)
  );
}

function stubOf(
  node: types.Node,
): MuirMoiraStorybookStubMethodCall | undefined {
  const member = memberCall(node);

  return member === undefined || member.callee.computed
    ? undefined
    : muirMoiraStorybookStubMethodOf(
        muirMoiraStorybookField(member.callee.property, 'name'),
      );
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
  method: MuirMoiraStorybookStubMethod,
  t: MuirProteusStorybookTestBabelTypes,
):
  | {
      readonly method: MuirMoiraStorybookStubMethod;
      readonly argument: types.Expression;
    }
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

const definitionTimeStubsIn = muirProteusStorybookTestPerFile(
  (program): readonly MuirMoiraStorybookDefinitionTimeStub[] =>
    muirMoiraStorybookDefinitionTimeStubs(program.node),
  [],
);
