import { mountStoryCases } from './mount-story-cases.ts';
import { runCases } from './support/run-cases.ts';

runCases(
  mountStoryCases,
  { MuirProteusPlaywrightMountStory: true },
  '@playwright/experimental-ct-react',
);
