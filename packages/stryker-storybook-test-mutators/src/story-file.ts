import type { NodePath, types } from '@babel/core';
import { type CsfShapes, csfShapes } from '@layzee/storybook-core';

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

const shapesOf = perFile<CsfShapes | undefined>(
  (program) => csfShapes(program.node),
  undefined,
);

const storyTestCode = (path: NodePath): ReadonlySet<unknown> =>
  shapesOf(path)?.testCode ?? new Set();

/** A meta object, or a story object or function, as storybook-core reads the file. */
export function isMetaOrStory(path: NodePath): boolean {
  const shapes = shapesOf(path);

  return (
    shapes !== undefined &&
    (shapes.metaObjects.has(path.node) ||
      shapes.literalContainers.has(path.node))
  );
}

/**
 * Reads the story test code, and what each of a mutator's own per-file `readers` gives, unless already read for this
 * file. Every mutator that reads a per-file value calls it first at each node it is given: Stryker places a statement's
 * mutants as it leaves the statement, so a later first read could find a node replaced by a mutant switch, and a
 * line-range `--mutate` leaves the Program out, so the first call can come at any node.
 */
export function readStoryFileAt(
  path: NodePath,
  ...readers: readonly ((path: NodePath) => unknown)[]
): void {
  [storyTestCode, ...readers].forEach((read) => read(path));
}

export function isInStoryTestCode(path: NodePath): boolean {
  const testCode = storyTestCode(path);

  return path.findParent((parent) => testCode.has(parent.node)) !== null;
}
