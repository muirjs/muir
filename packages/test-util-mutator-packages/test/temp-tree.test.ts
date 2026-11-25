import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { muirTempRoot, muirWriteTree } from '../src/temp-tree.ts';

describe('tempRoot', () => {
  it('removes the root and the tree written under it when the test that made it ends', async (t) => {
    let root = '';

    await t.test('writes a tree', (inner) => {
      root = muirTempRoot(inner, 'muir-temp-tree-');
      muirWriteTree(root, { 'a/b/c.txt': 'c' });

      assert.equal(readFileSync(join(root, 'a', 'b', 'c.txt'), 'utf8'), 'c');
    });

    assert.equal(existsSync(root), false);
  });
});
