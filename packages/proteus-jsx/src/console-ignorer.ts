import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import { muirProteusJsxListOption } from './list-option.ts';
import { muirProteusJsxHideableCallee } from './statement-call.ts';

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

export const muirProteusJsxConsoleIgnorerName = 'muir-proteus-jsx-console';

export const muirProteusJsxConsoleSchema = {
  type: 'object',
  additionalProperties: false,
  description: `Options of the ${muirProteusJsxConsoleIgnorerName} ignorer.`,
  properties: {
    methods: {
      type: 'array',
      items: { enum: consoleMethods },
      description:
        `The console methods whose call statements ${muirProteusJsxConsoleIgnorerName} hides, unless an argument can act on the ` +
        'page. Replaces the default list: log, debug, info and trace.',
    },
  },
};

export function muirProteusJsxConsoleIgnorer(options: object): Ignorer {
  const callees: readonly unknown[] = muirProteusJsxListOption(
    options,
    'muirProteusJsxConsole',
    'methods',
    defaultMethods,
    isMethod,
    'an array of console method names, such as log or warn',
  ).map((method) => `console.${method}`);

  return {
    shouldIgnore(path) {
      if (
        callees.includes(
          muirProteusJsxHideableCallee(muirMoiraMutatorsFieldOf(path, 'node')),
        )
      ) {
        return `${muirProteusJsxConsoleIgnorerName}: console output; DOM tests do not observe it`;
      }

      return undefined;
    },
  };
}
muirProteusJsxConsoleIgnorer.inject = tokens(commonTokens.options);

function isMethod(name: unknown): name is string {
  return consoleMethods.includes(name);
}
