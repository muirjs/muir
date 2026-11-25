import path from 'node:path';

import {
  muirSirynPlaywrightFieldOf,
  muirSirynPlaywrightIsRecord,
  muirSirynPlaywrightIsStringArray,
} from './is-record.ts';

export interface MuirSirynPlaywrightOptions {
  readonly configFile?: string;
  readonly projects?: readonly string[];
  readonly workers?: number;
  readonly retries?: number;
  readonly survivorTraces?: string;
  readonly traceScreenshots?: boolean;
}

type JsonType<T> = T extends string
  ? 'string'
  : T extends number
    ? 'integer'
    : T extends boolean
      ? 'boolean'
      : T extends readonly string[]
        ? 'array'
        : never;

type OptionSchemas = {
  [K in keyof Required<MuirSirynPlaywrightOptions>]: {
    readonly type: JsonType<Required<MuirSirynPlaywrightOptions>[K]>;
    readonly description: string;
    readonly default?: Required<MuirSirynPlaywrightOptions>[K];
    readonly minimum?: number;
    readonly items?: { readonly type: 'string' };
  };
};

const scalarOptionProperties = {
  configFile: {
    type: 'string',
    description:
      'Path to the Playwright config file, relative to the project root.',
  },
  projects: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Playwright projects to run. Defaults to the projects Playwright runs without --project, so not those with default: false.',
  },
  workers: {
    type: 'integer',
    minimum: 1,
    default: 1,
    description: 'Playwright workers per Stryker test runner process.',
  },
  retries: {
    type: 'integer',
    minimum: 0,
    description:
      'Retries of a failed test in every project. Defaults to the retries in the Playwright config.',
  },
  survivorTraces: {
    type: 'string',
    description:
      'Folder, relative to the folder you run Stryker from, for the Playwright traces of surviving mutants. Records a trace of every test run; needs the muir-siryn-playwright-traces reporter.',
  },
  traceScreenshots: {
    type: 'boolean',
    default: false,
    description:
      'Add screenshots to the traces that survivorTraces records. The trace viewer needs them to show canvas content; they can make a trace several times larger.',
  },
} satisfies OptionSchemas;

export const muirSirynPlaywrightOptionProperties = {
  ...scalarOptionProperties,
  webServer: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mutate: { enum: [true, false, 'auto'] },
      isolate: { type: 'boolean' },
    },
    description:
      "Mutants in the code the Playwright config's webServer runs. mutate: false (the default) leaves them NoCoverage, true runs them, 'auto' runs them when the setup allows; isolate (default true) keeps server mutant runs apart.",
  },
};

export const strykerValidationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    muirSirynPlaywright: {
      type: 'object',
      default: {},
      additionalProperties: false,
      properties: muirSirynPlaywrightOptionProperties,
    },
  },
};

export interface MuirSirynPlaywrightRunnerOptions {
  readonly configFile: string | undefined;
  readonly projects: readonly string[] | undefined;
  readonly workers: number;
  readonly retries: number | undefined;
  readonly survivorTraces: string | undefined;
  readonly traceScreenshots: boolean;
  readonly webServer: MuirSirynPlaywrightWebServerOptions;
  readonly strykerTimeoutMS: number;
}

export interface MuirSirynPlaywrightWebServerOptions {
  readonly mutate: boolean | 'auto';
  readonly isolate: boolean;
}

export interface MuirSirynPlaywrightRunnerOptionsWithStrykerOptions {
  readonly testFiles?: readonly string[];
  readonly timeoutMS: number;
  readonly concurrency?: number | string | undefined;
  readonly checkers?: readonly string[] | undefined;
  readonly muirSirynPlaywright?: unknown;
}

const optionGuards = {
  configFile: (value) => value === undefined || typeof value === 'string',
  projects: (value) =>
    value === undefined || muirSirynPlaywrightIsStringArray(value),
  workers: (value) => value === undefined || typeof value === 'number',
  retries: (value) => value === undefined || typeof value === 'number',
  survivorTraces: (value) => value === undefined || typeof value === 'string',
  traceScreenshots: (value) =>
    value === undefined || typeof value === 'boolean',
} satisfies {
  readonly [K in keyof MuirSirynPlaywrightOptions]-?: (
    value: unknown,
  ) => value is MuirSirynPlaywrightOptions[K];
};

export function muirSirynPlaywrightReadRunnerOptions(
  options: MuirSirynPlaywrightRunnerOptionsWithStrykerOptions,
): MuirSirynPlaywrightRunnerOptions {
  if (options.testFiles?.length) {
    throw new Error(
      'The Playwright test runner does not support the --testFiles option.',
    );
  }

  const own = options.muirSirynPlaywright ?? {};

  if (muirSirynPlaywrightIsRecord(own) && !Array.isArray(own)) {
    const {
      configFile,
      projects,
      workers,
      retries,
      survivorTraces,
      traceScreenshots,
      webServer,
    } = own;

    if (
      optionGuards.configFile(configFile) &&
      optionGuards.projects(projects) &&
      optionGuards.workers(workers) &&
      optionGuards.retries(retries) &&
      optionGuards.survivorTraces(survivorTraces) &&
      optionGuards.traceScreenshots(traceScreenshots)
    ) {
      const workerCount =
        workers ?? muirSirynPlaywrightOptionProperties.workers.default;

      if (
        Number.isInteger(workerCount) &&
        workerCount >= muirSirynPlaywrightOptionProperties.workers.minimum &&
        (retries === undefined ||
          (Number.isInteger(retries) &&
            retries >= muirSirynPlaywrightOptionProperties.retries.minimum))
      ) {
        return {
          configFile: configFile ? path.resolve(configFile) : undefined,
          projects,
          workers: workerCount,
          retries,
          survivorTraces,
          traceScreenshots:
            traceScreenshots ??
            muirSirynPlaywrightOptionProperties.traceScreenshots.default,
          webServer: readWebServer(webServer),
          strykerTimeoutMS: options.timeoutMS,
        };
      }
    }
  }

  throw new Error(
    `The muirSirynPlaywright options do not match their schema: ${JSON.stringify(own)}`,
  );
}

function readWebServer(value: unknown): MuirSirynPlaywrightWebServerOptions {
  const knownKeys = Object.keys(
    muirSirynPlaywrightOptionProperties.webServer.properties,
  );
  const knownList = knownKeys.join(' and ');

  if (
    value !== undefined &&
    (!muirSirynPlaywrightIsRecord(value) || Array.isArray(value))
  ) {
    throw new Error(
      `muirSirynPlaywright.webServer must be an object with ${knownList}, got ${JSON.stringify(value)}.`,
    );
  }

  const unknownKey = (
    muirSirynPlaywrightIsRecord(value) ? Object.keys(value) : []
  ).find((key) => !knownKeys.includes(key));

  if (unknownKey !== undefined) {
    throw new Error(
      `muirSirynPlaywright.webServer has no option ${unknownKey}; it takes ${knownList}.`,
    );
  }

  const mutate = muirSirynPlaywrightFieldOf(value, 'mutate');

  if (
    mutate !== undefined &&
    mutate !== true &&
    mutate !== false &&
    mutate !== 'auto'
  ) {
    throw new Error(
      `muirSirynPlaywright.webServer.mutate must be true, false or 'auto', got ${JSON.stringify(mutate)}.`,
    );
  }

  const isolate = muirSirynPlaywrightFieldOf(value, 'isolate');

  if (isolate !== undefined && typeof isolate !== 'boolean') {
    throw new Error(
      `muirSirynPlaywright.webServer.isolate must be true or false, got ${JSON.stringify(isolate)}.`,
    );
  }

  return {
    mutate: mutate ?? false,
    isolate: isolate ?? true,
  };
}
