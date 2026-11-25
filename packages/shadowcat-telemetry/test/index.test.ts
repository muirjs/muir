import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PluginKind } from '@stryker-mutator/api/plugin';

import * as entry from '../src/index.ts';
import {
  muirShadowcatTelemetryIgnorer,
  muirShadowcatTelemetrySchema,
} from '../src/telemetry-ignorer.ts';

describe('index.ts', () => {
  it('declares the telemetry ignorer as its one Stryker plugin', () => {
    assert.deepEqual(entry.strykerPlugins, [
      {
        kind: PluginKind.Ignore,
        name: 'muir-shadowcat-telemetry',
        factory: muirShadowcatTelemetryIgnorer,
      },
    ]);
  });

  it("names the telemetry ignorer's options in one schema", () => {
    assert.deepEqual(entry.strykerValidationSchema, {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { muirShadowcatTelemetry: muirShadowcatTelemetrySchema },
    });
  });
});
