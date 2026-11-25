import { runCases } from './support/run-cases.ts';
import { targetCases } from './target-cases.ts';

runCases('MuirProteusStorybookTestInteractionTarget', targetCases, {
  experimental: { MuirProteusStorybookTestInteractionTarget: true },
});
