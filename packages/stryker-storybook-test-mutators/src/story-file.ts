import type { NodePath, types } from '@babel/core';
import { csfShapes } from '@layzee/storybook-core';

/**
 * What `read` gives for the file around a path, read once per file. A mutator calls it at the Program: Stryker places
 * a statement's mutants as it leaves the statement, so a later first read could find a node replaced by a mutant
 * switch.
 */
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

const storyTestCode = perFile(
  (program): ReadonlySet<unknown> => csfShapes(program.node).testCode,
  new Set(),
);

/** Reads the story test code, and what each of a mutator's own per-file `readers` gives, on entering the Program. Every mutator calls it first. */
export function readStoryFileAt(
  path: NodePath,
  ...readers: readonly ((path: NodePath) => unknown)[]
): void {
  if (path.isProgram()) {
    [storyTestCode, ...readers].forEach((read) => read(path));
  }
}

export function isInStoryTestCode(path: NodePath): boolean {
  const testCode = storyTestCode(path);

  return path.findParent((parent) => testCode.has(parent.node)) !== null;
}
