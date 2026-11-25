import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import { muirProteusReactListOption } from './list-option.ts';
import { muirProteusReactHideableCallee } from './statement-call.ts';

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

export const muirProteusReactConsoleIgnorerName = 'muir-proteus-react-console';

export const muirProteusReactConsoleSchema = {
  type: 'object',
  additionalProperties: false,
  description: `Options of the ${muirProteusReactConsoleIgnorerName} ignorer.`,
  properties: {
    methods: {
      type: 'array',
      items: { enum: consoleMethods },
      description:
        `The console methods whose call statements ${muirProteusReactConsoleIgnorerName} hides, unless an argument can act on the ` +
        'page. Replaces the default list: log, debug, info and trace.',
    },
  },
};

export function muirProteusReactConsoleIgnorer(options: object): Ignorer {
  const callees: readonly unknown[] = muirProteusReactListOption(
    options,
    'muirProteusReactConsole',
    'methods',
    defaultMethods,
    isMethod,
    'an array of console method names, such as log or warn',
  ).map((method) => `console.${method}`);

  return {
    shouldIgnore(path) {
      if (
        callees.includes(
          muirProteusReactHideableCallee(
            muirMoiraMutatorsFieldOf(path, 'node'),
          ),
        )
      ) {
        return `${muirProteusReactConsoleIgnorerName}: console output; DOM tests do not observe it`;
      }

      return undefined;
    },
  };
}
muirProteusReactConsoleIgnorer.inject = tokens(commonTokens.options);

function isMethod(name: unknown): name is string {
  return consoleMethods.includes(name);
}
