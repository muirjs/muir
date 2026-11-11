import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { propertyValue, topLevelBindings } from '../src/csf.ts';
import { field, list } from '../src/node-field.ts';
import { storyValues } from '../src/story-layers.ts';

describe('storyValues', () => {
  it("gives each layer's last value of a key, a spread object's in place of the spread, and the .extend() base's after", () => {
    const body = list(
      field(
        parse(
          [
            "import preview from '../.storybook/preview';",
            "const meta = preview.meta({ title: 'a/b' });",
            "const shared = { globals: { locale: 'de' } };",
            "export const A = meta.story({ globals: { locale: 'en' } });",
            "export const B = A.extend({ globals: { locale: 'fr' }, ...shared });",
          ].join('\n'),
          { sourceType: 'module', plugins: ['typescript'] },
        ),
        'program',
        'body',
      ),
    );
    const bindings = topLevelBindings(body);

    assert.deepEqual(
      storyValues(bindings.get('B'), bindings, 'globals').map((globals) =>
        field(propertyValue(globals, 'locale'), 'value'),
      ),
      ['de', 'en'],
    );
  });
});
