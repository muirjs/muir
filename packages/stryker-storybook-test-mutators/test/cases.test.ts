import { clickFocusCases, interactionCases, targetCases } from './cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('LzStorybookInteraction', interactionCases);
runCases('LzStorybookClickFocus', clickFocusCases);
runCases('LzStorybookInteractionTarget', targetCases);
