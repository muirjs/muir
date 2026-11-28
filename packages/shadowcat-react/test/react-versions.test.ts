// What the ignorer rests on, under the oldest and the newest release of each supported React major: a class name
// and a paint style reach the DOM as the `class` and `style` attributes and change nothing else.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..', '..', '..');
const versionsDir = join(root, 'tools', 'react-versions');
// The workspace's own React resolves from the package, each other version from its folder, which installs it.
const reactDirs = [
  ...readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => join(versionsDir, name)),
  join(import.meta.dirname, '..'),
];

function exportedFunction(namespace: unknown, name: string) {
  assert.ok(typeof namespace === 'object' && namespace !== null);
  const value: unknown = Reflect.get(namespace, name);
  assert.ok(typeof value === 'function');

  return value;
}

for (const dir of reactDirs) {
  const requireIn = createRequire(join(dir, 'package.json'));
  const version = String(
    Reflect.get(Object(requireIn('react/package.json')), 'version'),
  );

  describe(`React ${version}`, () => {
    const html = (props: object) =>
      String(
        Reflect.apply(
          exportedFunction(
            requireIn('react-dom/server'),
            'renderToStaticMarkup',
          ),
          undefined,
          [
            Reflect.apply(
              exportedFunction(requireIn('react'), 'createElement'),
              undefined,
              ['a', { href: '/x', ...props }, 'Docs'],
            ),
          ],
        ),
      );

    it('renders className as the class attribute only', () => {
      assert.equal(
        html({ className: 'btn' }),
        '<a href="/x" class="btn">Docs</a>',
      );
    });

    it('renders a paint style as the style attribute only', () => {
      assert.equal(
        html({ style: { color: 'red', backgroundColor: 'blue' } }),
        '<a href="/x" style="color:red;background-color:blue">Docs</a>',
      );
    });
  });
}
