import { declareValuePlugin, PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirProteusPlaywrightInstall,
  muirProteusPlaywrightResolveFromCore,
} from './install.ts';
import {
  muirProteusPlaywrightMutatorSets,
  type MuirProteusPlaywrightMutatorOptions,
} from './mutators.ts';
import { muirProteusPlaywrightSerializedIgnorer } from './serialized-ignorer.ts';
import {
  muirProteusPlaywrightParseSettings,
  muirProteusPlaywrightUseSettings,
  type MuirProteusPlaywrightMutatorSettings,
} from './settings.ts';

export type { MuirProteusPlaywrightMutatorOptions } from './mutators.ts';
export type { MuirProteusPlaywrightMutatorSettings } from './settings.ts';

/**
 * Turns off Stryker's 17 built-in mutators and installs this package's mutators. A Stryker configuration file awaits
 * it, so that an error in the install stops the run.
 *
 * `settings.navigationFixtures` lists the fixture names whose awaited call MuirProteusPlaywrightNavigationAction removes, in
 * place of `['navigate']`.
 */
export async function muirProteusPlaywrightMutators(
  options?: MuirProteusPlaywrightMutatorOptions,
  settings?: MuirProteusPlaywrightMutatorSettings,
): Promise<void> {
  const parsed = muirProteusPlaywrightParseSettings(settings);

  await muirProteusPlaywrightInstall(
    muirProteusPlaywrightMutatorSets,
    options,
    muirProteusPlaywrightResolveFromCore,
  );
  muirProteusPlaywrightUseSettings(parsed);
}

/**
 * The opt-in ignorer for functions that Playwright sends to another realm. Listing this package in `appendPlugins`
 * loads it and installs no mutator; `ignorers: ['muir-proteus-playwright-serialized']` turns it on.
 */
export const strykerPlugins = [
  declareValuePlugin(
    PluginKind.Ignore,
    'muir-proteus-playwright-serialized',
    muirProteusPlaywrightSerializedIgnorer,
  ),
];
