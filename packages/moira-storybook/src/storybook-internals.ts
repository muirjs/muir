import { createRequire } from 'node:module';

import type * as StorybookCommon from 'storybook/internal/common';
import type * as StorybookCsf from 'storybook/internal/csf';
import type * as StorybookCsfTools from 'storybook/internal/csf-tools';

interface StorybookRequire {
  (id: 'storybook/internal/common'): typeof StorybookCommon;
  (id: 'storybook/internal/csf'): typeof StorybookCsf;
  (id: 'storybook/internal/csf-tools'): typeof StorybookCsfTools;
}

// Loaded on first use, so a package that imports this one without reading a Storybook project never loads Storybook.
const requireStorybook: StorybookRequire = createRequire(import.meta.url);

let common: typeof StorybookCommon | undefined;
let csf: typeof StorybookCsf | undefined;
let csfTools: typeof StorybookCsfTools | undefined;

export function muirMoiraStorybookInternalCommon(): typeof StorybookCommon {
  common ??= requireStorybook('storybook/internal/common');

  return common;
}

export function muirMoiraStorybookInternalCsf(): typeof StorybookCsf {
  csf ??= requireStorybook('storybook/internal/csf');

  return csf;
}

export function muirMoiraStorybookInternalCsfTools(): typeof StorybookCsfTools {
  csfTools ??= requireStorybook('storybook/internal/csf-tools');

  return csfTools;
}
