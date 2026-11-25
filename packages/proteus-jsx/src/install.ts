import {
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsInstall,
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsResolveEachCore,
  muirMoiraMutatorsResolveExpressionPlacer,
  muirMoiraMutatorsResolveInstrumenter,
  type MuirMoiraMutatorsExpressionPlacer,
  type MuirMoiraMutatorsInstrumenter as CoreInstrumenter,
} from '@muirjs/moira-mutators';

import {
  muirProteusJsxBabelTypeMembers,
  muirProteusJsxToNodeMutator,
  type MuirProteusJsxBabelTypes,
  type MuirProteusJsxMutator,
} from './mutator.ts';
import { muirProteusJsxWithJsxPlacement } from './placer.ts';
import { muirProteusJsxPackageName } from './package-name.ts';

export {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsCorePackageJsons,
  type MuirMoiraMutatorsMutantOrigin,
  type MuirMoiraMutatorsSourceFile,
} from '@muirjs/moira-mutators';

export interface MuirProteusJsxInstrumenter
  extends CoreInstrumenter<MuirProteusJsxBabelTypes> {
  readonly expressionPlacer: MuirMoiraMutatorsExpressionPlacer;
}

export const muirProteusJsxTestedVersion = '10.1.1';
const ownMark = muirMoiraMutatorsMarkOf(muirProteusJsxPackageName);

export async function muirProteusJsxInstall(
  mutators: readonly MuirProteusJsxMutator[],
  resolve: () => Promise<readonly MuirProteusJsxInstrumenter[]> = () =>
    muirMoiraMutatorsResolveEachCore(muirProteusJsxResolveFromCore),
  warn: (message: string) => void = console.warn,
  options?: unknown,
): Promise<void> {
  await muirMoiraMutatorsInstall({
    packageName: muirProteusJsxPackageName,
    installName: 'muirProteusJsxMutators',
    testedVersion: muirProteusJsxTestedVersion,
    sets: { defaults: mutators, optIn: [], experimental: [] },
    options,
    resolve,
    toListed: (mutator, { types }) =>
      muirProteusJsxToNodeMutator(mutator, types),
    patch: {
      targets: ({ expressionPlacer }) => [expressionPlacer.target],
      apply: ({ expressionPlacer, types }) => {
        if (!(ownMark in expressionPlacer.target)) {
          Object.assign(
            expressionPlacer.target,
            muirProteusJsxWithJsxPlacement(expressionPlacer.original, types),
            { [ownMark]: ownMark },
          );
        }
      },
    },
    warn,
  });
}

export async function muirProteusJsxResolveFromCore(
  corePackage: string = muirMoiraMutatorsCorePackageJsons()[0],
): Promise<MuirProteusJsxInstrumenter> {
  const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
    muirProteusJsxPackageName,
    assertBabelTypes,
    corePackage,
  );

  return {
    ...instrumenter,
    expressionPlacer: await muirMoiraMutatorsResolveExpressionPlacer(
      muirProteusJsxPackageName,
      instrumenter,
    ),
  };
}

function assertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is MuirProteusJsxBabelTypes {
  const absent = [
    ...muirProteusJsxBabelTypeMembers.filter(
      (member) => typeof muirMoiraMutatorsFieldOf(value, member) !== 'function',
    ),
    ...(typeof muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(value, 'react'),
      'buildChildren',
    ) === 'function'
      ? []
      : ['react.buildChildren']),
  ];

  if (absent.length > 0) {
    throw missing(`Babel types with ${absent.join(', ')}`);
  }
}
