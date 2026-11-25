// The worker hook's install against a fake Playwright in this process.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { TestContext } from 'node:test';

import { INSTRUMENTER_CONSTANTS } from '@stryker-mutator/api/core';

import { muirSirynPlaywrightIsRecord } from '../../src/is-record.ts';
import {
  type MuirSirynPlaywrightHookedBrowser,
  type MuirSirynPlaywrightHookedContext,
  type MuirSirynPlaywrightHookedFrame,
  type MuirSirynPlaywrightHookedPage,
  type MuirSirynPlaywrightInstrumentation,
  type MuirSirynPlaywrightSlotType,
} from '../../src/playwright-internals.ts';
import { muirSirynPlaywrightSetEnv } from '../../src/process-env.ts';
import type {
  MuirSirynPlaywrightPageSettings,
  MuirSirynPlaywrightRunSettings,
} from '../../src/protocol.ts';
import type { MuirSirynPlaywrightStrykerNamespace } from '../../src/namespace.ts';
import type { muirSirynPlaywrightInstall } from '../../src/worker-hook.ts';
import { tempTree } from './doubles.ts';

const activeMutantEnv = INSTRUMENTER_CONSTANTS.ACTIVE_MUTANT_ENV_VARIABLE;

type Listener = Parameters<
  MuirSirynPlaywrightInstrumentation['addListener']
>[0];

/** The shape of Playwright's TestInfo._timeoutManager._running.runnable. */
export interface Runnable {
  readonly type: MuirSirynPlaywrightSlotType;
  readonly fixture?: { readonly title: string };
}

interface FakeFrame {
  /** The global name the frame's namespace has; undefined reads the name the hook asks for. */
  readonly name?: string;
  readonly evaluate?: (
    fn: (name: string) => unknown,
    name: string,
  ) => Promise<unknown>;
  readonly detached?: boolean;
}

function frame({
  name,
  evaluate,
  detached = false,
}: FakeFrame = {}): MuirSirynPlaywrightHookedFrame {
  return {
    evaluate: (fn, asked) =>
      evaluate ? evaluate(fn, asked) : Promise.resolve(fn(name ?? asked)),
    isDetached: () => detached,
  };
}

function page(frames: MuirSirynPlaywrightHookedFrame[] = [frame()]) {
  const closed: unknown[] = [];
  const created: MuirSirynPlaywrightHookedPage = {
    frames: () => frames,
    close: async (options) => {
      closed.push(options);
    },
  };

  return { page: created, closed };
}

function browser() {
  const contexts: MuirSirynPlaywrightHookedContext[] = [];
  const closed: unknown[] = [];
  const created: MuirSirynPlaywrightHookedBrowser = {
    contexts: () => contexts,
    close: async (options) => {
      closed.push(options);
    },
  };

  return { browser: created, contexts, closed };
}

/**
 * Installs the hook with a fake Playwright and a namespace no other code in this process uses. The
 * namespace stands in for the worker's and for every fake page's, since the fake frames read it here.
 */
export function fakeInstall(
  installHook: typeof muirSirynPlaywrightInstall,
  t: TestContext,
  settings: Omit<MuirSirynPlaywrightRunSettings, 'outDir'>,
  {
    activeMutant,
    prepare,
    info,
  }: {
    activeMutant?: string;
    /** Runs before install, as the worker's earlier code would. */
    prepare?: (outDir: string, ns: string) => void;
    info?: () => unknown;
  } = {},
) {
  const ns = `__hookTest${Math.random().toString(36).slice(2)}__`;
  const outDir = tempTree(t, 'worker-hook-install-');
  const scope: Record<string, unknown> = globalThis;
  prepare?.(outDir, ns);
  const exitListeners = process.listeners('exit');
  let running: string | undefined;
  let runnable: Runnable = { type: 'test' };
  let listener: Listener | undefined;
  const test = {
    info:
      info ??
      (() => {
        if (running === undefined) {
          throw new Error(
            'test.info() can only be called while a test is running',
          );
        }

        return {
          testId: running,
          _timeoutManager: { _running: { runnable } },
        };
      }),
  };
  const modules: Record<string, unknown> = {
    'playwright/package.json': { version: '1.64.1' },
    'playwright/test': { test },
    'playwright-core': {
      _instrumentation: {
        addListener: (added: Listener) => {
          listener = added;
        },
      },
    },
  };

  const previousMutant = process.env[activeMutantEnv];
  muirSirynPlaywrightSetEnv({ [activeMutantEnv]: activeMutant });

  try {
    installHook((id) => modules[id], { outDir, ...settings }, ns);
  } finally {
    muirSirynPlaywrightSetEnv({ [activeMutantEnv]: previousMutant });
  }

  const added = process
    .listeners('exit')
    .filter((exit) => !exitListeners.includes(exit));
  t.after(() => {
    added.forEach((exit) => process.off('exit', exit));
    delete scope[ns];
  });

  assert.ok(listener);
  const hooks = listener;

  function read() {
    const [file, ...more] = readdirSync(outDir);
    assert.ok(file !== undefined && more.length === 0, 'one snapshot file');

    return readFileSync(path.join(outDir, file), 'utf8');
  }

  /** A context as Playwright creates it, which the hook sees through the instrumentation. */
  async function context(owner: ReturnType<typeof browser> | null = null) {
    const pages: MuirSirynPlaywrightHookedPage[] = [];
    const onPage: ((page: MuirSirynPlaywrightHookedPage) => void)[] = [];
    const scripts: [unknown, MuirSirynPlaywrightPageSettings | undefined][] =
      [];
    const events: string[] = [];
    const routes: Parameters<MuirSirynPlaywrightHookedContext['route']>[] = [];
    const created: MuirSirynPlaywrightHookedContext = {
      pages: () => pages,
      browser: () => owner?.browser ?? null,
      on: (event, handler) => {
        events.push(event);
        onPage.push(handler);
      },
      addInitScript: async (script, settings) => {
        scripts.push([script, settings]);
      },
      route: async (url, handler) => {
        routes.push([url, handler]);
      },
    };
    owner?.contexts.push(created);
    await hooks.runAfterCreateBrowserContext?.(created);

    return {
      context: created,
      scripts,
      events,
      routes,
      open: (opened: MuirSirynPlaywrightHookedPage) => {
        pages.push(opened);
        onPage.forEach((handler) => handler(opened));
      },
      close: () => hooks.runBeforeCloseBrowserContext?.(created),
    };
  }

  return {
    ns,
    namespace: (): MuirSirynPlaywrightStrykerNamespace => {
      const found = scope[ns];
      assert.ok(typeof found === 'object' && found !== null, 'a namespace');

      return found;
    },
    hooks,
    files: () => readdirSync(outDir),
    read,
    lines: () => parsedLines(read()),
    /** `runs` is what Playwright's timeout manager runs for that test: its body by default. */
    setTest: (id: string | undefined, runs: Runnable = { type: 'test' }) => {
      running = id;
      runnable = runs;
    },
    exitListeners: added,
    frame,
    page,
    browser,
    context,
  };
}

function parsedLines(content: string) {
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parsed: unknown = JSON.parse(line);
      assert.ok(muirSirynPlaywrightIsRecord(parsed));

      return parsed;
    });
}
