import assert from 'node:assert/strict';
import { join } from 'node:path';
import { it } from 'node:test';

import {
  readmeText,
  testReadmeTiers,
} from '@layzee/test-util-mutator-packages';

import { mutatorSets } from '../src/mutators.ts';

const readmePath = join(import.meta.dirname, '..', 'README.md');

it('gives the size of each tier in the opening counts and in the default install line', () => {
  const { defaults, optIn, experimental } = mutatorSets;
  const total = defaults.length + optIn.length + experimental.length;
  const readme = readmeText(readmePath);

  assert.ok(
    readme.includes(
      `adds ${total} of its own: ${defaults.length} run by default, ${optIn.length} are opt-in and ${experimental.length} are`,
    ),
    'the opening counts',
  );
  assert.ok(
    readme.includes(`${defaults.length} LzPlaywright mutators on`),
    'the default install line',
  );
});

testReadmeTiers(readmePath, mutatorSets);
