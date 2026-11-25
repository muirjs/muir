import { declareFactoryPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirShadowcatStorybookVitestPluginName,
  muirShadowcatStorybookVitestStubIgnorer,
} from './stub-ignorer.ts';

/** The `muirShadowcatStorybook` options this ignorer reads are declared once, by `@muirjs/shadowcat-storybook`; Stryker reads one schema per plugin module, so this module passes that schema on. */
export { strykerValidationSchema } from '@muirjs/shadowcat-storybook';

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirShadowcatStorybookVitestPluginName,
    muirShadowcatStorybookVitestStubIgnorer,
  ),
];
