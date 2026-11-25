import type { NodePath, types } from '@babel/core';
import {
  type MuirMoiraStorybookCsfShapes,
  muirMoiraStorybookCsfShapes,
  type MuirMoiraStorybookInteraction,
  muirMoiraStorybookInteractionsOf,
  muirMoiraStorybookReadNamingStoryFile,
  type MuirMoiraStorybookStoryInteractions,
} from '@muirjs/moira-storybook';

import { muirProteusStorybookTestPackageName } from './package-name.ts';

/** What `read` gives for the Program around a path, read once per Program; `outsideProgram` when there is none. */
export function muirProteusStorybookTestPerFile<T>(
  read: (program: NodePath<types.Program>) => T,
  outsideProgram: T,
): (path: NodePath) => T {
  const byProgram = new WeakMap<object, T>();

  return (path) => {
    const program = path.isProgram()
      ? path
      : path.findParent((parent) => parent.isProgram());

    if (program === null || !program.isProgram()) {
      return outsideProgram;
    }

    const cached = byProgram.get(program.node);

    if (cached !== undefined) {
      return cached;
    }

    const value = muirMoiraStorybookReadNamingStoryFile(
      muirProteusStorybookTestPackageName,
      program,
      () => read(program),
    );

    byProgram.set(program.node, value);

    return value;
  };
}

const storyFileOf = muirProteusStorybookTestPerFile<
  MuirMoiraStorybookCsfShapes | undefined
>((program) => muirMoiraStorybookCsfShapes(program.node), undefined);

const storyInteractions = muirProteusStorybookTestPerFile<
  MuirMoiraStorybookStoryInteractions | undefined
>((program) => {
  const shapes = storyFileOf(program);

  return shapes === undefined
    ? undefined
    : muirMoiraStorybookInteractionsOf(program.node, shapes);
}, undefined);

/**
 * Reads the story test code, and what each of a mutator's own per-file `readers` gives, unless already read for this
 * file. Every mutator that reads a per-file value calls it first at each node it is given: Stryker places a
 * statement's mutants as it leaves the statement, so a later first read could find a node replaced by a mutant switch,
 * and a line-range `--mutate` leaves the Program out, so the first call can come at any node.
 */
export function muirProteusStorybookTestReadStoryFileAt(
  path: NodePath,
  ...readers: readonly ((path: NodePath) => unknown)[]
): void {
  [storyFileOf, ...readers].forEach((read) => read(path));
}

export function muirProteusStorybookTestIsInStoryTestCode(
  path: NodePath,
): boolean {
  const testCode: ReadonlySet<unknown> =
    storyFileOf(path)?.testCode ?? new Set();

  return path.findParent((parent) => testCode.has(parent.node)) !== null;
}

/** The interaction the test mutators place whose statement is `path`'s node. */
export function muirProteusStorybookTestPlacedInteractionAt(
  path: NodePath,
): MuirMoiraStorybookInteraction | undefined {
  return placed(storyInteractions(path)?.at(path.node));
}

/** The interaction the test mutators place whose target query is the call nearest around `path`'s node. */
export function muirProteusStorybookTestPlacedInteractionAimedAt(
  path: NodePath,
): MuirMoiraStorybookInteraction | undefined {
  return placed(storyInteractions(path)?.aimedAt(path.node));
}

/** The interaction unless it stands in a `beforeEach` or `afterEach`, the site rule of every interaction mutator. */
function placed(
  interaction: MuirMoiraStorybookInteraction | undefined,
): MuirMoiraStorybookInteraction | undefined {
  return interaction?.inHook === true ? undefined : interaction;
}
