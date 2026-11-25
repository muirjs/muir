import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';

import { muirSirynPlaywrightGlobalSetupWatchingConfiguredPorts } from '../src/port-watch.ts';

test('the watch on a configured port waits between checks, so a global setup that waits on a timer finishes', async () => {
  let checks = 0;

  await muirSirynPlaywrightGlobalSetupWatchingConfiguredPorts(
    () => setTimeout(20),
    {
      moves: [{ index: 0, from: 3000, to: 4820 }],
      configuredChecks: [
        {
          name: 'webServer 0',
          isUp: async () => {
            checks += 1;

            return false;
          },
        },
      ],
    },
    'auto',
  );

  assert.equal(checks, 2);
});
