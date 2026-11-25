// A `mutate` entry with a line range makes Stryker call the mutators only on nodes inside the range, never on the
// Program. coreInstrument always mutates whole files, so this test drives the instrumenter's class itself.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';

import { muirProteusPlaywrightMutators } from '../src/index.ts';
import { muirProteusPlaywrightResolveFromCore } from '../src/install.ts';

const source = [
  "import { test } from '@playwright/test';",
  "test('case', async ({ page }) => {",
  "  page.getByTestId('a');",
  "  page.getByTestId('b');",
  '});',
  '',
].join('\n');

test('the Locator mutators swap values inside a line range of the file', async () => {
  const instrumenter = await muirProteusPlaywrightResolveFromCore();

  await muirProteusPlaywrightMutators();

  const Instrumenter = muirMoiraMutatorsFieldOf(
    await import(
      pathToFileURL(join(instrumenter.dir, 'dist', 'src', 'index.js')).href
    ),
    'Instrumenter',
  );

  const instrument =
    typeof Instrumenter === 'function'
      ? muirMoiraMutatorsFieldOf(Instrumenter.prototype, 'instrument')
      : undefined;

  if (typeof Instrumenter !== 'function' || typeof instrument !== 'function') {
    throw new Error('the instrumenter exports no Instrumenter class');
  }

  const logger = new Proxy({}, { get: () => () => false });
  const result: unknown = await Reflect.apply(
    instrument,
    Reflect.construct(Instrumenter, [logger]),
    [
      [
        {
          name: join(import.meta.dirname, 'out', 'line-range.spec.ts'),
          content: source,
          mutate: [
            { start: { line: 2, column: 0 }, end: { line: 4, column: 0 } },
          ],
        },
      ],
      { plugins: null, excludedMutations: [], ignorers: [] },
    ],
  );
  const mutants = muirMoiraMutatorsFieldOf(result, 'mutants');

  assert.ok(Array.isArray(mutants));
  assert.deepEqual(
    mutants
      .map(
        (mutant: unknown) =>
          `${String(muirMoiraMutatorsFieldOf(mutant, 'mutatorName'))} ${String(muirMoiraMutatorsFieldOf(mutant, 'replacement'))}`,
      )
      .sort(),
    [
      "MuirProteusPlaywrightTestIdLocator 'a'",
      "MuirProteusPlaywrightTestIdLocator 'b'",
    ],
  );
});
