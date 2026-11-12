import { isDeepStrictEqual } from 'node:util';

import { field, isRecord } from '@layzee/storybook-core';

import { proofsBySite } from '../src/story-globals.ts';
import { assertionBeforeCases } from './assertion-before-cases.ts';
import { clickFocusCases } from './click-focus-cases.ts';
import { crashCases, interactionCases } from './interaction-cases.ts';
import { repeatCases } from './repeat-cases.ts';
import { spyStubCases } from './spy-stub-cases.ts';
import { spyStubOutcomeCases } from './spy-stub-outcome-cases.ts';
import {
  storyGlobalsCases,
  storyGlobalsCrashCases,
} from './story-globals-cases.ts';
import { composeSkips } from './support/compose-skips.ts';
import { targetCases } from './target-cases.ts';
import { waitForCases } from './wait-for-cases.ts';

const viewportDefaults: readonly unknown[] = [
  undefined,
  'responsive',
  '100pct-100pct',
];

/** What the globals do rather than how they are written: the Vitest addon's `setViewport` (Storybook 10.6.5) reads only the viewport's `value`, and an unset `grid` is no grid. */
function effect(globals: unknown): unknown {
  if (!isRecord(globals)) {
    return globals;
  }

  const { viewport, backgrounds, ...rest } = globals;
  const value = isRecord(viewport) ? viewport['value'] : viewport;

  return {
    ...rest,
    viewport: viewportDefaults.includes(value) ? undefined : value,
    backgrounds: {
      value: field(backgrounds, 'value'),
      grid: Boolean(field(backgrounds, 'grid')),
    },
  };
}

composeSkips({
  cases: [
    ...storyGlobalsCases,
    ...storyGlobalsCrashCases,
    ...assertionBeforeCases,
    ...clickFocusCases,
    ...interactionCases,
    ...crashCases,
    ...repeatCases,
    ...spyStubCases,
    ...spyStubOutcomeCases,
    ...targetCases,
    ...waitForCases,
  ],
  skipsOf: proofsBySite,
  layer: 'globals',
  same: (withProperty, withoutProperty) =>
    isDeepStrictEqual(effect(withProperty), effect(withoutProperty)),
  unloadable: new Map(),
  reasonsRowsMustCut: ['default-global'],
});
