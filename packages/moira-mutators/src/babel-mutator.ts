import type { NodePath, types } from '@babel/core';

import {
  muirMoiraMutatorsInstall,
  type MuirMoiraMutatorsInstallOptions,
} from './install-mutators.ts';
import {
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsResolveEachCore,
  muirMoiraMutatorsResolveInstrumenter,
  type MuirMoiraMutatorsInstrumenter,
} from './instrumenter.ts';
import { muirMoiraMutatorsFieldOf } from './is-record.ts';

/** The members of the Babel types that a Babel mutator may call; its install checks the instrumenter's for each. */
export const muirMoiraMutatorsBabelBuilders = Object.freeze([
  'arrowFunctionExpression',
  'binaryExpression',
  'blockStatement',
  'booleanLiteral',
  'callExpression',
  'cloneNode',
  'conditionalExpression',
  'emptyStatement',
  'identifier',
  'memberExpression',
  'newExpression',
  'numericLiteral',
  'parenthesizedExpression',
  'stringLiteral',
  'throwStatement',
  'unaryExpression',
] satisfies (keyof typeof types)[]);

export type MuirMoiraMutatorsBabelTypes = Pick<
  typeof types,
  (typeof muirMoiraMutatorsBabelBuilders)[number]
>;

/** A mutator, free of Stryker: it maps a Babel path to replacement nodes. */
export interface MuirMoiraMutatorsBabelMutator<TName extends string = string> {
  /**
   * Letters only, as Stryker's directives match no other character; PascalCase, like Stryker's own mutators. Reports
   * show it, and `excludedMutations` and `// Stryker disable` comments select the mutator by it.
   */
  readonly name: TName;
  /** A TypeScript module in which the mutator makes a mutant; the install's self-check instruments it. */
  readonly sample: string;
  readonly mutate: (
    path: NodePath,
    t: MuirMoiraMutatorsBabelTypes,
  ) => Iterable<types.Node>;
  /**
   * Stryker's mutator filter: once the instrumenter leaves a node this mutator mutated, it passes every mutant made in
   * that node, and `false` drops this mutator's mutants of the node.
   */
  readonly filter?: (mutantsInScope: readonly unknown[]) => boolean;
}

/** The shape of Stryker's `NodeMutator`, which the instrumenter's exports keep out of reach. */
export interface MuirMoiraMutatorsStrykerMutator {
  readonly name: string;
  mutate(
    path: NodePath,
    context: { readonly isExpressionContext: boolean },
  ): Iterable<types.Node>;
  readonly filter?:
    | ((mutantsInScope: readonly unknown[]) => boolean)
    | undefined;
}

/**
 * Has a function for each member of the Babel types that the Babel mutators may call. The other members can differ, as
 * when the consumer's @babel/core is a newer patch than the instrumenter's.
 */
export function muirMoiraMutatorsAssertBabelTypes(
  value: unknown,
  missing: (name: string) => Error,
): asserts value is MuirMoiraMutatorsBabelTypes {
  const absent = muirMoiraMutatorsBabelBuilders.filter(
    (member) => typeof muirMoiraMutatorsFieldOf(value, member) !== 'function',
  );

  if (absent.length > 0) {
    throw missing(`Babel types with ${absent.join(', ')}`);
  }
}

export type MuirMoiraMutatorsBabelInstrumenter =
  MuirMoiraMutatorsInstrumenter<MuirMoiraMutatorsBabelTypes>;

export function muirMoiraMutatorsResolveBabelInstrumenter(
  packageName: string,
  corePackage: string = muirMoiraMutatorsCorePackageJsons()[0],
): Promise<MuirMoiraMutatorsBabelInstrumenter> {
  return muirMoiraMutatorsResolveInstrumenter(
    packageName,
    muirMoiraMutatorsAssertBabelTypes,
    corePackage,
  );
}

export type MuirMoiraMutatorsBabelInstallOptions = Pick<
  MuirMoiraMutatorsInstallOptions<
    MuirMoiraMutatorsBabelMutator,
    MuirMoiraMutatorsBabelInstrumenter
  >,
  | 'packageName'
  | 'installName'
  | 'testedVersion'
  | 'removeBuiltIns'
  | 'sets'
  | 'options'
>;

/** Installs Babel mutators into the instrumenter of each core that may run this process. */
export async function muirMoiraMutatorsInstallBabelMutators(
  options: MuirMoiraMutatorsBabelInstallOptions,
  resolve: () => Promise<readonly MuirMoiraMutatorsBabelInstrumenter[]> = () =>
    muirMoiraMutatorsResolveEachCore((corePackage) =>
      muirMoiraMutatorsResolveBabelInstrumenter(
        options.packageName,
        corePackage,
      ),
    ),
  warn: (message: string) => void = console.warn,
): Promise<void> {
  await muirMoiraMutatorsInstall({
    ...options,
    resolve,
    toListed: (mutator, { types }) =>
      muirMoiraMutatorsToStrykerMutator(mutator, types),
    warn,
  });
}

/** Yields nothing where Stryker's instrumenter allows no statement, such as a Vue template's expression. */
export function muirMoiraMutatorsToStrykerMutator(
  mutator: MuirMoiraMutatorsBabelMutator,
  t: MuirMoiraMutatorsBabelTypes,
): MuirMoiraMutatorsStrykerMutator {
  return {
    name: mutator.name,
    filter: mutator.filter,
    *mutate(path, { isExpressionContext }) {
      if (!isExpressionContext) {
        yield* mutator.mutate(path, t);
      }
    },
  };
}
