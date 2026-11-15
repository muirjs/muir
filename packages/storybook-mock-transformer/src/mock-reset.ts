import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Plugin, type UserConfig, searchForWorkspaceRoot } from 'vite';
import type { ViteUserConfig } from 'vitest/config';

export function lzStorybookMockResetPlugin(): Plugin {
  return { name: 'lz-storybook-mock-reset', config: mockResetConfig };
}

/**
 * Adds the setup module that resets the spies, and allows its folder in `server.fs.allow`: browser mode serves setup
 * files through the dev server, which refuses a linked package outside that list. A config without the list gets the
 * workspace root Vite would allow by itself, since Vite stops adding it once the list is set.
 */
export function mockResetConfig(config: UserConfig): ViteUserConfig {
  const setupFile = fileURLToPath(
    new URL(`./mock-reset.setup${extname(import.meta.url)}`, import.meta.url),
  );
  const setupFolder = dirname(setupFile);
  const allow =
    config.server?.fs?.allow === undefined
      ? // Stryker disable next-line StringLiteral: resolve('') and resolve('.') are both the working directory
        [searchForWorkspaceRoot(resolve(config.root ?? '.')), setupFolder]
      : [setupFolder];

  return { test: { setupFiles: [setupFile] }, server: { fs: { allow } } };
}
