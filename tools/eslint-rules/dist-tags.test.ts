import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { muirDistTags } from './dist-tags.ts';

describe('muirDistTags', () => {
  it('gives no tag to a package that names no StrykerJS peer and no technology with versions of its own', () => {
    assert.deepEqual(
      muirDistTags({ name: '@muirjs/moira-storybook', version: '0.0.1' }),
      [],
    );
  });

  it('tags a package with the StrykerJS major its peer range starts at', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/proteus-js',
        version: '0.0.1',
        peerDependencies: { '@stryker-mutator/core': '~10.1.0' },
      }),
      ['stryker-10'],
    );
  });

  it('tags a package with every StrykerJS major its peer range lists', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/proteus-js',
        version: '11.0.0',
        peerDependencies: { '@stryker-mutator/core': '^10.1.1 || ^11.0.0' },
      }),
      ['stryker-10', 'stryker-11'],
    );
  });

  it('tags a package whose name has the node technology with every Node.js major its engines list', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/madrox-node-test',
        version: '0.0.1',
        engines: { node: '^22.18.0 || ^24.11.0 || ^26.13.0' },
      }),
      ['node-22', 'node-24', 'node-26'],
    );
  });

  it('gives no Node.js tag to a package whose name has no node technology, whatever its engines', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/proteus-react',
        version: '0.0.1',
        engines: { node: '^22.18.0 || ^24.11.0 || ^26.13.0' },
        peerDependencies: { '@stryker-mutator/core': '~10.1.0' },
      }),
      ['stryker-10'],
    );
  });

  it('tags a package that has a Playwright Test peer with the major and minor its range starts at', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/siryn-playwright',
        version: '0.0.1',
        peerDependencies: {
          '@playwright/test': '>=1.63.0 <2',
          '@stryker-mutator/core': '^10.0.0',
        },
      }),
      ['stryker-10', 'playwright-1.63'],
    );
  });

  it('reads a major and a minor of two digits each', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/siryn-playwright',
        version: '0.0.1',
        peerDependencies: { '@playwright/test': '>=12.34.0 <13' },
      }),
      ['playwright-12.34'],
    );
  });

  it('tags a package that has a Storybook peer with the Storybook major its range starts at', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/proteus-storybook',
        version: '0.0.1',
        peerDependencies: {
          '@stryker-mutator/core': '~10.1.0',
          storybook: '^10.6.0',
        },
      }),
      ['stryker-10', 'storybook-10'],
    );
  });

  it('tags a package that has a Vitest peer with every Vitest major its range lists', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/moira-storybook',
        version: '0.0.1',
        peerDependencies: {
          storybook: '^10.6.0',
          vitest: '^4.0.0 || ^5.0.0',
        },
      }),
      ['storybook-10', 'vitest-4', 'vitest-5'],
    );
  });

  it('tags a package that has an MSW peer with every MSW major its range lists', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/proteus-msw',
        version: '0.0.1',
        peerDependencies: { msw: '^2.0.0 || ^3.0.0' },
      }),
      ['msw-2', 'msw-3'],
    );
  });

  it('tags a package that has a React peer with every React major its range lists', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/proteus-react',
        version: '0.0.1',
        peerDependencies: {
          react: '^16.14.0 || ^17.0.0 || ^18.0.0 || ^19.0.0',
        },
      }),
      ['react-16', 'react-17', 'react-18', 'react-19'],
    );
  });

  it('skips an alternative of a range that names no version', () => {
    assert.deepEqual(
      muirDistTags({
        name: '@muirjs/proteus-js',
        version: '0.0.1',
        peerDependencies: { '@stryker-mutator/core': '^10.1.1 || *' },
      }),
      ['stryker-10'],
    );
  });

  it('refuses a manifest that is not an object', () => {
    assert.throws(
      () => muirDistTags('@muirjs/proteus-js'),
      new TypeError('The manifest is not an object.'),
    );
  });
});

function runCli(args: readonly string[]): {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
} {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'dist-tags.cli.ts'), ...args],
    { encoding: 'utf8', windowsHide: true },
  );

  return { code: status, stdout, stderr };
}

describe('dist-tags.cli.ts', () => {
  it('prints the tags of the manifest file, one per line', () => {
    const { code, stdout } = runCli([
      join(import.meta.dirname, '../../packages/siryn-node-test/package.json'),
    ]);

    assert.deepEqual(
      { code, stdout },
      { code: 0, stdout: 'stryker-10\nnode-22\nnode-24\nnode-26\n' },
    );
  });

  it('fails with its usage when no manifest file is given', () => {
    const { code, stdout, stderr } = runCli([]);

    assert.deepEqual(
      { failed: code !== 0, stdout },
      { failed: true, stdout: '' },
    );
    assert.match(
      stderr,
      /^Error: Usage: node tools\/eslint-rules\/dist-tags\.cli\.ts <package\.json>$/m,
    );
  });
});
