import { assertionBeforeCases } from './cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('LzStorybookAssertionBefore', assertionBeforeCases, {
  experimental: { LzStorybookAssertionBefore: true },
});
