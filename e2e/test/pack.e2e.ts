import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { muirExec } from '../src/exec.ts';
import { muirNpmCli } from '../src/fixture.ts';
import { muirIsRecord } from '../src/report.ts';

const packagesDir = join(import.meta.dirname, '..', '..', 'packages');

function readManifest(name: string): Record<string, unknown> {
  const manifest: unknown = JSON.parse(
    readFileSync(join(packagesDir, name, 'package.json'), 'utf8'),
  );
  assert.ok(muirIsRecord(manifest), `packages/${name}/package.json`);

  return manifest;
}

function isPublished(manifest: Record<string, unknown>): boolean {
  const nx = manifest['nx'];
  const tags = muirIsRecord(nx) ? nx['tags'] : undefined;

  return Array.isArray(tags) && tags.includes('type:lib');
}

/** The files that `npm pack` would put in the tarball of `packages/<name>`. */
async function packedFiles(name: string): Promise<string[]> {
  const { exitCode, stdout, stderr } = await muirExec(
    process.execPath,
    [muirNpmCli(process.env, process.execPath), 'pack', '--dry-run', '--json'],
    { cwd: join(packagesDir, name) },
  );
  assert.equal(exitCode, 0, stderr);
  const packed: unknown = JSON.parse(stdout);
  // npm 11 prints an array of packed packages, npm 12 an object keyed by package name.
  const entries: readonly unknown[] = Array.isArray(packed)
    ? packed
    : muirIsRecord(packed)
      ? Object.values(packed)
      : [];
  const [entry] = entries;
  const files = muirIsRecord(entry) ? entry['files'] : undefined;
  assert.ok(Array.isArray(files), `npm pack printed no files:\n${stdout}`);

  return files.map((file: unknown) =>
    muirIsRecord(file) ? String(file['path']) : '',
  );
}

/** The files a consumer's import can resolve to: every target of `exports` except the workspace's source condition. */
function entryPoints(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value.replace(/^\.\//, '')];
  }

  if (!muirIsRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([condition, target]) =>
    condition === '@muirjs/source' ? [] : entryPoints(target),
  );
}

const published = readdirSync(packagesDir).filter((name) =>
  isPublished(readManifest(name)),
);

it('finds the packages to publish', () => {
  assert.equal(published.length, 20);
});

for (const name of published) {
  describe(`the tarball of packages/${name}`, () => {
    const manifest = readManifest(name);

    it('is published to the public registry under its scope', () => {
      assert.deepEqual(manifest['publishConfig'], { access: 'public' });
    });

    it('holds the built files, the manifest, the README and the license, and nothing else', async () => {
      const files = await packedFiles(name);

      assert.deepEqual(
        files.filter(
          (file) => !file.startsWith('dist/') || file.endsWith('.tsbuildinfo'),
        ),
        ['LICENSE', 'README.md', 'package.json'],
      );
    });

    it('holds every file its manifest points an import at', async () => {
      const files = await packedFiles(name);
      const targets = [
        ...entryPoints(manifest['exports']),
        ...entryPoints(manifest['main']),
        ...entryPoints(manifest['types']),
      ];

      assert.ok(targets.length > 1, 'the manifest names no entry point');
      assert.deepEqual(
        targets.filter((target) => !files.includes(target)),
        [],
      );
    });
  });
}
