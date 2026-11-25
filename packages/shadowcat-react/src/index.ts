import { declareFactoryPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirShadowcatReactStylingIgnorer,
  muirShadowcatReactStylingIgnorerName,
  muirShadowcatReactStylingSchema,
} from './styling-ignorer.ts';

/**
 * Stryker reads one schema per plugin module, so it names the options of every ignorer here. Core merges its
 * `properties` into its own (meta-schema-builder.js:27).
 */
export const strykerValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    muirShadowcatReactStyling: muirShadowcatReactStylingSchema,
  },
};

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirShadowcatReactStylingIgnorerName,
    muirShadowcatReactStylingIgnorer,
  ),
];
