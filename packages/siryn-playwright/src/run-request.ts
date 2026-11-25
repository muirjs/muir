import { INSTRUMENTER_CONSTANTS } from '@stryker-mutator/api/core';
import type {
  DryRunOptions,
  MutantRunOptions,
} from '@stryker-mutator/api/test-runner';

import type { MuirSirynPlaywrightRunTestsParams } from './playwright-internals.ts';
import {
  muirSirynPlaywrightRunSettingsEnv,
  type MuirSirynPlaywrightRunSettings,
} from './protocol.ts';
import {
  type MuirSirynPlaywrightSerialGroups,
  muirSirynPlaywrightWithSerialGroups,
} from './serial-groups.ts';
import type { MuirSirynPlaywrightServerControl } from './server-protocol.ts';
import {
  type MuirSirynPlaywrightConfigTimeouts,
  muirSirynPlaywrightDryRunBudget,
  muirSirynPlaywrightMutantRunBudget,
  type MuirSirynPlaywrightRunBudget,
} from './timeouts.ts';

export type MuirSirynPlaywrightRunRequest =
  | MuirSirynPlaywrightDryRunRequest
  | MuirSirynPlaywrightMutantRunRequest;

export interface MuirSirynPlaywrightDryRunRequest {
  readonly kind: 'dry';
  readonly disableBail: boolean;
  readonly coverageAnalysis: DryRunOptions['coverageAnalysis'];
  readonly budget: MuirSirynPlaywrightRunBudget;
}

export interface MuirSirynPlaywrightMutantRunRequest {
  readonly kind: 'mutant';
  readonly disableBail: boolean;
  readonly activeMutant: string;
  readonly mutantActivation: MutantRunOptions['mutantActivation'];
  /** Undefined runs every test. */
  readonly selection: MuirSirynPlaywrightTestSelection | undefined;
  readonly hitLimit: number | undefined;
  readonly budget: MuirSirynPlaywrightRunBudget;
}

export interface MuirSirynPlaywrightTestSelection {
  /** The test ids in Stryker's test filter. */
  readonly covering: readonly string[];
  /** The Playwright test ids to run: the covering tests and their serial groups. */
  readonly toRun: readonly string[];
}

export function muirSirynPlaywrightDryRunRequest({
  disableBail,
  coverageAnalysis,
}: DryRunOptions): MuirSirynPlaywrightDryRunRequest {
  return {
    kind: 'dry',
    disableBail,
    coverageAnalysis,
    budget: muirSirynPlaywrightDryRunBudget,
  };
}

export function muirSirynPlaywrightMutantRunRequest(
  {
    activeMutant,
    mutantActivation,
    testFilter,
    hitLimit,
    disableBail,
    timeout,
  }: MutantRunOptions,
  session: {
    readonly serialGroups: MuirSirynPlaywrightSerialGroups;
    readonly timeouts: MuirSirynPlaywrightConfigTimeouts;
  },
): MuirSirynPlaywrightMutantRunRequest {
  return {
    kind: 'mutant',
    disableBail,
    activeMutant: activeMutant.id,
    mutantActivation,
    selection: testFilter && {
      covering: testFilter,
      toRun: muirSirynPlaywrightWithSerialGroups(
        testFilter,
        session.serialGroups,
      ),
    },
    hitLimit,
    budget: muirSirynPlaywrightMutantRunBudget(timeout, session.timeouts),
  };
}

export interface MuirSirynPlaywrightRunPlan {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly params: Pick<
    MuirSirynPlaywrightRunTestsParams,
    'testIds' | 'maxFailures' | 'timeout'
  >;
  readonly control: MuirSirynPlaywrightServerControl;
}

export function muirSirynPlaywrightRunPlan(
  request: MuirSirynPlaywrightRunRequest,
  outDir: string,
  testIdHosts?: readonly string[],
  issuedTestIds?: readonly string[],
  pageHelpers?: string,
): MuirSirynPlaywrightRunPlan {
  const mutant = request.kind === 'mutant' ? request : undefined;
  const perTest =
    // Stryker disable next-line ConditionalExpression: equivalent, as a mutant run request has no coverageAnalysis, so it reads undefined
    request.kind === 'dry' && request.coverageAnalysis === 'perTest';
  const settings: MuirSirynPlaywrightRunSettings = {
    outDir,
    perTest,
    hitLimit: mutant?.hitLimit,
    testIdHosts: perTest ? testIdHosts : undefined,
    pageHelpers,
  };

  return {
    env: {
      [muirSirynPlaywrightRunSettingsEnv]: JSON.stringify(settings),
      [INSTRUMENTER_CONSTANTS.ACTIVE_MUTANT_ENV_VARIABLE]: mutant?.activeMutant,
    },
    params: {
      testIds: mutant?.selection?.toRun,
      maxFailures: request.disableBail ? undefined : 1,
      timeout: request.budget.testTimeout,
    },
    control: {
      outDir,
      perTest,
      activeMutant: mutant?.activeMutant,
      hitLimit: mutant?.hitLimit,
      ...(perTest && issuedTestIds !== undefined ? { issuedTestIds } : {}),
      ...(perTest && testIdHosts !== undefined ? { testIdHosts } : {}),
    },
  };
}
