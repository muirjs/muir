import { declareFactoryPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import { muirBansheeStorybookVitestPluginName } from './package-name.ts';
import { muirBansheeStorybookVitestReporter } from './reporter.ts';

/** The `muirShadowcatStorybook` options this reporter reads are declared once, by `@muirjs/shadowcat-storybook`; Stryker reads one schema per plugin module, so this module passes that schema on. */
export { strykerValidationSchema } from '@muirjs/shadowcat-storybook';
export type { MuirBansheeStorybookVitestReport } from './reporter.ts';

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.Reporter,
    muirBansheeStorybookVitestPluginName,
    muirBansheeStorybookVitestReporter,
  ),
];
