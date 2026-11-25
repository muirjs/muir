import { runCases } from './support/run-cases.ts';
import { waitCases } from './wait-cases.ts';

runCases(waitCases, {
  extended: true,
  experimental: { MuirProteusPlaywrightClock: true },
});
