import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { StrykerOptions } from '@stryker-mutator/api/core';
import { PluginKind } from '@stryker-mutator/api/plugin';
import ajvModule from 'ajv';

import { muirTestEach } from '@muirjs/madrox-node-test';
import * as entry from '../../src/index.ts';
import {
  MuirSirynNodeTestTestRunner,
  strykerPlugins,
  strykerValidationSchema,
} from '../../src/index.ts';
import { muirSirynNodeTestMinNodeVersion } from '../../src/runner.ts';
import pkg from '../../package.json' with { type: 'json' };

/** Stryker validates its options with these settings, and merges the properties of each plugin's schema into its own. */
function validator() {
  return new ajvModule.default({
    useDefaults: true,
    allErrors: true,
    strict: false,
  }).compile({
    type: 'object',
    properties: strykerValidationSchema.properties,
  });
}

describe('plugin declaration', () => {
  it('exports only the plugin, its schema and the runner class from the package entry', () => {
    assert.deepEqual(Object.keys(entry).sort(), [
      'MuirSirynNodeTestTestRunner',
      'strykerPlugins',
      'strykerValidationSchema',
    ]);
  });

  it('declares the muir-siryn-node-test test runner', () => {
    assert.deepEqual(strykerPlugins, [
      {
        kind: PluginKind.TestRunner,
        name: 'muir-siryn-node-test',
        injectableClass: MuirSirynNodeTestTestRunner,
      },
    ]);
  });

  muirTestEach([
    {},
    { muirSirynNodeTest: {} },
    { muirSirynNodeTest: { testFiles: ['a.test.ts', 'b/*.test.ts'] } },
    {
      muirSirynNodeTest: {
        nodeArgs: ['--enable-source-maps', '--stack-size=900'],
      },
    },
    { muirSirynNodeTest: { maxMemoryMB: 1500 } },
  ])('accepts the options %j', (options) => {
    assert.ok(validator()(options));
  });

  muirTestEach([
    { muirSirynNodeTest: '*.test.ts' },
    { muirSirynNodeTest: { testFiles: '*.test.ts' } },
    { muirSirynNodeTest: { testFiles: [1] } },
    { muirSirynNodeTest: { testfiles: ['*.test.ts'] } },
    { muirSirynNodeTest: { nodeArgs: '--enable-source-maps' } },
    { muirSirynNodeTest: { nodeArgs: [1] } },
    { muirSirynNodeTest: { maxMemoryMB: '1500' } },
    { muirSirynNodeTest: { maxMemoryMB: 0 } },
    { muirSirynNodeTest: { maxMemoryMB: 1.5 } },
  ])('rejects the options %j', (options) => {
    assert.ok(!validator()(options));
  });

  it('gives stryker init the keyword it lists test runners by, a homepage, and a config that names and loads the runner', () => {
    // stryker init merges initStrykerConfig over the config it writes, so its fields must be Stryker options.
    const initConfig: Partial<StrykerOptions> = pkg.initStrykerConfig;

    assert.ok(pkg.keywords.includes('@stryker-mutator/test-runner-plugin'));
    assert.match(
      pkg.homepage,
      /^https:\/\/github\.com\/.+\/packages\/siryn-node-test#readme$/,
    );
    assert.deepEqual(
      [initConfig],
      strykerPlugins.map((plugin) => ({
        testRunner: plugin.name,
        appendPlugins: [pkg.name],
      })),
    );
  });

  it('supports the Node.js versions that package.json supports', () => {
    assert.equal(
      pkg.engines.node,
      `>=${muirSirynNodeTestMinNodeVersion.join('.')}`,
    );
  });

  muirTestEach([
    [
      {},
      {
        muirSirynNodeTest: {
          testFiles: ['**/?(*.)+(spec|test).[jt]s?(x)'],
          nodeArgs: [],
        },
      },
    ],
    [
      { muirSirynNodeTest: { maxMemoryMB: 1500 } },
      {
        muirSirynNodeTest: {
          testFiles: ['**/?(*.)+(spec|test).[jt]s?(x)'],
          nodeArgs: [],
          maxMemoryMB: 1500,
        },
      },
    ],
    [
      {
        muirSirynNodeTest: {
          testFiles: ['a.test.ts'],
          nodeArgs: ['--enable-source-maps'],
        },
      },
      {
        muirSirynNodeTest: {
          testFiles: ['a.test.ts'],
          nodeArgs: ['--enable-source-maps'],
        },
      },
    ],
  ])('fills in the defaults of %j', (options, filled) => {
    assert.ok(validator()(options));
    assert.deepEqual(options, filled);
  });
});
