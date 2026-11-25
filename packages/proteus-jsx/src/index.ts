import { muirMoiraMutatorsSelectMutators } from '@muirjs/moira-mutators';
import { declareFactoryPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirProteusJsxConsoleIgnorer,
  muirProteusJsxConsoleIgnorerName,
  muirProteusJsxConsoleSchema,
} from './console-ignorer.ts';
import { muirProteusJsxImplicitRoles } from './implicit-roles.ts';
import { muirProteusJsxInstall } from './install.ts';
import { muirProteusJsxMutatorsFor } from './mutators.ts';
import { muirProteusJsxPackageName } from './package-name.ts';
import {
  muirProteusJsxStylingSchema,
  muirProteusJsxStylingIgnorer,
  muirProteusJsxStylingIgnorerName,
} from './styling-ignorer.ts';
import {
  muirProteusJsxTelemetrySchema,
  muirProteusJsxTelemetryIgnorer,
  muirProteusJsxTelemetryIgnorerName,
} from './telemetry-ignorer.ts';

/**
 * Stryker reads one schema per plugin module, so it names the options of every ignorer here. Core merges its
 * `properties` into its own (meta-schema-builder.js:27).
 */
export const strykerValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    muirProteusJsxStyling: muirProteusJsxStylingSchema,
    muirProteusJsxTelemetry: muirProteusJsxTelemetrySchema,
    muirProteusJsxConsole: muirProteusJsxConsoleSchema,
  },
};

/** This package has no opt-in or experimental mutators yet, so the options name none. */
export type MuirProteusJsxMutatorOptions = Readonly<Record<string, never>>;

/**
 * Installs this package's mutators into Stryker. A Stryker configuration file awaits it, so that an error in the install
 * stops the run; Stryker only warns when a module in `plugins` fails to load.
 */
export async function muirProteusJsxMutators(
  options?: MuirProteusJsxMutatorOptions,
): Promise<void> {
  await muirProteusJsxInstall(
    muirMoiraMutatorsSelectMutators(
      muirProteusJsxPackageName,
      'muirProteusJsxMutators',
      {
        defaults: muirProteusJsxMutatorsFor(muirProteusJsxImplicitRoles),
        optIn: [],
        experimental: [],
      },
      options,
    ),
  );
}

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirProteusJsxStylingIgnorerName,
    muirProteusJsxStylingIgnorer,
  ),
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirProteusJsxTelemetryIgnorerName,
    muirProteusJsxTelemetryIgnorer,
  ),
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirProteusJsxConsoleIgnorerName,
    muirProteusJsxConsoleIgnorer,
  ),
];
