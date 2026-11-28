import type { LoadHookSync, ResolveHookSync } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { InstrumenterContext, Position } from '@stryker-mutator/api/core';

import {
  muirSirynNodeTestAfterHookId,
  muirSirynNodeTestEnvNames,
  muirSirynNodeTestHeldOpenMs,
  muirSirynNodeTestMemoryRecordName,
  muirSirynNodeTestRecordName,
  muirSirynNodeTestUniqueIds,
  type MuirSirynNodeTestProcessRecord,
  type MuirSirynNodeTestRecordedTest,
} from './record.ts';
import { muirSirynNodeTestTestOnly } from './node-options.ts';
import { muirSirynNodeTestGroupOptions } from './process-end.ts';
import {
  muirSirynNodeTestPersistRecord,
  type MuirSirynNodeTestRecordDependencies,
} from './record-writer.ts';
import type { MuirSirynNodeTestWatchdogData } from './watchdog.ts';
import {
  muirSirynNodeTestCurrentTests,
  muirSirynNodeTestSettling,
  muirSirynNodeTestWrapNodeTest,
  type MuirSirynNodeTestBody,
  type MuirSirynNodeTestModule,
  type MuirSirynNodeTestTarget,
} from './wrap.ts';

export interface MuirSirynNodeTestTestEvent {
  readonly type: string;
  readonly data: {
    readonly name: string;
    readonly nesting: number;
    readonly skip?: unknown;
    readonly todo?: unknown;
    /** Present on `test:diagnostic`. */
    readonly message?: string;
    /** Present on `test:pass` and `test:fail`. */
    readonly details?: {
      /** Absent when the test file itself fails. */
      readonly type?: 'suite' | 'test';
      readonly duration_ms: number;
      readonly error?: {
        readonly failureType?: string;
        readonly message: string;
        readonly cause?: unknown;
      };
    };
  };
}

const isResult = (type: string): boolean =>
  type === 'test:pass' || type === 'test:fail';

/** node:test reports a failing `after` hook of the test file as a failure of the file itself, which has no type. */
const fileLevel = (
  details: MuirSirynNodeTestTestEvent['data']['details'],
): boolean => details?.type === undefined;

/** The global object's slots, which the hook sets for the modules it loads and for Stryker's instrumented code. */
export interface MuirSirynNodeTestGlobalSlots {
  /** The one member every global object has, so that `globalThis` is assignable to this type. */
  readonly globalThis: unknown;
  readonly __stryker__?: InstrumenterContext;
  readonly [muirSirynNodeTestInstalled]?: true;
  readonly [muirSirynNodeTestReporting]?: (
    event: MuirSirynNodeTestTestEvent,
  ) => void;
  readonly [muirSirynNodeTestWrappedNodeTest]?: MuirSirynNodeTestModule;
  readonly [muirSirynNodeTestWatchdog]?: unknown;
}

/** What the hook takes from the process, and the global object whose slots it sets. */
export interface MuirSirynNodeTestHookDependencies
  extends MuirSirynNodeTestRecordDependencies {
  readonly env: Record<string, string | undefined>;
  /** `process.execArgv`, node's options outside NODE_OPTIONS. */
  readonly execArgv: readonly string[];
  readonly mainFile: string | undefined;
  readonly pid: number;
  /** `muirSirynNodeTestRecordNonce()` once per process or thread. */
  readonly nonce: string;
  /** Worker threads load the hook too; 0 is the main thread. */
  readonly threadId: number;
  readonly nodeTest: () => MuirSirynNodeTestTarget;
  readonly registerHooks: (hooks: MuirSirynNodeTestModuleHooks) => unknown;
  /** Ends the process as `process.exit` does, with `process.exitCode` when no code is given. */
  readonly exit: (code?: number) => void;
  /** `process.getActiveResourcesInfo`. */
  readonly activeResources: () => readonly string[];
  /** Calls `callback` after `ms` without keeping the process alive. */
  readonly later: (callback: () => void, ms: number) => void;
  /** Under the permission model without write access, the process runs as it would outside Stryker, with no record. */
  readonly canWriteRecords: boolean;
  /** The process's peak resident set in KiB, as `process.resourceUsage().maxRSS` gives it. */
  readonly maxRssKiB: () => number;
  /** The main thread only, as a test's worker threads load the hook too, and only where the permission model allows. */
  readonly canWatchMemory: boolean;
  /**
   * A worker thread, as the watchdog must work while a test blocks the process: Node.js's assertion diff can fill
   * gigabytes in one synchronous call.
   */
  readonly watchMemory: (options: {
    readonly workerData: MuirSirynNodeTestWatchdogData;
    readonly execArgv: readonly string[];
    readonly env: Record<string, string>;
  }) => unknown;
  /** The function calls on the stack, innermost first, as `util.getCallSites` gives them. */
  readonly callSites: (
    frameCount: number,
    options: { readonly sourceMap: boolean },
  ) => readonly {
    readonly scriptName: string;
    readonly lineNumber: number;
    readonly columnNumber: number;
  }[];
  readonly global: {
    -readonly [TKey in keyof MuirSirynNodeTestGlobalSlots]: MuirSirynNodeTestGlobalSlots[TKey];
  };
  /** The clock of every `MuirSirynNodeTestTimeWindow`. */
  readonly now: () => number;
  /** `process.ppid`, read anew on each call. */
  readonly parentPid: () => number;
  readonly kill: (pid: number, signal: NodeJS.Signals) => void;
}

/** How often a test file's process asks whether its parent, the runner's process, is still there. */
// Stryker disable next-line MuirProteusJsNumericLiteral: a tuning value, not a contract a test should pin
const parentPollMs = 1_000;

/**
 * How many calls of the stack the hook reads to find where the test file declares a suite or test. getCallSites reads
 * 10 by default, fewer than a declaration through a few helpers takes.
 */
const callSiteFrames = 64;

export const muirSirynNodeTestInstalled = Symbol.for('siryn-node-test.hook');

export const muirSirynNodeTestReporting = Symbol.for(
  'siryn-node-test.reporting',
);

export const muirSirynNodeTestWrappedNodeTest = Symbol.for(
  'siryn-node-test.node-test',
);

export const muirSirynNodeTestWatchdog = Symbol.for('siryn-node-test.watchdog');

export function muirSirynNodeTestWritesAllowed(
  permission: { has(scope: string, reference?: string): boolean } | undefined,
  dir: string | undefined,
): boolean {
  return permission?.has('fs.write', dir) !== false;
}

function parseFilter(json: string): Set<string> {
  const ids: unknown = JSON.parse(json);

  if (
    !Array.isArray(ids) ||
    !ids.every((id): id is string => typeof id === 'string')
  ) {
    throw new Error(
      `${muirSirynNodeTestEnvNames.filter} is no JSON array of test ids: ${json}`,
    );
  }

  return new Set(ids);
}

/** The pid in `value`, or undefined when it holds none. */
function parsePid(value: string | undefined): number | undefined {
  const pid = Number(value);

  return pid > 0 ? pid : undefined;
}

export function muirSirynNodeTestInstall(
  deps: MuirSirynNodeTestHookDependencies,
): boolean {
  const outDir = deps.env[muirSirynNodeTestEnvNames.out];

  if (!outDir || deps.global[muirSirynNodeTestInstalled]) {
    return false;
  }

  deps.global[muirSirynNodeTestInstalled] = true;
  const started = deps.now();
  const ns = (deps.global.__stryker__ ??= {});
  const hitLimit = Number(deps.env[muirSirynNodeTestEnvNames.hitLimit]);

  if (hitLimit > 0) {
    ns.hitLimit = hitLimit;
    ns.hitCount = 0;
  }

  const memoryLimit = Number(deps.env[muirSirynNodeTestEnvNames.memoryLimit]);

  if (memoryLimit > 0 && deps.canWatchMemory) {
    const { NODE_COMPILE_CACHE: compileCache } = deps.env;
    deps.global[muirSirynNodeTestWatchdog] = deps.watchMemory({
      workerData: {
        limitMB: memoryLimit,
        recordPath: join(
          outDir,
          muirSirynNodeTestMemoryRecordName(deps.pid, deps.nonce),
        ),
      },
      // Without the process's options, such as --require ts-node/register, which would load in the thread again, and
      // without its environment, whose NODE_OPTIONS Node.js would read for the thread: its --require preloads would
      // run there too, and --input-type=module would make the thread an ES module, which also loads the --import
      // preloads, the hook among them. Only the compile cache comes along, so the thread compiles watchdog.ts once.
      execArgv: [],
      env:
        compileCache === undefined ? {} : { NODE_COMPILE_CACHE: compileCache },
    });
  }

  // An empty id is no test, as in wrap.ts, where the reason not to delete the property is.
  ns.currentTestId = deps.env[muirSirynNodeTestEnvNames.current] ?? '';

  // Preloads that run before the hook, as --require ones do, file their hits as static, though the test that started
  // this process caused them. The instrumented code keeps the coverage object, so its hits move within it.
  if (ns.currentTestId && ns.mutantCoverage) {
    const { static: early, perTest } = ns.mutantCoverage;
    const ofTest = (perTest[ns.currentTestId] ??= {});

    for (const [mutantId, hits] of Object.entries(early)) {
      ofTest[mutantId] = (ofTest[mutantId] ?? 0) + hits;
      Reflect.deleteProperty(early, mutantId);
    }
  }

  const bail = deps.env[muirSirynNodeTestEnvNames.bail] === 'true';
  const dryRun = deps.env[muirSirynNodeTestEnvNames.dryRun] === 'true';
  const stallMs = Number(deps.env[muirSirynNodeTestEnvNames.stall]);
  Reflect.deleteProperty(deps.env, muirSirynNodeTestEnvNames.bail);
  Reflect.deleteProperty(deps.env, muirSirynNodeTestEnvNames.stall);
  const testFile = deps.env[muirSirynNodeTestEnvNames.file];
  Reflect.deleteProperty(deps.env, muirSirynNodeTestEnvNames.file);
  const runnerPid = parsePid(deps.env[muirSirynNodeTestEnvNames.runner]);
  Reflect.deleteProperty(deps.env, muirSirynNodeTestEnvNames.runner);
  const tests: MuirSirynNodeTestRecordedTest[] = [];
  const currentTests = muirSirynNodeTestCurrentTests({
    ns,
    env: deps.env,
    now: deps.now,
  });
  const diagnostics: string[] = [];
  const main =
    testFile !== undefined && deps.threadId === 0 && deps.mainFile === testFile;
  let end: Ending | undefined;

  if (main) {
    const positions = new Map<string, Position>();
    const nodeTest = deps.nodeTest();
    const ends = muirSirynNodeTestEnding(
      deps,
      tests,
      (hook) => {
        Reflect.apply(nodeTest.after, nodeTest, [hook]);
      },
      Number(deps.env[muirSirynNodeTestEnvNames.heldOpen]) ||
        muirSirynNodeTestHeldOpenMs,
      stallMs,
    );
    end = ends;
    // A call site names its file by URL in an ES module and by path otherwise.
    const callSites = (sourceMap: boolean) =>
      deps
        .callSites(callSiteFrames, { sourceMap })
        .map(({ scriptName, lineNumber, columnNumber }) => ({
          file: scriptName.startsWith('file:')
            ? fileURLToPath(scriptName)
            : scriptName,
          line: lineNumber,
          column: columnNumber,
        }));
    const recordEvent = muirSirynNodeTestRecordEvents(
      testFile,
      tests,
      positions,
      diagnostics,
    );
    deps.global[muirSirynNodeTestReporting] = (event) => {
      recordEvent(event);
      ends.reported(event);
    };
    const filterJson = deps.env[muirSirynNodeTestEnvNames.filter];
    const filter = filterJson ? parseFilter(filterJson) : undefined;
    const wrapped = muirSirynNodeTestWrapNodeTest({
      ns,
      testFile,
      tests,
      filter,
      bail,
      testOnly: muirSirynNodeTestTestOnly(
        deps.execArgv,
        deps.env['NODE_OPTIONS'],
      ),
      activeMutant: deps.env[muirSirynNodeTestEnvNames.activeMutant],
      env: deps.env,
      positions,
      // A source map can point at another file, such as `src/` for a test in `dist/`; the test file's own position
      // is better than none.
      callSites: () => {
        const mapped = callSites(true);

        return mapped.some(({ file }) => file === testFile)
          ? mapped
          : callSites(false);
      },
      nodeTest,
      registering: ends.registering,
      rootAfter: ends.track,
      currentTests,
    });
    deps.global[muirSirynNodeTestWrappedNodeTest] = wrapped;
    deps.registerHooks(muirSirynNodeTestRedirectNodeTest(Object.keys(wrapped)));

    // The group of its own gets no Ctrl+C, and nothing ends it when Stryker ends the runner's process, which leaves a
    // test that never settles running in a removed sandbox.
    if (
      muirSirynNodeTestGroupOptions(deps.platform).detached &&
      runnerPid !== undefined
    ) {
      deps.every(() => {
        if (deps.parentPid() !== runnerPid) {
          deps.kill(-deps.pid, 'SIGKILL');
        }
      }, parentPollMs);
    }
  }

  if (!deps.canWriteRecords) {
    return true;
  }

  const record = (natural: boolean): MuirSirynNodeTestProcessRecord => {
    const outcome = end?.outcome();
    const written = deps.now();

    return {
      ...(main && { main }),
      tests,
      hitCount: ns.hitCount,
      mutantCoverage: dryRun ? ns.mutantCoverage : undefined,
      peakMemoryMB: dryRun ? Math.round(deps.maxRssKiB() / 1024) : undefined,
      ...(diagnostics.length > 0 && { diagnostics }),
      ...(main &&
        !outcome?.summarized &&
        !natural &&
        !outcome?.complete && { unfinished: true }),
      ...outcome?.why,
      lifetime: { start: started, end: written },
      ...(main && { testSpans: currentTests.spansAt(written) }),
    };
  };
  muirSirynNodeTestPersistRecord(
    deps,
    join(
      outDir,
      muirSirynNodeTestRecordName(deps.pid, deps.threadId, deps.nonce),
    ),
    record,
    { main, dryRun },
  );

  return true;
}

interface Ending {
  /**
   * The test file registers a suite, test or hook through node:test. The first registration also registers a root
   * `after` hook of the ending's own, ahead of the file's.
   */
  readonly registering: () => void;
  /** Makes the ending wait for a root `after` hook of the test file to settle. */
  readonly track: (hook: MuirSirynNodeTestBody) => MuirSirynNodeTestBody;
  /** node:test has reported another event. */
  readonly reported: (event: MuirSirynNodeTestTestEvent) => void;
  /**
   * Whether node:test has reported its summary. Whether it had reported every top-level suite and test when the hook
   * ended the process, and why the hook ended it.
   */
  readonly outcome: () => MuirSirynNodeTestEnded & {
    readonly summarized: boolean;
  };
}

interface MuirSirynNodeTestEnded {
  readonly complete: boolean;
  readonly why: Pick<MuirSirynNodeTestProcessRecord, 'heldOpen' | 'stalledMs'>;
}

/**
 * Ends a test file's process that outlives its tests, as a server left listening makes it. Once node:test has
 * finished every top-level suite and test and the file's root `after` hooks have settled, or one of them threw or timed
 * out, which stops the rest, a file with a failed test ends with exit code 1 once node:test has reported each top-level
 * suite and test it enqueued, as nothing later changes its outcome. node:test enqueues each one as it is registered,
 * before reporting it, and never enqueues nor reports one its filters leave out. A file still alive `graceMs` later
 * ends with node:test's exit code.
 *
 * node:test runs root `after` hooks in the order they were added, once every top-level suite and test has finished.
 * The ending adds its own at the file's first registration, not earlier: node:test sets itself up on its first use, and
 * an error thrown before that, while the file loads, must stay an ordinary uncaught exception.
 *
 * Node.js 24 keeps the process alive while a test is pending, even once its event loop is empty, where Node.js 22
 * cancels the test. With a `stallMs`, a file whose event loop empties before node:test's summary ends with exit code 1
 * when no test result follows within `stallMs`.
 */
export function muirSirynNodeTestEnding(
  deps: Pick<
    MuirSirynNodeTestHookDependencies,
    'exit' | 'activeResources' | 'later' | 'onBeforeExit'
  >,
  tests: MuirSirynNodeTestRecordedTest[],
  rootAfter: (hook: () => void) => void,
  graceMs: number,
  stallMs: number,
): Ending {
  let enqueuedTopLevel = 0;
  // Stryker disable next-line MuirProteusJsNumericLiteral: equivalent, as the count is only compared with an earlier read of itself
  let results = 0;
  let summarized = false;
  let reportedTopLevel = 0;
  let hooked = false;
  let finished = false;
  let pending = 0;
  let threw = false;
  let armed = false;
  let ended: MuirSirynNodeTestEnded = { complete: false, why: {} };
  const before = deps.activeResources();
  // What the tests opened, not what the process had before they ran, such as the stdio pipes that loading node:test
  // opens.
  const opened = () => {
    const resources = [...deps.activeResources()];

    for (const resource of before) {
      const index = resources.indexOf(resource);

      if (index !== -1) {
        resources.splice(index, 1);
      }
    }

    return resources;
  };
  // node:test reports a test a little after it ends, so a failure can arrive after the hooks have settled. It reports a
  // suite after everything inside it, so once each enqueued top-level one is reported, everything is.
  const allReported = () => reportedTopLevel >= enqueuedTopLevel;
  const end = (
    code: number | undefined,
    why: MuirSirynNodeTestEnded['why'] = {},
  ) => {
    ended = { complete: allReported(), why };
    deps.exit(code);
  };
  const check = () => {
    if (
      armed &&
      allReported() &&
      tests.some((test) => test.status === 'failed')
    ) {
      end(1);
    }
  };
  // An `after` hook added inside another hook counts as a root one but runs when that hook ends, before the ending's own
  // root `after` hook says that node:test has finished the tests.
  const armOnceSettled = () => {
    if (!finished || armed || (pending > 0 && !threw)) {
      return;
    }

    armed = true;
    deps.later(() => {
      end(undefined, { heldOpen: opened() });
    }, graceMs);
    check();
  };
  const settle = (failed: boolean) => {
    pending--;
    threw ||= failed;
    armOnceSettled();
  };

  // setTimeout fires at once for a delay it cannot hold.
  if (Number.isInteger(stallMs) && stallMs > 0 && stallMs <= 2 ** 31 - 1) {
    deps.onBeforeExit(() => {
      const since = results;
      deps.later(() => {
        if (results === since && !summarized) {
          end(1, { stalledMs: stallMs });
        }
      }, stallMs);
    });
  }

  return {
    registering: () => {
      if (!hooked) {
        hooked = true;
        rootAfter(() => {
          finished = true;
          armOnceSettled();
        });
      }
    },
    track: (hook) => {
      pending++;

      return muirSirynNodeTestSettling(hook, () => ({
        kind: 'settle',
        settle,
      }));
    },
    reported: ({ type, data }) => {
      if (type === 'test:enqueue' && data.nesting === 0) {
        enqueuedTopLevel++;
      }

      summarized ||= type === 'test:summary';

      if (isResult(type)) {
        // Stryker disable next-line UpdateOperator: equivalent, as the stall check only asks whether the count changed
        results++;

        if (data.nesting === 0 && !fileLevel(data.details)) {
          reportedTopLevel++;
        }
      }

      // Also a root `after` hook that node:test ended by its timeout, whose function never settles; node:test runs none
      // after it.
      if (
        finished &&
        type === 'test:fail' &&
        data.nesting === 0 &&
        fileLevel(data.details)
      ) {
        threw = true;
        armOnceSettled();
      }

      check();
    },
    outcome: () => ({ ...ended, summarized }),
  };
}

/**
 * What node:test's diagnostic of an error raised after its test ended says. node:test reports it when such an error
 * reaches its `uncaughtException` or `unhandledRejection` handler (`createProcessEventHandler` in
 * `lib/internal/test_runner/harness.js`).
 */
const lateActivity = 'generated asynchronous activity after the test ended';

/** node:test reports an error raised after its test ended only as a diagnostic, which is kept in `diagnostics`. */
export function muirSirynNodeTestRecordEvents(
  testFile: string,
  tests: MuirSirynNodeTestRecordedTest[],
  positions: Map<string, Position>,
  diagnostics: string[],
): (event: MuirSirynNodeTestTestEvent) => void {
  const ids = new Map<number, string>();
  const idOf = muirSirynNodeTestUniqueIds();

  return ({ type, data }) => {
    if (type === 'test:start') {
      ids.set(
        data.nesting,
        idOf(ids.get(data.nesting - 1) ?? testFile, data.name),
      );

      return;
    }

    if (type === 'test:diagnostic' && data.message?.includes(lateActivity)) {
      diagnostics.push(data.message);
    }

    if (!isResult(type) || data.details === undefined) {
      return;
    }

    const { type: kind, duration_ms: timeSpentMs, error } = data.details;

    // node:test never runs a skipped suite's body, so the suite stands for the tests it declares.
    if (
      kind === 'suite' &&
      data.skip === undefined &&
      (type === 'test:pass' || error?.failureType === 'subtestsFailed')
    ) {
      return;
    }

    const fileHook = fileLevel(data.details);
    const id = fileHook
      ? muirSirynNodeTestAfterHookId(testFile)
      : ids.get(data.nesting);

    // node:test starts every test it reports; an event outside that order has no test to record.
    if (id === undefined) {
      return;
    }

    const startPosition = positions.get(id);
    const base = { id, timeSpentMs, ...(startPosition && { startPosition }) };
    // node:test runs a todo test but ignores its outcome.
    const skipped = data.skip !== undefined || data.todo !== undefined;

    if (skipped || !error) {
      tests.push({ ...base, status: skipped ? 'skipped' : 'passed' });

      return;
    }

    // The cause is what the test or hook threw; a timeout, a cancellation or an unmet expectFailure has a message only.
    tests.push({
      ...base,
      status: 'failed',
      failureMessage:
        error.cause instanceof Error ? error.cause.message : error.message,
    });
  };
}

export interface MuirSirynNodeTestModuleHooks {
  readonly resolve: ResolveHookSync;
  readonly load: LoadHookSync;
}

const wrappedUrl = 'muir-siryn-node-test:node-test/';

/**
 * Module hooks that make `import 'node:test'` and `require('node:test')` give the wrapped module on
 * `globalThis[wrappedNodeTest]`, with these named exports. The default export, and what `require` returns, is
 * node:test's `test` function itself, so the built-in module cannot be wrapped in place.
 */
export function muirSirynNodeTestRedirectNodeTest(
  names: string[],
): MuirSirynNodeTestModuleHooks {
  const wrapped = `globalThis[Symbol.for(${JSON.stringify(muirSirynNodeTestWrappedNodeTest.description)})]`;
  const sources = {
    module: `const wrapped = ${wrapped}; export default wrapped; export const { ${names.join(', ')} } = wrapped;`,
    commonjs: `module.exports = ${wrapped};`,
  };

  return {
    resolve: (specifier, context, nextResolve) => {
      if (specifier !== 'node:test') {
        return nextResolve(specifier, context);
      }

      const format = context.conditions.includes('require')
        ? 'commonjs'
        : 'module';

      return { url: `${wrappedUrl}${format}`, format, shortCircuit: true };
    },
    load: (url, context, nextLoad) => {
      if (!url.startsWith(wrappedUrl)) {
        return nextLoad(url, context);
      }

      const format = url === `${wrappedUrl}commonjs` ? 'commonjs' : 'module';

      return { format, source: sources[format], shortCircuit: true };
    },
  };
}
