import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { commonTokens } from '@stryker-mutator/api/plugin';
import { Ajv } from 'ajv';

import { muirShadowcatStorybookCsfIgnorer } from '../src/csf-ignorer.ts';
import * as entry from '../src/index.ts';
import { strykerPlugins, strykerValidationSchema } from '../src/index.ts';
import { muirShadowcatStorybookStrykerStorybookProject } from '../src/options.ts';
import { muirShadowcatStorybookStrykerPlugin } from '../src/stryker-vite-plugin.ts';

describe('package entry', () => {
  // Stryker loads a plugin module by its package name.
  it('is the module the package name resolves to', () => {
    assert.equal(
      import.meta.resolve('@muirjs/shadowcat-storybook'),
      new URL('../src/index.ts', import.meta.url).href,
    );
  });

  it('exports the Vite plugin for the Vitest config that Stryker runs', () => {
    assert.equal(
      entry.muirShadowcatStorybookStrykerPlugin,
      muirShadowcatStorybookStrykerPlugin,
    );
  });

  it('exports the Storybook project reader for the packages that share the muirShadowcatStorybook options', () => {
    assert.equal(
      entry.muirShadowcatStorybookStrykerStorybookProject,
      muirShadowcatStorybookStrykerStorybookProject,
    );
  });

  it('declares the CSF ignorer, which Stryker passes the options and the logger', () => {
    assert.deepEqual(
      strykerPlugins.map(({ kind, name, factory }) => ({
        kind,
        name,
        factory,
        inject: 'inject' in factory ? factory.inject : undefined,
      })),
      [
        {
          kind: 'Ignore',
          name: 'muir-shadowcat-storybook-csf',
          factory: muirShadowcatStorybookCsfIgnorer,
          inject: [commonTokens.options, commonTokens.logger],
        },
      ],
    );
  });
});

// The Ajv settings of Stryker's OptionsValidator (@stryker-mutator/core, src/config/options-validator.ts), which checks
// a config against the schema a plugin exports.
function validate(options: object) {
  const ajv = new Ajv({
    useDefaults: true,
    allErrors: true,
    jsPropertySyntax: true,
    verbose: true,
    logger: false,
    strict: false,
  });
  const check = ajv.compile(strykerValidationSchema);
  const copy = structuredClone(options);

  return { valid: check(copy), options: copy };
}

describe('strykerValidationSchema', () => {
  it("fills in the defaults in Stryker's check of the options", () => {
    assert.deepEqual(validate({}), {
      valid: true,
      options: {
        muirShadowcatStorybook: { configDir: '.storybook' },
        muirShadowcatStorybookCsf: { play: 'ignore' },
      },
    });
  });

  it('rejects a config folder that is not a string', () => {
    assert.equal(
      validate({ muirShadowcatStorybook: { configDir: 42 } }).valid,
      false,
    );
  });

  it('rejects a play mode other than ignore and mutate', () => {
    assert.equal(
      validate({ muirShadowcatStorybookCsf: { play: 'skip' } }).valid,
      false,
    );
  });

  it('accepts the mutate play mode', () => {
    assert.equal(
      validate({ muirShadowcatStorybookCsf: { play: 'mutate' } }).valid,
      true,
    );
  });

  it('rejects an muirShadowcatStorybook key it does not know', () => {
    assert.equal(
      validate({ muirShadowcatStorybook: { configdir: 'sb' } }).valid,
      false,
    );
  });

  it('rejects an muirShadowcatStorybookCsf key it does not know', () => {
    assert.equal(
      validate({ muirShadowcatStorybookCsf: { plays: 'mutate' } }).valid,
      false,
    );
  });

  it('rejects muirShadowcatStorybook when it is not an object', () => {
    assert.equal(
      validate({ muirShadowcatStorybook: '.storybook' }).valid,
      false,
    );
  });

  it('rejects muirShadowcatStorybookCsf when it is not an object', () => {
    assert.equal(
      validate({ muirShadowcatStorybookCsf: 'mutate' }).valid,
      false,
    );
  });
});
