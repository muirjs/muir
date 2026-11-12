import { isDeepStrictEqual } from 'node:util';

import { sitesIn } from '../src/args.ts';
import { crashCases, fallbackCases } from './fallback-cases.ts';
import { playCases } from './play-cases.ts';
import { readCases } from './read-cases.ts';
import { shapeCases } from './shape-cases.ts';
import { composeSkips } from './support/compose-skips.ts';

composeSkips({
  cases: [
    ...fallbackCases,
    ...crashCases,
    ...playCases,
    ...readCases,
    ...shapeCases,
  ],
  skipsOf: (program) =>
    new Map([...sitesIn(program)].map(([site, { proofs }]) => [site, proofs])),
  layer: 'args',
  same: isDeepStrictEqual,
  unloadable: new Map([
    [
      'self-spread',
      'the story reads its own binding before it is initialized, a ReferenceError on import',
    ],
  ]),
});
