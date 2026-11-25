// The memory watchdog: a worker thread that ends its process once the process holds more memory than its limit. It
// guards mutant runs, and a dry run under muirSirynNodeTest.maxMemoryMB, against Node.js's assertion diff, which grows with the
// square of the lines it compares (nodejs/node#62792). node-assert-diff.test.ts fails once a Node.js release fixes it.
import {
  muirSirynNodeTestWriteRecord,
  type MuirSirynNodeTestProcessRecord,
} from './record.ts';

export function muirSirynNodeTestWorkersAllowed(
  permission: { has(scope: string): boolean } | undefined,
): boolean {
  return permission?.has('worker') !== false;
}

export interface MuirSirynNodeTestWatchdogData {
  readonly limitMB: number;
  readonly recordPath: string;
}

/**
 * From a worker, process.exit and process.abort do not end a process whose main thread is blocked, and a signal does.
 */
export function muirSirynNodeTestCheckMemory(
  { limitMB, recordPath }: MuirSirynNodeTestWatchdogData,
  rssBytes: number,
  write: (
    path: string,
    record: MuirSirynNodeTestProcessRecord,
  ) => void = muirSirynNodeTestWriteRecord,
  kill: (pid: number, signal: NodeJS.Signals) => void = (pid, signal) =>
    process.kill(pid, signal),
): void {
  const rssMB = Math.round(rssBytes / 1048576);

  if (rssMB > limitMB) {
    const record = {
      tests: [],
      memoryLimitReached: { rssMB, limitMB },
    } satisfies MuirSirynNodeTestProcessRecord;

    try {
      write(recordPath, record);
    } finally {
      kill(process.pid, 'SIGKILL');
    }
  }
}

export function muirSirynNodeTestWatch(
  data: MuirSirynNodeTestWatchdogData,
  rss: () => number = () => process.memoryUsage.rss(),
): void {
  setInterval(() => {
    muirSirynNodeTestCheckMemory(data, rss());
  }, 50);
}
