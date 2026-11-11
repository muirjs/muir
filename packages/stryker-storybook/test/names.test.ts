// The typecheck fails when spyStubName is no experimental mutator name of @layzee/stryker-storybook-test-mutators.
import { it } from 'node:test';

import type { LzStorybookTestMutatorOptions } from '@layzee/stryker-storybook-test-mutators';

import { spyStubName } from '../src/stub-verdict.ts';

type ExperimentalName = keyof Exclude<
  LzStorybookTestMutatorOptions['experimental'],
  true | undefined
>;

it('names an experimental mutator of the test mutators package', () => {
  spyStubName satisfies ExperimentalName;
});
