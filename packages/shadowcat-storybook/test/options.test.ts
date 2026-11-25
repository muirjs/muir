import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirShadowcatStorybookOptions,
  muirShadowcatStorybookVitestConfigFile,
} from '../src/options.ts';

describe('vitestConfigFile', () => {
  it("takes the config file from Stryker's vitest.configFile", () => {
    assert.equal(
      muirShadowcatStorybookVitestConfigFile({
        vitest: { configFile: 'vitest.storybook.config.ts' },
      }),
      'vitest.storybook.config.ts',
    );
  });

  it('leaves the config file to Vitest without vitest.configFile', () => {
    assert.equal(
      muirShadowcatStorybookVitestConfigFile({ vitest: {} }),
      undefined,
    );
  });
});

describe('muirShadowcatStorybookOptions', () => {
  it('uses .storybook as the config folder when muirShadowcatStorybook is not set', () => {
    assert.deepEqual(muirShadowcatStorybookOptions({}), {
      configDir: '.storybook',
    });
  });

  it('takes the config folder from muirShadowcatStorybook.configDir', () => {
    assert.deepEqual(
      muirShadowcatStorybookOptions({
        muirShadowcatStorybook: { configDir: 'apps/ui/.storybook' },
      }),
      { configDir: 'apps/ui/.storybook' },
    );
  });

  it('rejects a config folder that is not a string, naming the option', () => {
    assert.throws(
      () =>
        muirShadowcatStorybookOptions({
          muirShadowcatStorybook: { configDir: 42 },
        }),
      {
        message:
          '@muirjs/shadowcat-storybook: muirShadowcatStorybook.configDir must be a string, not 42',
      },
    );
  });
});
