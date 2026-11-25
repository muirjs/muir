import { runCases } from './support/run-cases.ts';
import { spyStubOutcomeCases } from './spy-stub-outcome-cases.ts';

runCases('MuirProteusStorybookTestSpyStubOutcome', spyStubOutcomeCases, {
  experimental: { MuirProteusStorybookTestSpyStubOutcome: true },
});
