import { describe } from 'node:test';

import { crashCases, interactionCases } from './interaction-cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('LzStorybookInteraction', interactionCases);
describe('cases that once crashed the instrumenter', () => {
  runCases('LzStorybookInteraction', crashCases);
});
