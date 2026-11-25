import { beforeEach } from 'vitest';

import { muirPixieStorybookResetModuleMockSpies } from './module-mock-spies.ts';

// Stryker disable next-line all: only a Vitest run loads this setup file (outside one, beforeEach throws that Vitest failed to find the runner), so node:test cannot reach it; mock-reset.test.ts checks that the plugin adds it
beforeEach(muirPixieStorybookResetModuleMockSpies);
