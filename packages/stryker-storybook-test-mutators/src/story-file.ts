import type { NodePath, types } from '@babel/core';
import { csfShapes } from '@layzee/storybook-core';

/**
 * What `read` gives for the file around a path, read once per file. Every mutator calls it through `readStoryFileAt`
 * at the first node it visits: Stryker places a statement's mutants as it leaves the statement, so a later first read
 * could find a node replaced by a mutant switch.
 */
export function perFile<T>(
  read: (program: types.Program) => T,
  outsideProgram: T,
): (path: NodePath) => T {
  const byProgram = new WeakMap<object, T>();

  return (path) => {
    const program = path.isProgram()
      ? path
      : path.findParent((parent) => parent.isProgram());

    if (program === null || program.node.type !== 'Program') {
      return outsideProgram;
    }

    const cached = byProgram.get(program.node);

    if (cached !== undefined) {
      return cached;
    }

    const value = read(program.node);

    byProgram.set(program.node, value);

    return value;
  };
}

const storyTestCode = perFile(
  (program): ReadonlySet<unknown> => csfShapes(program).testCode,
  new Set(),
);

/**
 * Reads the story test code, and what each of a mutator's own per-file `readers` gives, unless already read for this
 * file. Every mutator calls it first at each node, since a line-range `--mutate` leaves the Program out and Stryker
 * then first calls the mutators below it.
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
