import { describe } from 'node:test';

import { runCases } from './support/run-cases.ts';
import {
  storyGlobalsCases,
  storyGlobalsCrashCases,
} from './story-globals-cases.ts';
import { storyGlobalsDefaultCases } from './story-globals-default-cases.ts';

runCases(
  'MuirProteusStorybookTestStoryGlobals',
  [...storyGlobalsCases, ...storyGlobalsDefaultCases],
  {
    experimental: { MuirProteusStorybookTestStoryGlobals: true },
  },
);
// One instrumentation per case, so that a crash fails only its own case.
storyGlobalsCrashCases.forEach((crashCase) => {
  describe(crashCase.id, () => {
    runCases('MuirProteusStorybookTestStoryGlobals', [crashCase], {
      experimental: { MuirProteusStorybookTestStoryGlobals: true },
    });
  });
});
