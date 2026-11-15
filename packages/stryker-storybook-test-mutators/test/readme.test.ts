import { join } from 'node:path';

import { builtInNames } from '@layzee/stryker-mutator-install';
import { testReadmeTiers } from '@layzee/test-util-mutator-packages';

import { mutatorSets } from '../src/mutators.ts';
import { packageName } from '../src/package-name.ts';

testReadmeTiers(join(import.meta.dirname, '..', 'README.md'), mutatorSets, {
  packageName,
  prefix: 'LzStorybook',
  builtIns: 'off',
  builtInCount: builtInNames.length,
});
