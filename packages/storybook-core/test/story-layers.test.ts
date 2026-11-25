import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { topLevelBindings } from '../src/csf.ts';
import { field } from '../src/node-field.ts';
import {
  isObjectLiteral,
  objectValue,
  unknownValue,
} from '../src/object-value.ts';
import {
  asWrittenLayer,
  rootLayer,
  valuesOf,
  type Layer,
} from '../src/resolved-values.ts';
import { extendLevels } from '../src/story-layers.ts';
import { bodyOf } from './support/parse-module.ts';

function rootLayers(
  bindings: ReadonlyMap<string, unknown>,
  written: ReadonlySet<unknown>,
): readonly Layer[] {
  return extendLevels(bindings.get('B'), 'B', bindings).map((level) =>
    level === unknownValue
      ? level
      : rootLayer(level.argument, level.owner, written, level.bindings),
  );
}

function storyGlobals(source: readonly string[]): readonly unknown[] {
  const bindings = topLevelBindings(bodyOf(...source));

  return rootLayers(bindings, new Set()).map(
    (layer) => valuesOf(layer, 'globals')[0],
  );
}

function localeOf(globals: unknown): unknown {
  return isObjectLiteral(globals)
    ? field(objectValue(globals, 'locale'), 'value')
    : globals;
}

describe('extendLevels', () => {
  it("gives each layer's last value of a key, a spread object's in place of the spread, and the .extend() base's after", () => {
    assert.deepEqual(
      storyGlobals([
        "import preview from '../.storybook/preview';",
        "const meta = preview.meta({ title: 'a/b' });",
        "const shared = { globals: { locale: 'de' } };",
        "export const A = meta.story({ globals: { locale: 'en' } });",
        "export const B = A.extend({ globals: { locale: 'fr' }, ...shared });",
      ]).map(localeOf),
      ['de', 'en'],
    );
  });

  it('gives the value of a member of a top-level object the story spreads, in place of the spread', () => {
    assert.deepEqual(
      storyGlobals([
        "const Common = { story: { globals: { locale: 'de' } } };",
        'export const B = { ...Common.story };',
      ]).map(localeOf),
      ['de'],
    );
  });

  it('reads a story the file writes as unknown through its root, and as its literal as written', () => {
    const bindings = topLevelBindings(
      bodyOf(
        "export const B = { globals: { locale: 'de' } };",
        "B.globals.locale = 'fr';",
      ),
    );
    const typesOf = (layers: readonly Layer[]) =>
      layers.map((layer) => field(valuesOf(layer, 'globals')[0], 'type'));
    const [own] = extendLevels(bindings.get('B'), 'B', bindings);

    assert.deepEqual(
      {
        root: typesOf(rootLayers(bindings, new Set(['B']))),
        asWritten: typesOf([asWrittenLayer(own.argument, own.bindings)]),
      },
      { root: [undefined], asWritten: ['ObjectExpression'] },
    );
  });

  it('gives an unknown value for an .extend() base the file does not bind', () => {
    assert.deepEqual(
      storyGlobals([
        "import { A } from './a';",
        "export const B = A.extend({ globals: { locale: 'fr' } });",
      ]).slice(1),
      [unknownValue],
    );
  });
});
