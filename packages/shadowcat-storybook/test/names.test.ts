// The typecheck fails when spyStubName or spyStubOutcomeName is no experimental mutator name of
// @muirjs/proteus-storybook-test.
import { it } from 'node:test';

import type { MuirProteusStorybookTestMutatorOptions } from '@muirjs/proteus-storybook-test';

import {
  muirShadowcatStorybookSpyStubName,
  muirShadowcatStorybookSpyStubOutcomeName,
} from '../src/stub-verdict.ts';

type ExperimentalName = keyof Exclude<
  MuirProteusStorybookTestMutatorOptions['experimental'],
  true | undefined
>;

it('names experimental mutators of the test mutators package', () => {
  muirShadowcatStorybookSpyStubName satisfies ExperimentalName;
  muirShadowcatStorybookSpyStubOutcomeName satisfies ExperimentalName;
});
