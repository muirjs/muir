import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  instrumenterOverrideSnippet,
  instrumenterTraverseOverride,
} from './babel-override.ts';
import { workspaceRoot } from './stryker-configs.fixtures.ts';

function read(path: string): string {
  return readFileSync(join(workspaceRoot, path), 'utf8');
}

function manifest(path: string): unknown {
  return JSON.parse(read(path));
}

describe('instrumenterTraverseOverride', () => {
  it("reads the @babel/traverse version a manifest's overrides give @stryker-mutator/instrumenter", () => {
    assert.equal(
      instrumenterTraverseOverride({
        overrides: {
          '@stryker-mutator/instrumenter': { '@babel/traverse': '8.1.4' },
        },
      }),
      '8.1.4',
    );
  });

  it('finds none in a manifest without that override', () => {
    assert.equal(instrumenterTraverseOverride({}), undefined);
    assert.equal(
      instrumenterTraverseOverride({ overrides: { other: { x: '1' } } }),
      undefined,
    );
    assert.equal(
      instrumenterTraverseOverride({
        overrides: {
          '@stryker-mutator/instrumenter': { '@babel/traverse': 8 },
        },
      }),
      undefined,
    );
  });
});

describe('instrumenterOverrideSnippet', () => {
  it('writes the override as the README and the error message show it', () => {
    assert.equal(
      instrumenterOverrideSnippet('8.1.4'),
      '"overrides": { "@stryker-mutator/instrumenter": { "@babel/traverse": "8.1.4" } }',
    );
  });
});

describe("the workspace's @babel/traverse override", () => {
  const root = manifest('package.json');
  const version = instrumenterTraverseOverride(root);

  it('gives the instrumenter the @babel/traverse the workspace root installs', () => {
    const installed =
      typeof root === 'object' &&
      root !== null &&
      'devDependencies' in root &&
      typeof root.devDependencies === 'object' &&
      root.devDependencies !== null &&
      '@babel/traverse' in root.devDependencies
        ? root.devDependencies['@babel/traverse']
        : undefined;

    assert.notEqual(version, undefined);
    assert.equal(version, installed);
  });

  it('is the override of the Storybook end-to-end fixture', () => {
    assert.equal(
      instrumenterTraverseOverride(
        manifest('e2e/fixtures/storybook-react/package.json'),
      ),
      version,
    );
  });

  for (const path of [
    'packages/shadowcat-storybook/README.md',
    'packages/moira-storybook/src/node-field.ts',
  ]) {
    it(`is the override ${path} names`, () => {
      assert.ok(
        read(path).includes(instrumenterOverrideSnippet(version ?? '')),
        `${path} does not name ${instrumenterOverrideSnippet(version ?? '')}`,
      );
    });
  }
});
