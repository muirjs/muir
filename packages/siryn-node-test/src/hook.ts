import { registerHooks } from 'node:module';
import { extname, resolve } from 'node:path';
import { getCallSites, inspect } from 'node:util';
import { isMainThread, threadId, Worker } from 'node:worker_threads';

import {
  muirSirynNodeTestInstall,
  muirSirynNodeTestWritesAllowed,
  type MuirSirynNodeTestHookDependencies,
} from './hook-core.ts';
import {
  muirSirynNodeTestEnvNames,
  muirSirynNodeTestRecordNonce,
  muirSirynNodeTestWriteRecord,
} from './record.ts';
import { muirSirynNodeTestWorkersAllowed } from './watchdog.ts';

// The memory watchdog's thread runs this script, where Stryker sees no coverage, so it only starts watchdog.ts's watch,
// whose code this process's tests reach.
const watchdog = `Promise.all([
  import('node:worker_threads'),
  import(${JSON.stringify(new URL(`./watchdog${extname(import.meta.filename)}`, import.meta.url).href)}),
]).then(([{ workerData }, { muirSirynNodeTestWatch }]) => muirSirynNodeTestWatch(workerData));`;

// Exported so the tests can call them in their own process: those of the test files they start report no coverage.
// process.exit(undefined) sets the exit code to undefined, so it would exit with 0.
export const muirSirynNodeTestExit: MuirSirynNodeTestHookDependencies['exit'] =
  (code) =>
    // eslint-disable-next-line n/no-process-exit -- the hook ends a test file's process once its tests are done, though something may hold it open
    process.exit(code ?? process.exitCode);

export const muirSirynNodeTestActiveResources: MuirSirynNodeTestHookDependencies['activeResources'] =
  () => process.getActiveResourcesInfo();

export const muirSirynNodeTestLater: MuirSirynNodeTestHookDependencies['later'] =
  (callback, ms) => {
    setTimeout(callback, ms).unref();
  };

export const muirSirynNodeTestEvery: MuirSirynNodeTestHookDependencies['every'] =
  (callback, ms) => {
    setInterval(callback, ms).unref();
  };

export function muirSirynNodeTestSignals(
  platform: NodeJS.Platform,
): MuirSirynNodeTestHookDependencies['signals'] {
  return platform === 'win32'
    ? undefined
    : {
        on: (signal, listener) => process.on(signal, listener),
        off: (signal, listener) => process.off(signal, listener),
        listenerCount: (signal) => process.listenerCount(signal),
        signalExitEmitters: () => {
          const version4: unknown = Reflect.get(
            globalThis,
            Symbol.for('signal-exit emitter'),
          );
          const version3: unknown = Reflect.get(
            process,
            '__signal_exit_emitter__',
          );

          return [version4, version3];
        },
        raise: (signal) => process.kill(process.pid, signal),
      };
}

// Found once, so that a test that fakes process.hrtime, as fake timers do, leaves the clock of every span alone.
const hrtime = process.hrtime.bigint.bind(process.hrtime);

export const muirSirynNodeTestNow: MuirSirynNodeTestHookDependencies['now'] =
  () => Number(hrtime()) / 1e6;

muirSirynNodeTestInstall({
  env: process.env,
  execArgv: process.execArgv,
  mainFile: process.argv[1] ? resolve(process.argv[1]) : undefined,
  pid: process.pid,
  nonce: muirSirynNodeTestRecordNonce(),
  threadId,
  global: globalThis,
  nodeTest: () => process.getBuiltinModule('node:test'),
  registerHooks,
  onExit: (listener) => process.on('exit', listener),
  offExit: (listener) => process.off('exit', listener),
  onBeforeExit: (listener) => process.on('beforeExit', listener),
  writeRecord: muirSirynNodeTestWriteRecord,
  every: muirSirynNodeTestEvery,
  exit: muirSirynNodeTestExit,
  activeResources: muirSirynNodeTestActiveResources,
  later: muirSirynNodeTestLater,
  canWriteRecords: muirSirynNodeTestWritesAllowed(
    process.permission,
    process.env[muirSirynNodeTestEnvNames.out],
  ),
  maxRssKiB: () => process.resourceUsage().maxRSS,
  canWatchMemory:
    isMainThread && muirSirynNodeTestWorkersAllowed(process.permission),
  watchMemory: (options) => {
    const worker = new Worker(watchdog, {
      eval: true,
      ...options,
      // Stryker disable next-line ArrayDeclaration: equivalent, as hook-core always passes execArgv: []
      execArgv: [...options.execArgv],
    });
    // Listening keeps a watchdog error from ending the process; the line reaches the runner's stderr tail.
    worker.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : inspect(error);
      process.stderr.write(
        `muir-siryn-node-test: the memory watchdog failed, so no memory limit guards this process: ${message}\n`,
      );
    });
    worker.unref();

    return worker;
  },
  callSites: getCallSites,
  now: muirSirynNodeTestNow,
  signals: muirSirynNodeTestSignals(process.platform),
  platform: process.platform,
  parentPid: () => process.ppid,
  // Stryker disable next-line ArrowFunction: POSIX only, as Windows has no process groups to end; the Linux run kills it
  kill: (pid, signal) => process.kill(pid, signal),
});
