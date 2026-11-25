import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseSync, traverse, types, type NodePath } from '@babel/core';

import { lzTestEach } from '@muirjs/madrox-node-test';
import {
  lzIsOwn,
  lzToNodeMutator,
  own,
  type LzMutator,
} from '../../src/mutator.ts';

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

const mutator: LzMutator = {
  name: 'Alpha',
  sample: '',
  *mutate() {
    yield node;
  },
};

describe('own', () => {
  it("is the core's symbol, the same in every package that installs through the core", () => {
    assert.equal(own, Symbol.for('@muirjs/moira-node-test'));
  });
});

describe('lzToNodeMutator', () => {
  lzTestEach([
    [false, [node]],
    [true, []],
  ])(
    'gives, where isExpressionContext is %s, %j',
    (isExpressionContext, nodes) => {
      const nodeMutator = lzToNodeMutator(mutator, types, 'lz-sample-mutators');

      assert.deepEqual(
        [...nodeMutator.mutate(programPath(), { isExpressionContext })],
        nodes,
      );
      assert.equal(lzIsOwn(nodeMutator), true);
    },
  );

  it("names the package that installs it under the core's mark", () => {
    const nodeMutator = lzToNodeMutator(mutator, types, 'lz-sample-mutators');

    assert.equal(Reflect.get(nodeMutator, own), 'lz-sample-mutators');
  });
});

describe('lzIsOwn', () => {
  lzTestEach([
    [
      "a mutator with the core's mark",
      { name: 'Alpha', [Symbol.for('@muirjs/moira-node-test')]: true },
      true,
    ],
    [
      "a mutator with a package's own mark",
      { name: 'Alpha', [Symbol.for('proteus-node-test')]: true },
      false,
    ],
    ["one of Stryker's mutators", { name: 'StringLiteral' }, false],
  ])('takes %s as %s', (_title, mutator, expected) => {
    assert.equal(lzIsOwn(mutator), expected);
  });
});
