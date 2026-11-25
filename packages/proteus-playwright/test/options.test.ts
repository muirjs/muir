import assert from 'node:assert/strict';
import { it } from 'node:test';

import { muirProteusPlaywrightInstall } from '../src/install.ts';
import { muirProteusPlaywrightMutatorSets } from '../src/mutators.ts';
import { fakeInstrumenter } from './support/fake-instrumenter.ts';

async function startLineWith(options: unknown): Promise<string> {
  const { instrumenter } = fakeInstrumenter();
  const lines: string[] = [];

  await muirProteusPlaywrightInstall(
    muirProteusPlaywrightMutatorSets,
    options,
    async () => [instrumenter],
    () => undefined,
    (message) => lines.push(message),
  );

  return lines.join('\n');
}

it('leaves every opt-in mutator off with no options', async () => {
  const line = await startLineWith(undefined);

  assert.doesNotMatch(line, /Opt-in/);
});

it('turns every opt-in mutator on with extended', async () => {
  const line = await startLineWith({ extended: true });

  assert.match(
    line,
    / Opt-in or experimental: MuirProteusPlaywrightSleepWait, MuirProteusPlaywrightStateWait, MuirProteusPlaywrightNetworkWait, MuirProteusPlaywrightMountStory\.$/,
  );
});

it('turns one opt-in mutator on by its name', async () => {
  const line = await startLineWith({ MuirProteusPlaywrightSleepWait: true });

  assert.match(
    line,
    / Opt-in or experimental: MuirProteusPlaywrightSleepWait\.$/,
  );
});

it('turns every experimental mutator on with experimental', async () => {
  const line = await startLineWith({ experimental: true });

  assert.match(
    line,
    / Opt-in or experimental: MuirProteusPlaywrightRequestData, MuirProteusPlaywrightRequestUrl, MuirProteusPlaywrightClock\.$/,
  );
});

for (const name of [
  'MuirProteusPlaywrightRequestData',
  'MuirProteusPlaywrightRequestUrl',
  'MuirProteusPlaywrightClock',
]) {
  it(`turns ${name} on alone by its name inside experimental`, async () => {
    const line = await startLineWith({ experimental: { [name]: true } });

    assert.match(line, new RegExp(` Opt-in or experimental: ${name}\\.$`));
  });
}

it('names muirProteusPlaywrightMutators when options reach a roster with no opt-in or experimental mutators', async () => {
  const { instrumenter } = fakeInstrumenter();

  await assert.rejects(
    muirProteusPlaywrightInstall(
      {
        defaults: muirProteusPlaywrightMutatorSets.defaults,
        optIn: [],
        experimental: [],
      },
      { extended: true },
      async () => [instrumenter],
      () => undefined,
      () => undefined,
    ),
    { message: /, so muirProteusPlaywrightMutators\(\) takes no options\./ },
  );
});

it('leaves every experimental mutator off with extended', async () => {
  const line = await startLineWith({ extended: true });

  assert.doesNotMatch(
    line,
    /MuirProteusPlaywrightRequest|MuirProteusPlaywrightClock/,
  );
});
