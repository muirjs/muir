import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';

import {
  muirMoiraNodeTestResolveFromCore,
  muirMoiraNodeTestToNodeMutator,
  type MuirMoiraNodeTestInstrumentedMutant,
  type MuirMoiraNodeTestInstrumenter,
  type MuirMoiraNodeTestMutator,
} from '@muirjs/moira-node-test';
import { muirProteusNodePackageName } from './package-name.ts';

interface MutantDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export function muirProteusNodeMutantDiff(
  before: readonly MuirMoiraNodeTestInstrumentedMutant[],
  after: readonly MuirMoiraNodeTestInstrumentedMutant[],
): MutantDiff {
  const beforeLines = before.map(line);
  const afterLines = after.map(line);

  return {
    added: without(afterLines, beforeLines),
    removed: without(beforeLines, afterLines),
  };
}

/**
 * A removed mutant is one that a Stryker mutator's filter drops once a mutant of one of these mutators shares its
 * scope, as the CallExpression mutator does.
 */
export async function muirProteusNodeCorpusDiff(
  names: readonly string[],
  mutatorsFor: (name: string) => readonly MuirMoiraNodeTestMutator[],
  resolve: () => Promise<MuirMoiraNodeTestInstrumenter> = muirMoiraNodeTestResolveFromCore,
  read: (name: string) => string = (name) => readFileSync(name, 'utf8'),
): Promise<string> {
  const instrumenter = await resolve();
  const sections: string[] = [];

  for (const name of names) {
    const nodeMutators = mutatorsFor(name).map((mutator) =>
      muirMoiraNodeTestToNodeMutator(
        mutator,
        instrumenter.types,
        muirProteusNodePackageName,
      ),
    );
    const files = [{ name, content: read(name) }];
    const before = await instrumenter.instrument(
      files,
      instrumenter.allMutators,
    );
    const after = await instrumenter.instrument(files, [
      ...instrumenter.allMutators,
      ...nodeMutators,
    ]);
    const { added, removed } = muirProteusNodeMutantDiff(before, after);
    const lines = [
      ...added.map((mutant) => `    + ${mutant}`),
      ...removed.map((mutant) => `    - ${mutant}`),
    ];

    sections.push(
      `### ${relative(process.cwd(), name).split(sep).join('/')}\n\n` +
        `${before.length} mutants without the mutators, ${after.length} with them.\n\n` +
        `${lines.length > 0 ? lines.join('\n') : '    (no difference)'}\n`,
    );
  }

  return sections.join('\n');
}

function line({
  mutatorName,
  location,
  replacement,
}: MuirMoiraNodeTestInstrumentedMutant): string {
  const { line: row, column } = location.start;

  return `${row + 1}:${column + 1} ${mutatorName} ${replacement.replace(/\s+/g, ' ')}`;
}

function without(from: readonly string[], other: readonly string[]): string[] {
  const left = [...other];

  return from.filter((entry) => {
    const index = left.indexOf(entry);

    if (index === -1) {
      return true;
    }

    left.splice(index, 1);

    return false;
  });
}
