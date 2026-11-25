// Prints, for each TypeScript file named on the command line, the mutants that this package's mutators add to and
// remove from what Stryker's own mutators make there:
//
//   node packages/proteus-node/src/corpus-diff.ts <file.ts>...
import { muirProteusNodeCorpusDiff } from './mutant-diff.ts';
import { muirProteusNodeMutators } from './mutators.ts';

console.log(
  await muirProteusNodeCorpusDiff(
    process.argv.slice(2),
    () => muirProteusNodeMutators,
  ),
);
