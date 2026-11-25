import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import { muirShadowcatJsListOption } from './list-option.ts';
import { muirShadowcatJsPackageName } from './package-name.ts';
import { muirShadowcatJsHideableCallee } from './statement-call.ts';

const consoleMethods: readonly unknown[] = [
  'assert',
  'clear',
  'count',
  'countReset',
  'debug',
  'dir',
  'dirxml',
  'error',
  'group',
  'groupCollapsed',
  'groupEnd',
  'info',
  'log',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'trace',
  'warn',
];
const defaultMethods: readonly string[] = ['log', 'debug', 'info', 'trace'];

export const muirShadowcatJsConsoleIgnorerName = 'muir-shadowcat-js-console';

export const muirShadowcatJsConsoleSchema = {
  type: 'object',
  additionalProperties: false,
  description: `Options of the ${muirShadowcatJsConsoleIgnorerName} ignorer.`,
  properties: {
    methods: {
      type: 'array',
      items: { enum: consoleMethods },
      description:
        `The console methods whose call statements ${muirShadowcatJsConsoleIgnorerName} hides, unless an argument can act on the ` +
        'page. Replaces the default list: log, debug, info and trace.',
    },
  },
};

export function muirShadowcatJsConsoleIgnorer(options: object): Ignorer {
  const callees: readonly unknown[] = muirShadowcatJsListOption(
    muirShadowcatJsPackageName,
    options,
    'muirShadowcatJsConsole',
    'methods',
    defaultMethods,
    isMethod,
    'an array of console method names, such as log or warn',
  ).map((method) => `console.${method}`);

  return {
    shouldIgnore(path) {
      if (
        callees.includes(
          muirShadowcatJsHideableCallee(muirMoiraMutatorsFieldOf(path, 'node')),
        )
      ) {
        return `${muirShadowcatJsConsoleIgnorerName}: console output; DOM tests do not observe it`;
      }

      return undefined;
    },
  };
}
muirShadowcatJsConsoleIgnorer.inject = tokens(commonTokens.options);

function isMethod(name: unknown): name is string {
  return consoleMethods.includes(name);
}
