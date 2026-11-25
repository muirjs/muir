import { muirMoiraStorybookMockTransformerPluginName } from '@muirjs/moira-storybook';
import type { Plugin } from 'vite';

import { muirPixieStorybookTransform } from './transform.ts';

export { muirPixieStorybookMockResetPlugin } from './mock-reset.ts';

export function muirPixieStorybookMockTransformerPlugin(): Plugin {
  return {
    name: muirMoiraStorybookMockTransformerPluginName,
    enforce: 'pre',
    transform: muirPixieStorybookTransform,
  };
}
