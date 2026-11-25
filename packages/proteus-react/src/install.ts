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
  muirProteusReactBabelTypeMembers,
  muirProteusReactToNodeMutator,
  type MuirProteusReactBabelTypes,
  type MuirProteusReactMutator,
} from './mutator.ts';
import { muirProteusReactWithJsxPlacement } from './placer.ts';
import { muirProteusReactPackageName } from './package-name.ts';

export {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsCorePackageJsons,
  type MuirMoiraMutatorsMutantOrigin,
  type MuirMoiraMutatorsSourceFile,
} from '@muirjs/moira-mutators';

export interface MuirProteusReactInstrumenter
  extends CoreInstrumenter<MuirProteusReactBabelTypes> {
  readonly expressionPlacer: MuirMoiraMutatorsExpressionPlacer;
}

export const muirProteusReactTestedVersion = '10.1.1';
const ownMark = muirMoiraMutatorsMarkOf(muirProteusReactPackageName);

export async function muirProteusReactInstall(
  mutators: readonly MuirProteusReactMutator[],
  resolve: () => Promise<readonly MuirProteusReactInstrumenter[]> = () =>
    muirMoiraMutatorsResolveEachCore(muirProteusReactResolveFromCore),
  warn: (message: string) => void = console.warn,
  options?: unknown,
): Promise<void> {
  await muirMoiraMutatorsInstall({
    packageName: muirProteusReactPackageName,
    installName: 'muirProteusReactMutators',
    testedVersion: muirProteusReactTestedVersion,
    sets: { defaults: mutators, optIn: [], experimental: [] },
    options,
    resolve,
    toListed: (mutator, { types }) =>
      muirProteusReactToNodeMutator(mutator, types),
    patch: {
      targets: ({ expressionPlacer }) => [expressionPlacer.target],
      apply: ({ expressionPlacer, types }) => {
        if (!(ownMark in expressionPlacer.target)) {
          Object.assign(
            expressionPlacer.target,
            muirProteusReactWithJsxPlacement(expressionPlacer.original, types),
            { [ownMark]: ownMark },
          );
        }
      },
    },
    warn,
  });
}

export async function muirProteusReactResolveFromCore(
  corePackage: string = muirMoiraMutatorsCorePackageJsons()[0],
): Promise<MuirProteusReactInstrumenter> {
  const instrumenter = await muirMoiraMutatorsResolveInstrumenter(
    muirProteusReactPackageName,
    assertBabelTypes,
    corePackage,
  );

  return {
    ...instrumenter,
    expressionPlacer: await muirMoiraMutatorsResolveExpressionPlacer(
      muirProteusReactPackageName,
      instrumenter,
    ),
  };
}

function assertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is MuirProteusReactBabelTypes {
  const absent = [
    ...muirProteusReactBabelTypeMembers.filter(
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
