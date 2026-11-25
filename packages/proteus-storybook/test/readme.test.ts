import { join } from 'node:path';

import { muirMoiraMutatorsBuiltInNames } from '@muirjs/moira-mutators';
import {
  muirTestReadmeTierReasons,
  muirTestReadmeTiers,
} from '@muirjs/test-util-mutator-packages';

import { muirProteusStorybookMutatorSets } from '../src/mutators.ts';
import { muirProteusStorybookPackageName } from '../src/package-name.ts';

muirTestReadmeTiers(
  join(import.meta.dirname, '..', 'README.md'),
  muirProteusStorybookMutatorSets,
  {
    packageName: muirProteusStorybookPackageName,
    prefix: 'MuirProteusStorybook',
    builtIns: 'on',
    builtInCount: muirMoiraMutatorsBuiltInNames.length,
  },
);

muirTestReadmeTierReasons(
  join(import.meta.dirname, '..', 'README.md'),
  muirProteusStorybookMutatorSets,
);
