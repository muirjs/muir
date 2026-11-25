import { assertionBeforeCases } from './assertion-before-cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('MuirProteusStorybookTestAssertionBefore', assertionBeforeCases, {
  experimental: { MuirProteusStorybookTestAssertionBefore: true },
});
