import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirShadowcatStorybookOptions,
  muirShadowcatStorybookVitestConfigFile,
} from '../src/options.ts';

const packageName = '@muirjs/example-package';

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
    assert.deepEqual(muirShadowcatStorybookOptions({}, packageName), {
      configDir: '.storybook',
    });
  });

  it('takes the config folder from muirShadowcatStorybook.configDir', () => {
    assert.deepEqual(
      muirShadowcatStorybookOptions(
        { muirShadowcatStorybook: { configDir: 'apps/ui/.storybook' } },
        packageName,
      ),
      { configDir: 'apps/ui/.storybook' },
    );
  });

  it('rejects a config folder that is not a string, naming the given package and the option', () => {
    assert.throws(
      () =>
        muirShadowcatStorybookOptions(
          { muirShadowcatStorybook: { configDir: 42 } },
          packageName,
        ),
      {
        message:
          '@muirjs/example-package: muirShadowcatStorybook.configDir must be a string, not 42',
      },
    );
  });
});
