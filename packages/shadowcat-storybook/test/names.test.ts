// The typecheck fails when spyStubName or spyStubOutcomeName is no experimental mutator name of
// @muirjs/proteus-storybook-test.
import { it } from 'node:test';

import {
  muirMoiraStorybookSpyStubName,
  muirMoiraStorybookSpyStubOutcomeName,
} from '@muirjs/moira-storybook';
import type { MuirProteusStorybookTestMutatorOptions } from '@muirjs/proteus-storybook-test';

type ExperimentalName = keyof Exclude<
  MuirProteusStorybookTestMutatorOptions['experimental'],
  true | undefined
>;

it('names experimental mutators of the test mutators package', () => {
  muirMoiraStorybookSpyStubName satisfies ExperimentalName;
  muirMoiraStorybookSpyStubOutcomeName satisfies ExperimentalName;
});
