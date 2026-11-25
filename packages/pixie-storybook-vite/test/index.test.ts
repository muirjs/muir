import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as entry from '../src/index.ts';
import { muirPixieStorybookViteMockTransformerPlugin } from '../src/index.ts';
import { muirPixieStorybookViteMockResetPlugin } from '../src/mock-reset.ts';
import { muirPixieStorybookViteStrykerPlugin } from '../src/stryker-sandbox.ts';
import { muirPixieStorybookViteTransform } from '../src/transform.ts';

describe('muirPixieStorybookViteMockTransformerPlugin', () => {
  it('is named muir-pixie-storybook-vite-mock-transformer', () => {
    assert.equal(
      muirPixieStorybookViteMockTransformerPlugin().name,
      'muir-pixie-storybook-vite-mock-transformer',
    );
  });

  it('runs before other plugins transform', () => {
    assert.equal(muirPixieStorybookViteMockTransformerPlugin().enforce, 'pre');
  });

  it('transforms modules with the stub rewrite', () => {
    assert.equal(
      muirPixieStorybookViteMockTransformerPlugin().transform,
      muirPixieStorybookViteTransform,
    );
  });
});

describe('package entry', () => {
  it('exports the mock reset plugin', () => {
    assert.equal(
      entry.muirPixieStorybookViteMockResetPlugin,
      muirPixieStorybookViteMockResetPlugin,
    );
  });

  it('exports the sandbox plugin', () => {
    assert.equal(
      entry.muirPixieStorybookViteStrykerPlugin,
      muirPixieStorybookViteStrykerPlugin,
    );
  });
});
