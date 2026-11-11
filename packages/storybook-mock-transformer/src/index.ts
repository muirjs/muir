import { mockTransformerPluginName } from '@layzee/storybook-csf';
import type { Plugin } from 'vite';

import { transform } from './transform.ts';

export { lzStorybookMockResetPlugin } from './mock-reset.ts';

export function lzStorybookMockTransformerPlugin(): Plugin {
  return { name: mockTransformerPluginName, enforce: 'pre', transform };
}
