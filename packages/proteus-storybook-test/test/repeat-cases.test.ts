import { repeatCases } from './repeat-cases.ts';
import { runCases } from './support/run-cases.ts';

runCases('MuirProteusStorybookTestInteractionRepeat', repeatCases, {
  experimental: { MuirProteusStorybookTestInteractionRepeat: true },
});
