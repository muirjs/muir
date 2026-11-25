import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsSelfCheckFile,
} from '@muirjs/moira-mutators';
import type {
  MuirMoiraMutatorsListedMutator,
  MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';

import {
  muirProteusPlaywrightTestedVersion,
  type MuirProteusPlaywrightBabelTypes,
  type MuirProteusPlaywrightInstrumenter,
} from '../../src/install.ts';
import type { MuirProteusPlaywrightMutator } from '../../src/mutators.ts';
import { muirProteusPlaywrightPackageName } from '../../src/package-name.ts';

export const fakeTypes: MuirProteusPlaywrightBabelTypes = {
  emptyStatement: () => ({}),
  cloneNode: (node) => node,
  objectExpression: () => ({}),
  arrayExpression: () => ({}),
  stringLiteral: () => ({}),
  numericLiteral: () => ({}),
  booleanLiteral: () => ({}),
  callExpression: () => ({}),
  memberExpression: () => ({}),
  identifier: () => ({}),
};

export const ownMark = muirMoiraMutatorsMarkOf(
  muirProteusPlaywrightPackageName,
);

export function mutator(name: string): MuirProteusPlaywrightMutator {
  return {
    name,
    sample: `export const ${name.toLowerCase()} = 1;\n`,
    mutate: () => [],
  };
}

export function sets(
  defaults: readonly string[],
  optIn: readonly string[] = [],
  experimental: readonly string[] = [],
): MuirMoiraMutatorsMutatorSets<MuirProteusPlaywrightMutator> {
  return {
    defaults: defaults.map(mutator),
    optIn: optIn.map(mutator),
    experimental: experimental.map(mutator),
  };
}

/**
 * A fake instrumenter that holds the 17 built-ins. Each marked mutator not in `silent` makes one mutant in its own
 * self-check file, and the built-ins named in `leaking` make a mutant of the negative sample.
 */
export function fakeInstrumenter({
  silent = [],
  leaking = [],
  version = muirProteusPlaywrightTestedVersion,
  extra = [],
}: {
  readonly silent?: readonly string[];
  readonly leaking?: readonly string[];
  readonly version?: string;
  readonly extra?: readonly MuirMoiraMutatorsListedMutator[];
} = {}) {
  const allMutators: MuirMoiraMutatorsListedMutator[] = [
    ...muirMoiraMutatorsBuiltInNames.map((name) => ({
      name,
      mutate: () => undefined,
    })),
    ...extra,
  ];
  const instrumented: { name: string; content: string }[][] = [];
  const instrumenter: MuirProteusPlaywrightInstrumenter = {
    dir: '/stryker/instrumenter',
    version,
    types: fakeTypes,
    allMutators,
    async instrument(files) {
      instrumented.push([...files]);

      return [
        ...allMutators
          .filter(
            (listed) => ownMark in listed && !silent.includes(listed.name),
          )
          .map((listed) => ({
            fileName: muirMoiraMutatorsSelfCheckFile(listed.name),
            mutatorName: listed.name,
            replacement: '',
            location: {
              start: { line: 0, column: 0 },
              end: { line: 0, column: 1 },
            },
          })),
        ...leaking.map((mutatorName) => ({
          fileName: muirMoiraMutatorsSelfCheckFile('built-ins'),
          mutatorName,
          replacement: '',
          location: {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 1 },
          },
        })),
      ];
    },
  };

  return {
    instrumenter,
    instrumented,
    names: () => allMutators.map(({ name }) => name),
  };
}
