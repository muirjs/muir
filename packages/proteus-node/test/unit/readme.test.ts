import { join } from 'node:path';

import { muirTestReadmeTierReasons } from '@muirjs/test-util-mutator-packages';

import { muirProteusNodeMutatorSets } from '../../src/mutators.ts';

muirTestReadmeTierReasons(
  join(import.meta.dirname, '..', '..', 'README.md'),
  muirProteusNodeMutatorSets,
);
