import { clickFocusCases, interactionCases } from './cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('LzStorybookInteraction', interactionCases);
runCases('LzStorybookClickFocus', clickFocusCases);
