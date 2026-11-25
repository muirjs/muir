import { globSync } from 'node:fs';
import { join } from 'node:path';

export const workspaceRoot = join(import.meta.dirname, '..', '..');

export interface StrykerConfigRow {
  readonly file: string;
  readonly project: string;
  readonly config: 'src' | 'test-code';
  readonly mutate: readonly string[];
}

export const configs: readonly StrykerConfigRow[] = [
  {
    file: 'packages/madrox-node-test/stryker.config.mjs',
    project: '@muirjs/madrox-node-test',
    config: 'src',
    mutate: ['packages/madrox-node-test/src/**/*.ts'],
  },
  {
    file: 'packages/madrox-node-test/stryker.test-code.config.mjs',
    project: '@muirjs/madrox-node-test',
    config: 'test-code',
    mutate: ['packages/madrox-node-test/test/**/*.test.ts'],
  },
  {
    file: 'packages/proteus-node/stryker.config.mjs',
    project: '@muirjs/proteus-node',
    config: 'src',
    mutate: [
      'packages/proteus-node/src/**/*.ts',
      'packages/proteus-node/test/synthetic/node-apis.ts',
    ],
  },
  {
    file: 'packages/proteus-node/stryker.test-code.config.mjs',
    project: '@muirjs/proteus-node',
    config: 'test-code',
    mutate: ['packages/proteus-node/test/**/*.test.ts'],
  },
  {
    file: 'packages/proteus-js/stryker.config.mjs',
    project: '@muirjs/proteus-js',
    config: 'src',
    mutate: [
      'packages/proteus-js/src/**/*.ts',
      'packages/proteus-js/test/synthetic/js-shapes.ts',
    ],
  },
  {
    file: 'packages/proteus-js/stryker.test-code.config.mjs',
    project: '@muirjs/proteus-js',
    config: 'test-code',
    mutate: ['packages/proteus-js/test/**/*.test.ts'],
  },
  {
    file: 'packages/proteus-node-test/stryker.config.mjs',
    project: '@muirjs/proteus-node-test',
    config: 'src',
    mutate: ['packages/proteus-node-test/src/**/*.ts'],
  },
  {
    file: 'packages/proteus-node-test/stryker.test-code.config.mjs',
    project: '@muirjs/proteus-node-test',
    config: 'test-code',
    mutate: ['packages/proteus-node-test/test/**/*.test.ts'],
  },
  {
    file: 'packages/siryn-node-test/stryker.config.mjs',
    project: '@muirjs/siryn-node-test',
    config: 'src',
    mutate: ['packages/siryn-node-test/src/**/*.ts'],
  },
  {
    file: 'packages/siryn-node-test/stryker.test-code.config.mjs',
    project: '@muirjs/siryn-node-test',
    config: 'test-code',
    mutate: ['packages/siryn-node-test/test/**/*.test.ts'],
  },
  {
    file: 'packages/moira-mutators/stryker.config.mjs',
    project: '@muirjs/moira-mutators',
    config: 'src',
    mutate: ['packages/moira-mutators/src/**/*.ts'],
  },
  {
    file: 'packages/moira-storybook/stryker.config.mjs',
    project: '@muirjs/moira-storybook',
    config: 'src',
    mutate: ['packages/moira-storybook/src/**/*.ts'],
  },
  {
    file: 'packages/pixie-storybook-vite/stryker.config.mjs',
    project: '@muirjs/pixie-storybook-vite',
    config: 'src',
    mutate: ['packages/pixie-storybook-vite/src/**/*.ts'],
  },
  {
    file: 'packages/proteus-react/stryker.config.mjs',
    project: '@muirjs/proteus-react',
    config: 'src',
    mutate: ['packages/proteus-react/src/**/*.ts'],
  },
  {
    file: 'packages/proteus-msw/stryker.config.mjs',
    project: '@muirjs/proteus-msw',
    config: 'src',
    mutate: ['packages/proteus-msw/src/**/*.ts'],
  },
  {
    file: 'packages/proteus-playwright/stryker.config.mjs',
    project: '@muirjs/proteus-playwright',
    config: 'src',
    mutate: ['packages/proteus-playwright/src/**/*.ts'],
  },
  {
    file: 'packages/proteus-storybook/stryker.config.mjs',
    project: '@muirjs/proteus-storybook',
    config: 'src',
    mutate: ['packages/proteus-storybook/src/**/*.ts'],
  },
  {
    file: 'packages/proteus-storybook-test/stryker.config.mjs',
    project: '@muirjs/proteus-storybook-test',
    config: 'src',
    mutate: ['packages/proteus-storybook-test/src/**/*.ts'],
  },
  {
    file: 'packages/shadowcat-js/stryker.config.mjs',
    project: '@muirjs/shadowcat-js',
    config: 'src',
    mutate: ['packages/shadowcat-js/src/**/*.ts'],
  },
  {
    file: 'packages/shadowcat-react/stryker.config.mjs',
    project: '@muirjs/shadowcat-react',
    config: 'src',
    mutate: ['packages/shadowcat-react/src/**/*.ts'],
  },
  {
    file: 'packages/shadowcat-storybook/stryker.config.mjs',
    project: '@muirjs/shadowcat-storybook',
    config: 'src',
    mutate: ['packages/shadowcat-storybook/src/**/*.ts'],
  },
  {
    file: 'packages/shadowcat-telemetry/stryker.config.mjs',
    project: '@muirjs/shadowcat-telemetry',
    config: 'src',
    mutate: ['packages/shadowcat-telemetry/src/**/*.ts'],
  },
  {
    file: 'packages/siryn-playwright/stryker.config.mjs',
    project: '@muirjs/siryn-playwright',
    config: 'src',
    mutate: ['packages/siryn-playwright/src/**/*.ts'],
  },
  {
    file: 'packages/test-util-ignorer-packages/stryker.config.mjs',
    project: '@muirjs/test-util-ignorer-packages',
    config: 'src',
    mutate: ['packages/test-util-ignorer-packages/src/**/*.ts'],
  },
  {
    file: 'packages/test-util-mutator-packages/stryker.config.mjs',
    project: '@muirjs/test-util-mutator-packages',
    config: 'src',
    mutate: ['packages/test-util-mutator-packages/src/**/*.ts'],
  },
  {
    file: 'e2e/stryker.config.mjs',
    project: 'e2e',
    config: 'src',
    mutate: ['e2e/src/**/*.ts'],
  },
  {
    file: 'e2e/stryker.test-code.config.mjs',
    project: 'e2e',
    config: 'test-code',
    mutate: ['e2e/test/unit/*.test.ts'],
  },
  {
    file: 'tools/eslint-rules/stryker.config.mjs',
    project: '@muirjs/eslint-rules',
    config: 'src',
    mutate: [
      'tools/eslint-rules/*.ts',
      '!tools/eslint-rules/*.test.ts',
      '!tools/eslint-rules/*.fixtures.ts',
    ],
  },
  {
    file: 'tools/eslint-rules/stryker.test-code.config.mjs',
    project: '@muirjs/eslint-rules',
    config: 'test-code',
    mutate: ['tools/eslint-rules/*.test.ts'],
  },
];

export function expandGlobs(patterns: readonly string[]): string[] {
  const glob = (globs: readonly string[]): string[] =>
    globSync(globs, { cwd: workspaceRoot }).map((file) =>
      file.replaceAll('\\', '/'),
    );
  const excluded = new Set(
    glob(
      patterns
        .filter((pattern) => pattern.startsWith('!'))
        .map((pattern) => pattern.slice(1)),
    ),
  );

  return glob(patterns.filter((pattern) => !pattern.startsWith('!'))).filter(
    (file) => !excluded.has(file),
  );
}
