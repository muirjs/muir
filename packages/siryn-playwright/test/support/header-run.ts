import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import { muirSirynPlaywrightWithEnv } from '../../src/process-env.ts';
import { muirSirynPlaywrightLoadPlaywright } from '../../src/playwright-internals.ts';
import {
  muirSirynPlaywrightHookTestNamespaceEnv,
  type MuirSirynPlaywrightRunSettings,
  muirSirynPlaywrightRunSettingsEnv,
} from '../../src/protocol.ts';
import { MuirSirynPlaywrightCollectingReporter } from '../../src/reporter.ts';
import { muirSirynPlaywrightTestIdHeader } from '../../src/server-protocol.ts';
import { hookTestNamespace, tempTree } from './doubles.ts';

const packageJson = fileURLToPath(
  new URL('../../package.json', import.meta.url),
);
const workerHookUrl = new URL('../../src/worker-hook.ts', import.meta.url).href;

export const playwrightTest = import.meta.resolve('@playwright/test');

async function recordingServer(t: TestContext) {
  const requests: [string, string | undefined][] = [];
  const server = createServer((request, response) => {
    const header = request.headers[muirSirynPlaywrightTestIdHeader];
    requests.push([
      request.url ?? '',
      typeof header === 'string' ? header : undefined,
    ]);
    response.end('ok');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');

  return { requests, port: address.port };
}

export async function headersOfRun(
  t: TestContext,
  spec: (baseUrl: string) => readonly string[],
): Promise<[string, string | undefined][]> {
  const { requests, port } = await recordingServer(t);
  const dir = tempTree(t, 'muir-header-run-', {
    'playwright.config.mjs': "export default { testDir: './tests' };\n",
    'tests/requests.spec.mjs': [...spec(`http://127.0.0.1:${port}`), ''].join(
      '\n',
    ),
  });
  const playwright = await muirSirynPlaywrightLoadPlaywright(
    packageJson,
  ).createTestRunner(path.join(dir, 'playwright.config.mjs'), {});
  await playwright.loadConfig();
  const reporter = new MuirSirynPlaywrightCollectingReporter();
  const settings: MuirSirynPlaywrightRunSettings = {
    outDir: tempTree(t, 'muir-header-run-out-'),
    perTest: true,
    testIdHosts: [`localhost:${port}`],
  };

  const { status } = await muirSirynPlaywrightWithEnv(
    {
      NODE_OPTIONS:
        `--import "${workerHookUrl}" ${process.env['NODE_OPTIONS'] ?? ''}`.trim(),
      [muirSirynPlaywrightRunSettingsEnv]: JSON.stringify(settings),
      [muirSirynPlaywrightHookTestNamespaceEnv]: hookTestNamespace,
    },
    () =>
      playwright.runTests(reporter, {
        locations: [],
        workers: 1,
        disableConfigReporters: true,
      }),
  );
  assert.equal(status, 'passed', reporter.outputTail);

  return requests;
}
