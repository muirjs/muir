import { join } from 'node:path';

import { muirMoiraMutatorsBuiltInNames } from '@muirjs/moira-mutators';
import { muirTestReadmeTiers } from '@muirjs/test-util-mutator-packages';

import { muirProteusPlaywrightMutatorSets } from '../src/mutators.ts';
import { muirProteusPlaywrightPackageName } from '../src/package-name.ts';

muirTestReadmeTiers(
  join(import.meta.dirname, '..', 'README.md'),
  muirProteusPlaywrightMutatorSets,
  {
    packageName: muirProteusPlaywrightPackageName,
    prefix: 'MuirProteusPlaywright',
    builtIns: 'off',
    builtInCount: muirMoiraMutatorsBuiltInNames.length,
  },
);
