import { muirProteusJsxMutators } from '@muirjs/proteus-jsx';
import type { PartialStrykerOptions } from '@stryker-mutator/api/core';

await muirProteusJsxMutators();

const webServerMutate = process.env['MUIR_CORPUS_WEBSERVER_MUTATE'] ?? 'true';

if (webServerMutate !== 'true' && webServerMutate !== 'auto') {
  throw new Error(
    `MUIR_CORPUS_WEBSERVER_MUTATE must be true or auto, got ${JSON.stringify(webServerMutate)}.`,
  );
}

export default {
  plugins: ['@muirjs/siryn-playwright'],
  testRunner: 'muir-siryn-playwright',
  muirSirynPlaywright: {
    configFile: 'playwright.config.ts',
    webServer: { mutate: webServerMutate === 'auto' ? 'auto' : true },
  },
  mutate: [
    'src/Virtuoso.tsx',
    'src/TableVirtuoso.tsx',
    'src/VirtuosoGrid.tsx',
    'examples/grouped.tsx',
    'examples/window-table.tsx',
    'examples/gap.tsx',
    'examples/horizontal-rtl.tsx',
    'examples/collapsible-long-item.tsx',
  ],
  coverageAnalysis: 'perTest',
  timeoutMS: 11_000,
  dryRunTimeoutMinutes: 15,
  concurrency: 1,
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
  symlinkNodeModules: false,
} satisfies PartialStrykerOptions;
