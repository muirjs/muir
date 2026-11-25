import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseSync, traverse, types, type NodePath } from '@babel/core';

import { muirTestEach } from '@muirjs/madrox-node-test';
import {
  muirMoiraMutatorsAssertBabelTypes,
  muirMoiraMutatorsBabelBuilders,
  muirMoiraMutatorsToStrykerMutator,
  type MuirMoiraMutatorsBabelMutator,
} from '../src/babel-mutator.ts';

const node = types.emptyStatement();

function programPath(): NodePath {
  const file = parseSync('', { babelrc: false, configFile: false });
  assert.ok(file);
  const paths: NodePath[] = [];
  traverse(file, {
    Program(path) {
      paths.push(path);
    },
  });
  const [path] = paths;
  assert.ok(path);

  return path;
}

const filter = (): boolean => true;
const mutator: MuirMoiraMutatorsBabelMutator = {
  name: 'Alpha',
  sample: '',
  *mutate() {
    yield node;
  },
  filter,
};

describe('toStrykerMutator', () => {
  muirTestEach([
    [false, [node]],
    [true, []],
  ])(
    'gives, where isExpressionContext is %s, %j',
    (isExpressionContext, nodes) => {
      const strykerMutator = muirMoiraMutatorsToStrykerMutator(mutator, types);

      assert.deepEqual(
        [...strykerMutator.mutate(programPath(), { isExpressionContext })],
        nodes,
      );
    },
  );

  it("keeps the mutator's name and filter", () => {
    const { name, filter: kept } = muirMoiraMutatorsToStrykerMutator(
      mutator,
      types,
    );

    assert.deepEqual([name, kept], ['Alpha', filter]);
  });

  it('passes the path and the Babel types it was given to the mutator', () => {
    const calls: unknown[][] = [];
    const path = programPath();

    Array.from(
      muirMoiraMutatorsToStrykerMutator(
        {
          ...mutator,
          *mutate(...args) {
            calls.push(args);
            yield* [];
          },
        },
        types,
      ).mutate(path, { isExpressionContext: false }),
    );

    assert.deepEqual(calls, [[path, types]]);
  });
});

describe('assertBabelTypes', () => {
  const missing = (name: string) => new Error(`has no ${name}`);

  muirTestEach([
    [
      'types that are null',
      null,
      `has no Babel types with ${muirMoiraMutatorsBabelBuilders.join(', ')}`,
    ],
    [
      'types without a builder',
      { ...types, stringLiteral: undefined },
      'has no Babel types with stringLiteral',
    ],
    [
      'types without unaryExpression and with a cloneNode that is no function',
      { ...types, unaryExpression: undefined, cloneNode: 1 },
      'has no Babel types with cloneNode, unaryExpression',
    ],
  ])('refuses %s', (_title, value, message) => {
    assert.throws(() => muirMoiraMutatorsAssertBabelTypes(value, missing), {
      message,
    });
  });

  it('takes types that lack a member the Babel mutators do not call', () => {
    const older = Object.fromEntries(
      Object.entries(types).filter(([key]) => key !== 'tsTypeAnnotation'),
    );

    assert.doesNotThrow(() =>
      muirMoiraMutatorsAssertBabelTypes(older, missing),
    );
  });

  it('lists the builders a Babel mutator may call, frozen', () => {
    assert.ok(Object.isFrozen(muirMoiraMutatorsBabelBuilders));
    assert.deepEqual(muirMoiraMutatorsBabelBuilders, [
      'arrowFunctionExpression',
      'binaryExpression',
      'blockStatement',
      'booleanLiteral',
      'callExpression',
      'cloneNode',
      'conditionalExpression',
      'emptyStatement',
      'identifier',
      'memberExpression',
      'newExpression',
      'numericLiteral',
      'parenthesizedExpression',
      'stringLiteral',
      'throwStatement',
      'unaryExpression',
    ]);
  });
});
