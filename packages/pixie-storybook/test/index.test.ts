import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as entry from '../src/index.ts';
import { muirPixieStorybookMockTransformerPlugin } from '../src/index.ts';
import { muirPixieStorybookMockResetPlugin } from '../src/mock-reset.ts';
import { muirPixieStorybookTransform } from '../src/transform.ts';

describe('muirPixieStorybookMockTransformerPlugin', () => {
  it('is named muir-pixie-storybook-mock-transformer', () => {
    assert.equal(
      muirPixieStorybookMockTransformerPlugin().name,
      'muir-pixie-storybook-mock-transformer',
    );
  });

  it('runs before other plugins transform', () => {
    assert.equal(muirPixieStorybookMockTransformerPlugin().enforce, 'pre');
  });

  it('transforms modules with the stub rewrite', () => {
    assert.equal(
      muirPixieStorybookMockTransformerPlugin().transform,
      muirPixieStorybookTransform,
    );
  });
});

describe('package entry', () => {
  it('exports the mock reset plugin', () => {
    assert.equal(
      entry.muirPixieStorybookMockResetPlugin,
      muirPixieStorybookMockResetPlugin,
    );
  });
});
