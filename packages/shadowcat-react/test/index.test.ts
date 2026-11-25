import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PluginKind } from '@stryker-mutator/api/plugin';

import * as entry from '../src/index.ts';
import {
  muirShadowcatReactStylingIgnorer,
  muirShadowcatReactStylingSchema,
} from '../src/styling-ignorer.ts';

describe('index.ts', () => {
  it('declares the styling ignorer as its one Stryker plugin', () => {
    assert.deepEqual(entry.strykerPlugins, [
      {
        kind: PluginKind.Ignore,
        name: 'muir-shadowcat-react-styling',
        factory: muirShadowcatReactStylingIgnorer,
      },
    ]);
  });

  it("names the styling ignorer's options in one schema", () => {
    assert.deepEqual(entry.strykerValidationSchema, {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        muirShadowcatReactStyling: muirShadowcatReactStylingSchema,
      },
    });
  });
});
