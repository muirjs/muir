import { runCases } from './support/run-cases.ts';
import { spyStubOutcomeCases } from './spy-stub-outcome-cases.ts';

runCases('LzStorybookSpyStubOutcome', spyStubOutcomeCases, {
  experimental: { LzStorybookSpyStubOutcome: true },
});
