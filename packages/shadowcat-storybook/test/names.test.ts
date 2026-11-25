// The typecheck fails when spyStubName or spyStubOutcomeName is no experimental mutator name of
// @muirjs/proteus-storybook-test.
import { it } from 'node:test';

import type { LzStorybookTestMutatorOptions } from '@muirjs/proteus-storybook-test';

import { spyStubName, spyStubOutcomeName } from '../src/stub-verdict.ts';

type ExperimentalName = keyof Exclude<
  LzStorybookTestMutatorOptions['experimental'],
  true | undefined
>;

it('names experimental mutators of the test mutators package', () => {
  spyStubName satisfies ExperimentalName;
  spyStubOutcomeName satisfies ExperimentalName;
});
