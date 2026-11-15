import assert from 'node:assert/strict';
import { join } from 'node:path';
import { it } from 'node:test';

import { builtInNames } from '@layzee/stryker-mutator-install';
import {
  countOf,
  readmeText,
  testReadmeTiers,
} from '@layzee/test-util-mutator-packages';

import { mutatorSets } from '../src/mutators.ts';
import { packageName } from '../src/package-name.ts';

const readmePath = join(import.meta.dirname, '..', 'README.md');

it('gives the size of each tier in the opening counts and in the default install line', () => {
  const { defaults, optIn, experimental } = mutatorSets;
  const total = defaults.length + optIn.length + experimental.length;
  const readme = readmeText(readmePath);

  assert.ok(
    readme.includes(
      `keeps Stryker's ${builtInNames.length} built-in mutators on and adds ${total} of its own: ${countOf(defaults.length, 'runs', 'run')} by default, ${countOf(optIn.length, 'is', 'are')} opt-in and ${countOf(experimental.length, 'is', 'are')} experimental.`,
    ),
    'the opening counts',
  );
  assert.ok(
    readme.includes(
      `${packageName}: ${defaults.length} LzMsw mutators on, beside Stryker's built-in mutators.`,
    ),
    'the default install line',
  );
});

testReadmeTiers(readmePath, mutatorSets);
