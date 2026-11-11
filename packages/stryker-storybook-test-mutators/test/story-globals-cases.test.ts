import { runCases } from './support/run-cases.ts';
import { storyGlobalsCases } from './story-globals-cases.ts';

runCases('LzStorybookStoryGlobals', storyGlobalsCases, {
  experimental: { LzStorybookStoryGlobals: true },
});
