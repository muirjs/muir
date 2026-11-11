import { describe } from 'node:test';

import {
  clickFocusCases,
  crashCases,
  interactionCases,
  targetCases,
} from './cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('LzStorybookInteraction', interactionCases);
runCases('LzStorybookClickFocus', clickFocusCases);
runCases('LzStorybookInteractionTarget', targetCases);
describe('cases that once crashed the instrumenter', () => {
  runCases('LzStorybookInteraction', crashCases);
});
