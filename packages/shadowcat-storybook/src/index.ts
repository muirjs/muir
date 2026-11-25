import { declareFactoryPlugin, PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirShadowcatStorybookCsfIgnorer,
  muirShadowcatStorybookCsfIgnorerName,
} from './csf-ignorer.ts';
import { muirShadowcatStorybookPlayModes } from './options.ts';

export { muirShadowcatStorybookStrykerStorybookProject } from './options.ts';
export { muirShadowcatStorybookStrykerPlugin } from './stryker-vite-plugin.ts';
export type {
  MuirShadowcatStorybookCsfOptions,
  MuirShadowcatStorybookOptions,
} from './options.ts';

/**
 * Stryker reads one schema per plugin module, so it names the options of every plugin here. Core merges its
 * `properties` into its own (meta-schema-builder.js:27).
 */
export const strykerValidationSchema = {
  type: 'object',
  properties: {
    muirShadowcatStorybook: {
      type: 'object',
      default: {},
      additionalProperties: false,
      description:
        // Stryker disable next-line StringLiteral: documentation for readers of the exported strykerValidationSchema, which Stryker's messages never print
        'Options of the muir-shadowcat-storybook-csf, muir-shadowcat-storybook-vitest and muir-banshee-storybook-vitest plugins.',
      properties: {
        configDir: {
          type: 'string',
          default: '.storybook',
          description:
            // Stryker disable next-line StringLiteral: documentation for readers of the exported strykerValidationSchema, which Stryker's messages never print
            'The Storybook config folder, as Storybook takes it with --config-dir. Its main file names the story files.',
        },
      },
    },
    muirShadowcatStorybookCsf: {
      type: 'object',
      default: {},
      additionalProperties: false,
      // Stryker disable next-line StringLiteral: documentation for readers of the exported strykerValidationSchema, which Stryker's messages never print
      description: 'Options of the muir-shadowcat-storybook-csf ignorer.',
      properties: {
        play: {
          enum: muirShadowcatStorybookPlayModes,
          default: 'ignore',
          description:
            // Stryker disable next-line StringLiteral: documentation for readers of the exported strykerValidationSchema, which Stryker's messages never print
            'ignore (the default) keeps the mutants of plays, test hooks and msw handlers in story files out of the run, for a config that mutates app code. mutate keeps them in, for a config that mutates test code.',
        },
      },
    },
  },
};

export const strykerPlugins = [
  declareFactoryPlugin(
    PluginKind.Ignore,
    muirShadowcatStorybookCsfIgnorerName,
    muirShadowcatStorybookCsfIgnorer,
  ),
];
