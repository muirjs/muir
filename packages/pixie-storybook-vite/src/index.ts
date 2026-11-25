import { muirMoiraStorybookMockTransformerPluginName } from '@muirjs/moira-storybook';
import type { Plugin } from 'vite';

import { muirPixieStorybookViteTransform } from './transform.ts';

export { muirPixieStorybookViteMockResetPlugin } from './mock-reset.ts';
export { muirPixieStorybookViteStrykerPlugin } from './stryker-sandbox.ts';

export function muirPixieStorybookViteMockTransformerPlugin(): Plugin {
  return {
    name: muirMoiraStorybookMockTransformerPluginName,
    enforce: 'pre',
    transform: muirPixieStorybookViteTransform,
  };
}
