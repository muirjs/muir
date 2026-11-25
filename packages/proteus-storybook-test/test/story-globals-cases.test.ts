import { describe } from 'node:test';

import { runCases } from './support/run-cases.ts';
import {
  storyGlobalsCases,
  storyGlobalsCrashCases,
} from './story-globals-cases.ts';
import { storyGlobalsDefaultCases } from './story-globals-default-cases.ts';

runCases(
  'LzStorybookStoryGlobals',
  [...storyGlobalsCases, ...storyGlobalsDefaultCases],
  {
    experimental: { LzStorybookStoryGlobals: true },
  },
);
// One instrumentation per case, so that a crash fails only its own case.
storyGlobalsCrashCases.forEach((crashCase) => {
  describe(crashCase.id, () => {
    runCases('LzStorybookStoryGlobals', [crashCase], {
      experimental: { LzStorybookStoryGlobals: true },
    });
  });
});
