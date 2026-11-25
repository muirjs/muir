import { declareFactoryPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirShadowcatJsConsoleIgnorer,
  muirShadowcatJsConsoleIgnorerName,
  muirShadowcatJsConsoleSchema,
} from './console-ignorer.ts';

export { muirShadowcatJsListOption } from './list-option.ts';
export { muirShadowcatJsHideableCallee } from './statement-call.ts';
export { muirShadowcatJsTypeOf } from './type-of.ts';

/**
 * Stryker reads one schema per plugin module, so it names the options of every ignorer here. Core merges its
 * `properties` into its own (meta-schema-builder.js:27).
 */
export const strykerValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    muirShadowcatJsConsole: muirShadowcatJsConsoleSchema,
  },
};

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirShadowcatJsConsoleIgnorerName,
    muirShadowcatJsConsoleIgnorer,
  ),
];
