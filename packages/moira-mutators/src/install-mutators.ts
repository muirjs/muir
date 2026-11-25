import {
  muirMoiraMutatorsCheckBuiltInsRemoved,
  muirMoiraMutatorsRemoveBuiltIns,
} from './built-ins.ts';
import {
  muirMoiraMutatorsCheckNames,
  muirMoiraMutatorsRegister,
  muirMoiraMutatorsSelfCheck,
  muirMoiraMutatorsUndoOnThrow,
  muirMoiraMutatorsWarnUntested,
  type MuirMoiraMutatorsSampledMutator,
} from './install.ts';
import type {
  MuirMoiraMutatorsInstrumenter,
  MuirMoiraMutatorsListedMutator,
} from './instrumenter.ts';
import {
  muirMoiraMutatorsSelectMutators,
  type MuirMoiraMutatorsMutatorSets,
} from './select.ts';

/** A change to the instrumenter beside its mutator list, undone with the list when a check fails. */
export interface MuirMoiraMutatorsPatch<TInstrumenter> {
  /** The objects `apply` changes. */
  readonly targets: (instrumenter: TInstrumenter) => readonly object[];
  readonly apply: (instrumenter: TInstrumenter) => void;
}

export interface MuirMoiraMutatorsInstallOptions<
  TMutator extends MuirMoiraMutatorsSampledMutator,
  TInstrumenter extends MuirMoiraMutatorsInstrumenter<unknown>,
> {
  /** The installing package, which starts each error and warning. */
  readonly packageName: string;
  /** The install function the user calls, which the option errors name. */
  readonly installName: string;
  /** The instrumenter version the package was tested with; any other gets a warning. */
  readonly testedVersion: string;
  /** Turns Stryker's 17 built-in mutators off and keeps the mutators of the other Muir packages. */
  readonly removeBuiltIns?: boolean;
  readonly sets: MuirMoiraMutatorsMutatorSets<TMutator>;
  /** The user's options, checked at run time, as a config file in JavaScript has no type check. */
  readonly options: unknown;
  /** The instrumenter of each copy of Stryker's core that may run this process. */
  readonly resolve: () => Promise<readonly TInstrumenter[]>;
  /** The entry of the instrumenter's mutator list for `mutator`. */
  readonly toListed: (
    mutator: TMutator,
    instrumenter: TInstrumenter,
  ) => MuirMoiraMutatorsListedMutator;
  readonly patch?: MuirMoiraMutatorsPatch<TInstrumenter>;
  readonly warn: (message: string) => void;
}

/**
 * Puts the selected mutators into the mutator list of each instrumenter, and throws unless each makes a mutant of its
 * sample, and, with `removeBuiltIns`, no built-in makes one: a bundled or second instrumenter does not read the
 * list and would drop the change without a word. A failed check gives every list and patch target back as it was.
 * Resolves to the selected mutators.
 */
export async function muirMoiraMutatorsInstall<
  TMutator extends MuirMoiraMutatorsSampledMutator,
  TInstrumenter extends MuirMoiraMutatorsInstrumenter<unknown>,
>({
  packageName,
  installName,
  testedVersion,
  removeBuiltIns = false,
  sets,
  options,
  resolve,
  toListed,
  patch,
  warn,
}: MuirMoiraMutatorsInstallOptions<TMutator, TInstrumenter>): Promise<
  readonly TMutator[]
> {
  const mutators = muirMoiraMutatorsSelectMutators(
    packageName,
    installName,
    sets,
    options,
  );
  const instrumenters = await resolve();

  instrumenters.forEach(({ allMutators }) => {
    muirMoiraMutatorsCheckNames(packageName, mutators, allMutators);
  });
  await muirMoiraMutatorsUndoOnThrow(
    instrumenters.flatMap((instrumenter) => [
      instrumenter.allMutators,
      ...(patch?.targets(instrumenter) ?? []),
    ]),
    async () => {
      instrumenters.forEach((instrumenter) => {
        if (removeBuiltIns) {
          muirMoiraMutatorsRemoveBuiltIns(packageName, instrumenter, warn);
        }

        muirMoiraMutatorsRegister(
          packageName,
          instrumenter.allMutators,
          mutators.map((mutator) => toListed(mutator, instrumenter)),
        );
        patch?.apply(instrumenter);
      });
      await Promise.all(
        instrumenters.map(async (instrumenter) => {
          await muirMoiraMutatorsSelfCheck(packageName, instrumenter, mutators);

          if (removeBuiltIns) {
            await muirMoiraMutatorsCheckBuiltInsRemoved(
              packageName,
              instrumenter,
            );
          }
        }),
      );
    },
  );

  const versions = new Map(
    instrumenters.map((instrumenter) => [instrumenter.version, instrumenter]),
  );

  versions.forEach((instrumenter) => {
    muirMoiraMutatorsWarnUntested(
      packageName,
      testedVersion,
      instrumenter,
      warn,
    );
  });

  return mutators;
}
