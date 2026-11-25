import { runCases } from './support/run-cases.ts';
import { waitForCases } from './wait-for-cases.ts';

runCases('MuirProteusStorybookTestWaitFor', waitForCases, {
  experimental: { MuirProteusStorybookTestWaitFor: true },
});
