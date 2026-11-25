import { join } from 'node:path';

import { builtInNames } from '@muirjs/moira-mutators';
import { testReadmeTiers } from '@muirjs/test-util-mutator-packages';

import { mutatorSets } from '../src/mutators.ts';
import { packageName } from '../src/package-name.ts';

testReadmeTiers(join(import.meta.dirname, '..', 'README.md'), mutatorSets, {
  packageName,
  prefix: 'LzStorybook',
  builtIns: 'off',
  builtInCount: builtInNames.length,
});
