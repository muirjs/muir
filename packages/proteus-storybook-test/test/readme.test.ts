import { join } from 'node:path';

import { muirMoiraMutatorsBuiltInNames } from '@muirjs/moira-mutators';
import { muirTestReadmeTiers } from '@muirjs/test-util-mutator-packages';

import { muirProteusStorybookTestMutatorSets } from '../src/mutators.ts';
import { muirProteusStorybookTestPackageName } from '../src/package-name.ts';

muirTestReadmeTiers(
  join(import.meta.dirname, '..', 'README.md'),
  muirProteusStorybookTestMutatorSets,
  {
    packageName: muirProteusStorybookTestPackageName,
    prefix: 'MuirProteusStorybookTest',
    builtIns: 'off',
    builtInCount: muirMoiraMutatorsBuiltInNames.length,
  },
);
