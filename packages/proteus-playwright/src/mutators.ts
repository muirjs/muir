import {
  muirMoiraMutatorsRoleSite,
  muirMoiraMutatorsSwapMutator,
  type MuirMoiraMutatorsMutatorOptions,
  type MuirMoiraMutatorsMutatorSets,
  type MuirMoiraMutatorsSampledMutator,
} from '@muirjs/moira-mutators';

import type { MuirProteusPlaywrightBabelTypes } from './install.ts';
import {
  muirProteusPlaywrightFulfillMutator,
  muirProteusPlaywrightOutcomeMutator,
} from './route-mocks.ts';
import { muirProteusPlaywrightRequestDataMutator } from './request-data.ts';
import { muirProteusPlaywrightRequestUrlMutator } from './request-url.ts';
import {
  muirProteusPlaywrightClickAction,
  muirProteusPlaywrightClock,
  muirProteusPlaywrightFocusAction,
  muirProteusPlaywrightInputAction,
  muirProteusPlaywrightNavigationAction,
  muirProteusPlaywrightNetworkWait,
  muirProteusPlaywrightRemovalMutator,
  muirProteusPlaywrightSleepWait,
  muirProteusPlaywrightStateWait,
} from './statement-removal.ts';
import {
  muirProteusPlaywrightIsSameStory,
  muirProteusPlaywrightMountStorySite,
  muirProteusPlaywrightTestIdSite,
  muirProteusPlaywrightTextSite,
} from './swap-sites.ts';

export interface MuirProteusPlaywrightMutator
  extends MuirMoiraMutatorsSampledMutator {
  mutate(path: unknown, t: MuirProteusPlaywrightBabelTypes): Iterable<unknown>;
}

function sampleOf(statement: string): string {
  return `test('a', async ({ page }) => {\n  ${statement}\n});\n`;
}

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave the roster out of a
// mutation run. The literal names are what the option type reads.
function roster<
  const T extends MuirMoiraMutatorsMutatorSets<MuirProteusPlaywrightMutator>,
>(sets: T): T {
  return sets;
}

export const muirProteusPlaywrightMutatorSets = roster({
  defaults: [
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightClickAction,
      sampleOf("await page.locator('#a').click();"),
    ),
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightInputAction,
      sampleOf("await page.locator('#a').fill('x');"),
    ),
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightFocusAction,
      sampleOf("await page.locator('#a').hover();"),
    ),
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightNavigationAction,
      sampleOf("await page.goto('/');"),
    ),
    muirMoiraMutatorsSwapMutator(
      'MuirProteusPlaywrightTestIdLocator',
      sampleOf("page.getByTestId('a');\n  page.getByTestId('b');"),
      muirProteusPlaywrightTestIdSite,
    ),
    muirMoiraMutatorsSwapMutator(
      'MuirProteusPlaywrightRoleLocator',
      sampleOf(
        "page.getByRole('button', { name: 'a' });\n  page.getByRole('button', { name: 'b' });",
      ),
      muirMoiraMutatorsRoleSite(['getByRole']),
    ),
    muirMoiraMutatorsSwapMutator(
      'MuirProteusPlaywrightTextLocator',
      sampleOf("page.getByText('a');\n  page.getByText('b');"),
      muirProteusPlaywrightTextSite,
    ),
    muirProteusPlaywrightFulfillMutator(
      'MuirProteusPlaywrightFulfill',
      sampleOf(
        "await page.route('**/api', (route) => route.fulfill({ json: { a: 1 } }));",
      ),
    ),
    muirProteusPlaywrightOutcomeMutator(
      'MuirProteusPlaywrightRouteOutcome',
      sampleOf("await page.route('**/api', (route) => route.abort());"),
    ),
  ],
  optIn: [
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightSleepWait,
      sampleOf('await page.waitForTimeout(100);'),
    ),
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightStateWait,
      sampleOf('await page.waitForLoadState();'),
    ),
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightNetworkWait,
      sampleOf("await page.waitForResponse('/a');"),
    ),
    muirMoiraMutatorsSwapMutator(
      'MuirProteusPlaywrightMountStory',
      sampleOf("await mount('a');\n  await mount('b');"),
      muirProteusPlaywrightMountStorySite,
      muirProteusPlaywrightIsSameStory,
    ),
  ],
  experimental: [
    muirProteusPlaywrightRequestDataMutator(
      'MuirProteusPlaywrightRequestData',
      sampleOf(
        "const response = await page.request.post('/a', { data: { a: 'b' } });\n  expect(response.ok()).toBe(true);",
      ),
    ),
    muirProteusPlaywrightRequestUrlMutator(
      'MuirProteusPlaywrightRequestUrl',
      sampleOf(
        "const response = await page.request.get('/a');\n  expect(response.ok()).toBe(true);",
      ),
    ),
    muirProteusPlaywrightRemovalMutator(
      muirProteusPlaywrightClock,
      sampleOf('await page.clock.runFor(1000);'),
    ),
  ],
});

type NamesIn<TTier extends readonly MuirMoiraMutatorsSampledMutator[]> =
  TTier[number]['name'];

export type MuirProteusPlaywrightMutatorOptions =
  MuirMoiraMutatorsMutatorOptions<
    NamesIn<(typeof muirProteusPlaywrightMutatorSets)['optIn']>,
    NamesIn<(typeof muirProteusPlaywrightMutatorSets)['experimental']>
  >;
