import { waitForCases } from './cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('LzStorybookWaitFor', waitForCases, {
  experimental: { LzStorybookWaitFor: true },
});
