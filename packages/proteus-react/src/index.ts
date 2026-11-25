import { declareFactoryPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirProteusReactConsoleIgnorer,
  muirProteusReactConsoleIgnorerName,
  muirProteusReactConsoleSchema,
} from './console-ignorer.ts';
import { muirProteusReactImplicitRoles } from './implicit-roles.ts';
import { muirProteusReactInstall } from './install.ts';
import { muirProteusReactMutatorsFor } from './mutators.ts';
import {
  muirProteusReactStylingSchema,
  muirProteusReactStylingIgnorer,
  muirProteusReactStylingIgnorerName,
} from './styling-ignorer.ts';
import {
  muirProteusReactTelemetrySchema,
  muirProteusReactTelemetryIgnorer,
  muirProteusReactTelemetryIgnorerName,
} from './telemetry-ignorer.ts';

/**
 * Stryker reads one schema per plugin module, so it names the options of every ignorer here. Core merges its
 * `properties` into its own (meta-schema-builder.js:27).
 */
export const strykerValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    muirProteusReactStyling: muirProteusReactStylingSchema,
    muirProteusReactTelemetry: muirProteusReactTelemetrySchema,
    muirProteusReactConsole: muirProteusReactConsoleSchema,
  },
};

/** This package has no opt-in or experimental mutators yet, so the options name none. */
export type MuirProteusReactMutatorOptions = Readonly<Record<string, never>>;

/**
 * Installs this package's mutators into Stryker. A Stryker configuration file awaits it, so that an error in the install
 * stops the run; Stryker only warns when a module in `plugins` fails to load.
 */
export async function muirProteusReactMutators(
  options?: MuirProteusReactMutatorOptions,
): Promise<void> {
  await muirProteusReactInstall(
    muirProteusReactMutatorsFor(muirProteusReactImplicitRoles),
    undefined,
    undefined,
    options,
  );
}

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirProteusReactStylingIgnorerName,
    muirProteusReactStylingIgnorer,
  ),
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirProteusReactTelemetryIgnorerName,
    muirProteusReactTelemetryIgnorer,
  ),
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirProteusReactConsoleIgnorerName,
    muirProteusReactConsoleIgnorer,
  ),
];
