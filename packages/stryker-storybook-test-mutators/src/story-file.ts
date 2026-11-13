import type { NodePath, types } from '@babel/core';
import {
  type CsfShapes,
  csfShapes,
  type Interaction,
  interactionsOf,
  type StoryInteractions,
} from '@layzee/storybook-core';

/** What `read` gives for the Program around a path, read once per Program; `outsideProgram` when there is none. */
export function perFile<T>(
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

    const value = read(program);

    byProgram.set(program.node, value);

    return value;
  };
}

const storyFileOf = perFile<
  | {
      readonly shapes: CsfShapes;
      readonly interactions: StoryInteractions;
    }
  | undefined
>((program) => {
  const shapes = csfShapes(program.node);

  return { shapes, interactions: interactionsOf(program.node, shapes) };
}, undefined);

/**
 * Reads the story test code and the interactions, and what each of a mutator's own per-file `readers` gives, unless
 * already read for this file. Every mutator that reads a per-file value calls it first at each node it is given:
 * Stryker places a statement's mutants as it leaves the statement, so a later first read could find a node replaced by
 * a mutant switch, and a line-range `--mutate` leaves the Program out, so the first call can come at any node.
 */
export function readStoryFileAt(
  path: NodePath,
  ...readers: readonly ((path: NodePath) => unknown)[]
): void {
  [storyFileOf, ...readers].forEach((read) => read(path));
}

export function isInStoryTestCode(path: NodePath): boolean {
  const testCode: ReadonlySet<unknown> =
    storyFileOf(path)?.shapes.testCode ?? new Set();

  return path.findParent((parent) => testCode.has(parent.node)) !== null;
}

/** The interaction whose statement is `path`'s node. */
export function interactionAt(path: NodePath): Interaction | undefined {
  return storyFileOf(path)?.interactions.at(path.node);
}

/** The interaction whose target query is the call nearest around `path`'s node. */
export function interactionAimedAt(path: NodePath): Interaction | undefined {
  return storyFileOf(path)?.interactions.aimedAt(path.node);
}
