import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PluginKind } from '@stryker-mutator/api/plugin';

import {
  muirShadowcatJsConsoleIgnorer,
  muirShadowcatJsConsoleSchema,
} from '../src/console-ignorer.ts';
import * as entry from '../src/index.ts';
import { muirShadowcatJsListOption } from '../src/list-option.ts';
import { muirShadowcatJsHideableCallee } from '../src/statement-call.ts';
import { muirShadowcatJsTypeOf } from '../src/type-of.ts';

describe('index.ts', () => {
  it('declares the console ignorer as its one Stryker plugin', () => {
    assert.deepEqual(entry.strykerPlugins, [
      {
        kind: PluginKind.Ignore,
        name: 'muir-shadowcat-js-console',
        factory: muirShadowcatJsConsoleIgnorer,
      },
    ]);
  });

  it("names the console ignorer's options in one schema", () => {
    assert.deepEqual(entry.strykerValidationSchema, {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { muirShadowcatJsConsole: muirShadowcatJsConsoleSchema },
    });
  });

  it('exports the call matcher, the list option reader and the type check for the other Shadowcat packages', () => {
    assert.equal(
      entry.muirShadowcatJsHideableCallee,
      muirShadowcatJsHideableCallee,
    );
    assert.equal(entry.muirShadowcatJsListOption, muirShadowcatJsListOption);
    assert.equal(entry.muirShadowcatJsTypeOf, muirShadowcatJsTypeOf);
  });
});
