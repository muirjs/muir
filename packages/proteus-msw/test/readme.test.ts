import { join } from 'node:path';

import { muirMoiraMutatorsBuiltInNames } from '@muirjs/moira-mutators';
import { muirTestReadmeTiers } from '@muirjs/test-util-mutator-packages';

import { muirProteusMswMutatorSets } from '../src/mutators.ts';
import { muirProteusMswPackageName } from '../src/package-name.ts';

muirTestReadmeTiers(
  join(import.meta.dirname, '..', 'README.md'),
  muirProteusMswMutatorSets,
  {
    packageName: muirProteusMswPackageName,
    prefix: 'MuirProteusMsw',
    builtIns: 'on',
    builtInCount: muirMoiraMutatorsBuiltInNames.length,
  },
);
