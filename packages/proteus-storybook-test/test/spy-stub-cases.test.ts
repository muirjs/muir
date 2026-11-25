import { runCases } from './support/run-cases.ts';
import { spyStubCases } from './spy-stub-cases.ts';

runCases('MuirProteusStorybookTestSpyStub', spyStubCases, {
  experimental: { MuirProteusStorybookTestSpyStub: true },
});
