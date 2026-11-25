import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { type TestContext, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  muirPixieStorybookViteMockResetPlugin,
  muirPixieStorybookViteMockResetConfig,
} from '../src/mock-reset.ts';
import { muirPixieStorybookViteResetModuleMockSpies } from '../src/module-mock-spies.ts';

const registryKey = '__STORYBOOK_MODULE_MOCK_SPIES__';

function setRegistry(t: TestContext, registry: unknown): void {
  const previous: unknown = Reflect.get(globalThis, registryKey);
  const had = registryKey in globalThis;

  if (registry === undefined) {
    Reflect.deleteProperty(globalThis, registryKey);
  } else {
    Reflect.set(globalThis, registryKey, registry);
  }

  t.after(() => {
    if (had) {
      Reflect.set(globalThis, registryKey, previous);
    } else {
      Reflect.deleteProperty(globalThis, registryKey);
    }
  });
}

describe('muirPixieStorybookViteMockResetPlugin', () => {
  it('is named muir-pixie-storybook-vite-mock-reset', () => {
    assert.equal(
      muirPixieStorybookViteMockResetPlugin().name,
      'muir-pixie-storybook-vite-mock-reset',
    );
  });

  it('adds the setup module as Vite resolves its config', () => {
    assert.equal(
      muirPixieStorybookViteMockResetPlugin().config,
      muirPixieStorybookViteMockResetConfig,
    );
  });
});

describe('mockResetConfig', () => {
  const setupFile = fileURLToPath(
    new URL('../src/mock-reset.setup.ts', import.meta.url),
  );
  const setupFolder = dirname(setupFile);
  const repositoryRoot = resolve(
    fileURLToPath(new URL('../../..', import.meta.url)),
  );
  const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

  it('adds the setup module that resets the spies before each test', () => {
    assert.deepEqual(
      muirPixieStorybookViteMockResetConfig({ root: packageRoot }).test,
      {
        setupFiles: [setupFile],
      },
    );
    assert.ok(existsSync(setupFile), `${setupFile} exists`);
  });

  // Browser mode serves setup files through the dev server, which refuses a linked package outside fs.allow.
  it("allows the setup module's folder beside the workspace root Vite allows when the config sets no fs.allow", () => {
    assert.deepEqual(
      muirPixieStorybookViteMockResetConfig({ root: packageRoot }).server,
      {
        fs: { allow: [repositoryRoot, setupFolder] },
      },
    );
  });

  it('allows the workspace root and the setup folder when the config sets server options but no fs', () => {
    assert.deepEqual(
      muirPixieStorybookViteMockResetConfig({
        root: packageRoot,
        server: { port: 6006 },
      }).server,
      { fs: { allow: [repositoryRoot, setupFolder] } },
    );
  });

  it("adds only the setup module's folder to an fs.allow the config sets, so that it widens nothing else", () => {
    assert.deepEqual(
      muirPixieStorybookViteMockResetConfig({
        root: packageRoot,
        server: { fs: { allow: ['src'] } },
      }).server,
      { fs: { allow: [setupFolder] } },
    );
  });

  it('finds the workspace root from the working directory when the config sets no root', () => {
    assert.deepEqual(muirPixieStorybookViteMockResetConfig({}).server, {
      fs: { allow: [repositoryRoot, setupFolder] },
    });
  });
});

describe('resetModuleMockSpies', () => {
  it('does nothing when no story module has loaded storybook/test', (t) => {
    setRegistry(t, undefined);

    assert.doesNotThrow(() => muirPixieStorybookViteResetModuleMockSpies());
  });

  it("resets every spy that sb.mock put in Storybook's registry", (t) => {
    const resets: string[] = [];
    const spy = (name: string) => ({ mockReset: () => resets.push(name) });
    setRegistry(t, new Set([spy('getName'), spy('getUser')]));

    muirPixieStorybookViteResetModuleMockSpies();

    assert.deepEqual(resets, ['getName', 'getUser']);
  });

  it('names the registry when it holds something other than a spy', (t) => {
    setRegistry(t, new Set([{}]));

    assert.throws(() => muirPixieStorybookViteResetModuleMockSpies(), {
      name: 'TypeError',
      message: /__STORYBOOK_MODULE_MOCK_SPIES__/,
    });
  });

  it('names the registry when it holds a value that is not an object', (t) => {
    setRegistry(t, new Set(['getName']));

    assert.throws(() => muirPixieStorybookViteResetModuleMockSpies(), {
      name: 'TypeError',
      message: /__STORYBOOK_MODULE_MOCK_SPIES__/,
    });
  });

  it('resets a spy that is a function, as Vitest spies are', (t) => {
    let resets = 0;
    const spy = Object.assign(() => undefined, { mockReset: () => resets++ });
    setRegistry(t, new Set([spy]));

    muirPixieStorybookViteResetModuleMockSpies();

    assert.equal(resets, 1);
  });
});
