import { describe } from 'node:test';

import { crashCases, fallbackCases } from './fallback-cases.ts';
import { runCases } from './support/run-cases.ts';

runCases(fallbackCases);
describe('cases whose lookup could run without end', () => {
  runCases(crashCases);
});
