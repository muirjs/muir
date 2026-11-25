import {
  muirMoiraMutatorsBuiltInNames,
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsInstall,
  muirMoiraMutatorsIsRecord,
  muirMoiraMutatorsIsSelfCheckFile,
  muirMoiraMutatorsResolveInstrumenter,
  type MuirMoiraMutatorsInstrumenter as CoreInstrumenter,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';

import type { MuirProteusPlaywrightMutator } from './mutators.ts';
import { muirProteusPlaywrightPackageName } from './package-name.ts';
import { muirProteusPlaywrightLooksLikePlaywrightTest } from './playwright-test.ts';

export interface MuirProteusPlaywrightBabelTypes {
  emptyStatement(): unknown;
  cloneNode(node: unknown): unknown;
  objectExpression(properties: readonly unknown[]): unknown;
  arrayExpression(elements: readonly unknown[]): unknown;
  stringLiteral(value: string): unknown;
  numericLiteral(value: number): unknown;
  booleanLiteral(value: boolean): unknown;
  callExpression(callee: unknown, args: readonly unknown[]): unknown;
  memberExpression(object: unknown, property: unknown): unknown;
  identifier(name: string): unknown;
}

const babelTypeMembers: Readonly<{
  [TMember in keyof MuirProteusPlaywrightBabelTypes]: TMember;
}> = {
  emptyStatement: 'emptyStatement',
  cloneNode: 'cloneNode',
  objectExpression: 'objectExpression',
  arrayExpression: 'arrayExpression',
  stringLiteral: 'stringLiteral',
  numericLiteral: 'numericLiteral',
  booleanLiteral: 'booleanLiteral',
  callExpression: 'callExpression',
  memberExpression: 'memberExpression',
  identifier: 'identifier',
};

export type MuirProteusPlaywrightInstrumenter =
  CoreInstrumenter<MuirProteusPlaywrightBabelTypes>;

export const muirProteusPlaywrightTestedVersion = '10.1.1';

export function muirProteusPlaywrightResolveFromCore(
  corePackage: string = muirMoiraMutatorsCorePackageJsons()[0],
): Promise<MuirProteusPlaywrightInstrumenter> {
  return muirMoiraMutatorsResolveInstrumenter(
    muirProteusPlaywrightPackageName,
    muirProteusPlaywrightAssertBabelTypes,
    corePackage,
  );
}

export function muirProteusPlaywrightAssertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is MuirProteusPlaywrightBabelTypes {
  if (!muirMoiraMutatorsIsRecord(value)) {
    throw missing('Babel types');
  }

  const absent = Object.values(babelTypeMembers).filter(
    (member) => typeof value[member] !== 'function',
  );

  if (absent.length > 0) {
    throw missing(`Babel types with ${absent.join(', ')}`);
  }
}

export async function muirProteusPlaywrightInstall(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusPlaywrightMutator>,
  options: unknown,
  resolve: () => Promise<readonly MuirProteusPlaywrightInstrumenter[]>,
  warn: (message: string) => void = console.warn,
  info: (message: string) => void = console.info,
): Promise<void> {
  const mutators = await muirMoiraMutatorsInstall({
    packageName: muirProteusPlaywrightPackageName,
    installName: 'muirProteusPlaywrightMutators',
    testedVersion: muirProteusPlaywrightTestedVersion,
    removeBuiltIns: true,
    sets,
    options,
    resolve,
    toListed: ({ name, mutate }, { types }) => ({
      name,
      mutate: (path: unknown) => {
        warnAboutProgram(path, warn);

        return mutate(path, types);
      },
    }),
    warn,
  });

  info(startLine(sets, mutators));
}

// The file names warned about in this process, whatever the number of installs.
const warnedFiles = new Set<string>();

function warnAboutProgram(
  path: unknown,
  warn: (message: string) => void,
): void {
  const file = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(muirMoiraMutatorsFieldOf(path, 'hub'), 'file'),
      'opts',
    ),
    'filename',
  );
  const node = muirMoiraMutatorsFieldOf(path, 'node');

  if (
    typeof file === 'string' &&
    muirMoiraMutatorsFieldOf(node, 'type') === 'Program' &&
    !muirMoiraMutatorsIsSelfCheckFile(file) &&
    !warnedFiles.has(file) &&
    !muirProteusPlaywrightLooksLikePlaywrightTest(node)
  ) {
    warnedFiles.add(file);
    warn(
      `${file}: ${muirProteusPlaywrightPackageName} turned Stryker's built-in mutators off for every file in this run, and this ` +
        'file does not look like Playwright test code (no @playwright/ import, no top-level test call). Mutate ' +
        'app code in a separate Stryker config.',
    );
  }
}

function startLine(
  sets: MuirMoiraMutatorsMutatorSets<MuirProteusPlaywrightMutator>,
  mutators: readonly MuirProteusPlaywrightMutator[],
): string {
  const defaults = new Set(sets.defaults);
  const optional = mutators.filter((mutator) => !defaults.has(mutator));

  return (
    `${muirProteusPlaywrightPackageName}: Stryker's ${muirMoiraMutatorsBuiltInNames.length} built-in mutators are off for every file in this run; ` +
    `${mutators.length} MuirProteusPlaywright mutators on.` +
    (optional.length > 0
      ? ` Opt-in or experimental: ${optional.map(({ name }) => name).join(', ')}.`
      : '')
  );
}
