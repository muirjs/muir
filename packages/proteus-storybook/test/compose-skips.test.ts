import { isDeepStrictEqual } from 'node:util';

import { muirComposeSkips } from '@muirjs/test-util-mutator-packages/compose-skips';

import { muirProteusStorybookSitesIn } from '../src/args.ts';
import { crashCases, fallbackCases } from './fallback-cases.ts';
import { playCases } from './play-cases.ts';
import { readCases } from './read-cases.ts';
import { shapeCases } from './shape-cases.ts';

muirComposeSkips({
  cases: [
    ...fallbackCases,
    ...crashCases,
    ...playCases,
    ...readCases,
    ...shapeCases,
  ],
  skipsOf: (program) =>
    new Map(
      [...muirProteusStorybookSitesIn(program)].map(([site, { proofs }]) => [
        site,
        proofs,
      ]),
    ),
  layer: 'args',
  same: isDeepStrictEqual,
  unloadable: new Map([
    [
      'self-spread',
      'the story reads its own binding before it is initialized, a ReferenceError on import',
    ],
  ]),
  reasonsRowsMustCut: ['same-as-below', 'overridden'],
});
