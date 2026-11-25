import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';

import {
  muirSirynPlaywrightLoadPageHelpers,
  muirSirynPlaywrightPageHelpersFrom,
  muirSirynPlaywrightPageHelpersScript,
  MuirSirynPlaywrightStrykerHelpersChanged,
} from '../src/page-helpers.ts';

/** Runs an init script as Playwright does, inside a function, in a fresh global scope. */
function initScriptRun(script: string): Record<string, unknown> {
  const page: Record<string, unknown> = {};
  vm.runInNewContext(`(() => {\n${script}\n})();`, page);

  return page;
}

test('the init script publishes the functions the header declares on globalThis', () => {
  const page = initScriptRun(
    muirSirynPlaywrightPageHelpersScript(
      'function one() {\n  return 1;\n}\nfunction two() {\n  return 2;\n}\nmuirSirynPlaywrightStrykerProbe = one("0");\n',
    ),
  );
  assert.equal(
    vm.runInContext('`${globalThis.one()} ${globalThis.two()}`', page),
    '1 2',
  );
});

test('the init script leaves out the probe statement', () => {
  const page = initScriptRun(
    muirSirynPlaywrightPageHelpersScript(
      'function one() {\n  return 1;\n}\nmuirSirynPlaywrightStrykerProbe = one("0");\n',
    ),
  );

  assert.equal('muirSirynPlaywrightStrykerProbe' in page, false);
});

test('a probe that calls a function the header does not declare refuses to start, naming it', () => {
  assert.throws(
    () =>
      muirSirynPlaywrightPageHelpersScript(
        'function one() {\n  return 1;\n}\nmuirSirynPlaywrightStrykerProbe = other("0") ? 0 : (one("0"), 1);\n',
      ),
    (error) =>
      error instanceof MuirSirynPlaywrightStrykerHelpersChanged &&
      /calls other, which the header does not declare/.test(error.message),
  );
});

test("with the installed instrumenter's helpers, a page covers a callback mutant and switches it on", async () => {
  const script = await muirSirynPlaywrightLoadPageHelpers();
  const instrumentedCallback =
    '(() => stryMutAct_9fa48("0") ? 1 - 1 : (stryCov_9fa48("0"), 1 + 1))()';
  const covering = initScriptRun(script);
  const switched = initScriptRun(
    `globalThis.__stryker__ = { activeMutant: "0" };\n${script}`,
  );

  assert.equal(vm.runInContext(instrumentedCallback, covering), 2);
  assert.equal(
    JSON.stringify(vm.runInContext('__stryker__.mutantCoverage', covering)),
    '{"static":{"0":1},"perTest":{}}',
  );
  assert.equal(vm.runInContext(instrumentedCallback, switched), 0);
});

test('an instrumented probe without its probe statement refuses to start', () => {
  assert.throws(
    () =>
      muirSirynPlaywrightPageHelpersScript(
        'function one() {}\nother = one("0");\n',
      ),
    (error) =>
      error instanceof MuirSirynPlaywrightStrykerHelpersChanged &&
      /no probe statement/.test(error.message),
  );
});

[
  { instrumenterModule: {}, refusal: 'it exports no Instrumenter class' },
  {
    instrumenterModule: { Instrumenter: class {} },
    refusal: 'its Instrumenter has no instrument method',
  },
  {
    instrumenterModule: {
      Instrumenter: class {
        instrument() {
          return { files: [] };
        }
      },
    },
    refusal: 'its Instrumenter returned no instrumented file',
  },
].forEach(({ instrumenterModule, refusal }) => {
  test(`an instrumenter module where ${refusal} refuses to start, saying so`, async () => {
    await assert.rejects(
      muirSirynPlaywrightPageHelpersFrom(instrumenterModule),
      (error) =>
        error instanceof MuirSirynPlaywrightStrykerHelpersChanged &&
        error.message.includes(`(${refusal})`),
    );
  });
});

test('a probe statement with no header before it refuses to start for the missing helpers', () => {
  assert.throws(
    () =>
      muirSirynPlaywrightPageHelpersScript(
        'muirSirynPlaywrightStrykerProbe = 1 + 1;\n',
      ),
    (error) =>
      error instanceof MuirSirynPlaywrightStrykerHelpersChanged &&
      /declares no helper function/.test(error.message),
  );
});

test('a header that declares no function refuses to start', () => {
  assert.throws(
    () =>
      muirSirynPlaywrightPageHelpersScript(
        'ns();\nmuirSirynPlaywrightStrykerProbe = 1 + 1;\n',
      ),
    (error) =>
      error instanceof MuirSirynPlaywrightStrykerHelpersChanged &&
      /declares no helper function/.test(error.message),
  );
});
