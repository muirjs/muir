import { declareClassPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import { MuirSirynPlaywrightTestRunner } from './muir-siryn-playwright-test-runner.ts';
import { MuirSirynPlaywrightTracesReporter } from './traces-reporter.ts';

export { strykerValidationSchema } from './muir-siryn-playwright-runner-options-with-stryker-options.ts';

export const strykerPlugins = [
  declareClassPlugin(
    PluginKind.TestRunner,
    'muir-siryn-playwright',
    MuirSirynPlaywrightTestRunner,
  ),
  declareClassPlugin(
    PluginKind.Reporter,
    'muir-siryn-playwright-traces',
    MuirSirynPlaywrightTracesReporter,
  ),
];
