import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { strykerValidationSchema as shadowcatStorybookSchema } from '@muirjs/shadowcat-storybook';
import { commonTokens } from '@stryker-mutator/api/plugin';

import { strykerPlugins, strykerValidationSchema } from '../src/index.ts';
import { muirBansheeStorybookVitestReporter } from '../src/reporter.ts';

describe('package entry', () => {
  // Stryker loads a plugin module by its package name.
  it('is the module the package name resolves to', () => {
    assert.equal(
      import.meta.resolve('@muirjs/banshee-storybook-vitest'),
      new URL('../src/index.ts', import.meta.url).href,
    );
  });

  it('declares the reporter, which Stryker passes the options and the logger', () => {
    assert.deepEqual(
      strykerPlugins.map(({ kind, name, factory }) => ({
        kind,
        name,
        factory,
        inject: 'inject' in factory ? factory.inject : undefined,
      })),
      [
        {
          kind: 'Reporter',
          name: 'muir-banshee-storybook-vitest',
          factory: muirBansheeStorybookVitestReporter,
          inject: [commonTokens.options, commonTokens.logger],
        },
      ],
    );
  });

  it("passes on @muirjs/shadowcat-storybook's schema, which declares the muirShadowcatStorybook options", () => {
    assert.equal(strykerValidationSchema, shadowcatStorybookSchema);
  });
});
