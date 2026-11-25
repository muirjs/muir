import {
  muirMoiraMutatorsCheckNames,
  muirMoiraMutatorsCorePackageJson,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsMarkOf,
  muirMoiraMutatorsRegister,
  muirMoiraMutatorsResolveExpressionPlacer,
  muirMoiraMutatorsResolveInstrumenter,
  muirMoiraMutatorsSelfCheck,
  muirMoiraMutatorsUndoOnThrow,
  muirMoiraMutatorsWarnUntested,
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
  muirMoiraMutatorsCorePackageJson,
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
  resolve: () => Promise<MuirProteusJsxInstrumenter> = muirProteusJsxResolveFromCore,
  warn: (message: string) => void = console.warn,
): Promise<void> {
  const instrumenter = await resolve();
  const { allMutators, expressionPlacer, types } = instrumenter;

  muirMoiraMutatorsCheckNames(muirProteusJsxPackageName, mutators, allMutators);
  await muirMoiraMutatorsUndoOnThrow(
    [allMutators, expressionPlacer.target],
    async () => {
      muirMoiraMutatorsRegister(
        muirProteusJsxPackageName,
        allMutators,
        mutators.map((mutator) => muirProteusJsxToNodeMutator(mutator, types)),
      );

      if (!(ownMark in expressionPlacer.target)) {
        Object.assign(
          expressionPlacer.target,
          muirProteusJsxWithJsxPlacement(expressionPlacer.original, types),
          { [ownMark]: ownMark },
        );
      }

      await muirMoiraMutatorsSelfCheck(
        muirProteusJsxPackageName,
        instrumenter,
        mutators,
      );
    },
  );

  muirMoiraMutatorsWarnUntested(
    muirProteusJsxPackageName,
    muirProteusJsxTestedVersion,
    instrumenter,
    warn,
  );
}

export async function muirProteusJsxResolveFromCore(
  corePackage: string = muirMoiraMutatorsCorePackageJson(),
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
