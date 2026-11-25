import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import timers from 'node:timers/promises';

import { muirExec } from '../exec.ts';
import {
  muirInstallPacked,
  muirPack,
  muirRemoveDeadRunDirs,
  muirRemoveOnExit,
  muirReportFile,
  muirStryker,
  type MuirStrykerRun,
} from '../fixture.ts';
import {
  muirCheckpointArgs,
  muirCheckpointKey,
  muirCheckpointReporterName,
  muirEndCheckpoint,
  muirInstalledVersions,
  muirStartCheckpoint,
} from './checkpoint.ts';
import {
  muirOssPreparedPrefix,
  muirOssRunPrefix,
  muirSides,
  muirStrykerArgs,
  muirStrykerConfig,
  type MuirOssOptions,
  type MuirSide,
} from './options.ts';
import { muirApplyPatches, muirFileWriters } from './prepare.ts';
import {
  muirDescendants,
  muirLeftovers,
  muirNewEntries,
  muirPeaks,
} from './processes.ts';
import type {
  MuirOssHeader,
  MuirOssResult,
  MuirSideResult,
  MuirStrykerResult,
} from './result.ts';
import { muirSnapshot, muirStartSampler } from './sampler.ts';
import {
  muirBySide,
  muirComparison,
  muirMessageOf,
  muirReportScore,
  type MuirSideReport,
} from './verdicts.ts';

type MuirSettled<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false };

interface MuirSideRun {
  readonly side: MuirSide;
  readonly report: MuirSideReport;
  readonly result: MuirSideResult;
}

/** How long processes that a run left get to end by themselves before they count as left behind. */
// Stryker disable next-line MuirProteusJsNumericLiteral: a tuning value, not a contract a test should pin
const settleMs = 2_000;

/** The steps that pack, install, run Stryker and watch processes, which a test replaces. */
export interface MuirRunSteps {
  readonly pack: typeof muirPack;
  readonly install: typeof muirInstallPacked;
  readonly stryker: typeof muirStryker;
  readonly startSampler: typeof muirStartSampler;
  readonly snapshot: typeof muirSnapshot;
}

export const muirRunSteps: MuirRunSteps = {
  pack: muirPack,
  install: muirInstallPacked,
  stryker: muirStryker,
  startSampler: muirStartSampler,
  snapshot: muirSnapshot,
};

/** What one side's run needs: the options, `out`, `dir` for the project's copy and `runTmp` for Stryker's TMP. */
interface MuirRunContext {
  readonly options: MuirOssOptions;
  readonly steps: MuirRunSteps;
  readonly out: string;
  readonly dir: string;
  readonly runTmp: string;
}

export async function muirRunDriver(
  options: MuirOssOptions,
  steps = muirRunSteps,
): Promise<void> {
  const out = resolve(options.out);

  mkdirSync(out, { recursive: true });
  muirClearResult(out);
  muirRemoveDeadRunDirs(tmpdir(), muirOssRunPrefix);
  const root = realpathSync.native(
    mkdtempSync(
      join(
        tmpdir(),
        `${options.prepareOnly ? muirOssPreparedPrefix : muirOssRunPrefix}${process.pid}-`,
      ),
    ),
  );
  // Beside the copy, not in it, so that no folder of the project can collide with them.
  const context: MuirRunContext = {
    options,
    steps,
    out,
    dir: join(root, 'project'),
    runTmp: join(root, 'tmp'),
  };
  const { dir, runTmp } = context;

  if (!options.prepareOnly) {
    muirRemoveOnExit(root);
  }

  const copied = new Set(['.git', 'node_modules']);

  // Verbatim, as a relative link rewritten to an absolute one would let a write in the copy reach the source.
  cpSync(options.source, dir, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (path) => !copied.has(relative(options.source, path)),
  });
  const { patches, testFiles } = options.project;

  muirApplyPatches(dir, patches);
  muirFileWriters(
    dir,
    testFiles,
    patches.map(({ file }) => file),
  ).forEach((calls, file) => {
    process.stdout.write(
      `${file} writes files (${calls.join(', ')}); a fixed path there would collide across Stryker workers.\n`,
    );
  });
  mkdirSync(runTmp);
  const tarballs =
    options.tarballs === undefined
      ? await steps.pack(join(root, 'tarballs'))
      : given(options.tarballs);

  await steps.install(dir, tarballs, options.npmBefore);
  muirSides.forEach((side) => {
    writeFileSync(
      join(dir, configFile(side)),
      muirStrykerConfig(side, options.project),
    );
  });

  const header: MuirOssHeader = {
    project: options.project.name,
    source: options.source,
    sourceCommit: await commitOf(options.source),
    // Any folder in the workspace gives its commit.
    workspaceCommit: await commitOf(import.meta.dirname),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    concurrency: options.concurrency,
    timeLimitMinutes: options.timeLimitMinutes,
    mutantTimeoutMs: options.mutantTimeoutMs ?? null,
    installedVersions: muirInstalledVersions(
      readFileSync(join(dir, 'node_modules', '.package-lock.json'), 'utf8'),
    ),
    tarballDigests: tarballs
      .map((tarball) => sha256(readFileSync(tarball)))
      .sort(),
    projectSetup: { mutate: options.project.mutate, testFiles, patches },
    mutate: options.mutate,
    tarballs: tarballs.map((tarball) => basename(tarball)),
    npmBefore: options.npmBefore,
    startedAt: new Date().toISOString(),
  };

  if (options.prepareOnly) {
    writeResult(out, { ...header, preparedIn: dir });
    process.stdout.write(
      `Prepared ${dir}, with ${runTmp} for TMP; both stay for manual runs.\n`,
    );

    return;
  }

  const checkpointKey = (side: MuirSide): string =>
    muirCheckpointKey({
      ...header,
      strykerConfig: muirStrykerConfig(side, options.project),
    });
  // One side after the other, so that the two never share the machine.
  const runs = await options.sides.reduce<Promise<readonly MuirSideRun[]>>(
    async (earlier, side) => [
      ...(await earlier),
      await runSide(side, context, checkpointKey(side)),
    ],
    Promise.resolve([]),
  );

  writeResult(out, {
    ...header,
    sides: muirBySide(runs, ({ result }) => result),
    ...muirComparison(muirBySide(runs, ({ report }) => report)),
  });
}

/** A run that dies before it writes result.json must leave none, not the previous run's beside this run's side files. */
export function muirClearResult(out: string): void {
  rmSync(join(out, 'result.json'), { force: true });
}

/** An earlier run's report or log left in `out` must not pass for this run's. */
export function muirClearSideFiles(out: string, side: MuirSide): void {
  [`${side}.mutation.json`, `${side}.log`].forEach((name) => {
    rmSync(join(out, name), { force: true });
  });
}

/**
 * Each step is settled, so a throw in one still stops the sampler, ends leftovers, lets result.json be written and
 * lets the next side run.
 */
async function runSide(
  side: MuirSide,
  { options, steps, out, dir, runTmp }: MuirRunContext,
  checkpointKey: string,
): Promise<MuirSideRun> {
  const errors: string[] = [];
  const settled = settledInto(errors);
  const checkpoint = join(out, `${side}.checkpoint.json`);

  await settled("Removing an earlier run's report and log", () => {
    muirClearSideFiles(out, side);
  });
  // A checkpoint that cannot be read, such as one Stryker's own final write left cut short, would fail every rerun:
  // it goes, and the run starts a new one.
  const firstStart = await settled('Checkpoint', () =>
    muirStartCheckpoint(checkpoint, checkpointKey),
  );
  const resumed = firstStart.ok
    ? firstStart
    : await settled('Checkpoint after removing the unreadable one', () => {
        muirEndCheckpoint(checkpoint);
        process.stdout.write(
          `Removed ${checkpoint}, which could not be read; ${side} starts afresh.\n`,
        );

        return muirStartCheckpoint(checkpoint, checkpointKey);
      });
  const osTmpBefore = await settled('TMP listing before the run', () =>
    readdirSync(tmpdir()),
  );
  const sampler = await settled('Sampler start', () => steps.startSampler());
  const excluded = new Set(sampler.ok ? [sampler.value.pid] : []);
  const started = performance.now();
  const run = await settled('Stryker run', () =>
    steps.stryker(dir, configFile(side), options.concurrency, {
      tmp: runTmp,
      timeoutMs: options.timeLimitMinutes * 60_000,
      args: [
        ...muirStrykerArgs(options),
        ...(resumed.ok ? muirCheckpointArgs(checkpoint) : []),
      ],
      logFile: join(out, `${side}.log`),
      reporters: resumed.ok ? [muirCheckpointReporterName] : [],
    }),
  );
  const wallMs = Math.round(performance.now() - started);
  const stopped = sampler.ok
    ? await settled('Sampler', () => sampler.value.stop())
    : undefined;
  const samples = stopped?.ok
    ? stopped.value.samples.map((sample) =>
        muirDescendants(sample, process.pid, excluded),
      )
    : [];

  if (stopped?.ok && stopped.value.error !== null) {
    errors.push(`Sampler: ${stopped.value.error}`);
  }

  // Stryker disable next-line MuirProteusNodeTimerDelay: equivalent, as no test can tell a wait one millisecond apart
  await timers.setTimeout(settleMs);
  // One fresh snapshot just before the endings, so a pair that ended or whose id was reused meanwhile is skipped.
  // Ended once recorded, so that one side's leftovers cannot load the next side's run.
  const found = await settled('Leftover snapshot', async () =>
    muirLeftovers(samples.flat(), await steps.snapshot()),
  );
  const ended = await Promise.all(
    (found.ok ? found.value : []).map(async (leftover) => ({
      leftover,
      ending: await settled(`Ending ${leftover.pid}`, () => end(leftover.pid)),
    })),
  );
  await settled('Report copy', () => {
    if (run.ok && run.value.reported) {
      copyFileSync(
        join(dir, muirReportFile),
        join(out, `${side}.mutation.json`),
      );
      muirEndCheckpoint(checkpoint);
    }
  });
  const osTmpAfter = await settled('TMP listing after the run', () =>
    readdirSync(tmpdir()),
  );
  const strykerTmp = join(dir, '.stryker-tmp');
  const strykerTmpEntries = await settled('.stryker-tmp listing', () =>
    existsSync(strykerTmp) ? readdirSync(strykerTmp) : [],
  );

  return {
    side,
    report: run.ok ? run.value : { reported: false },
    result: {
      stryker: run.ok ? strykerResult(run.value) : null,
      errors,
      wallMs,
      resumedMutants: resumed.ok ? resumed.value : 0,
      strykerConfig: muirStrykerConfig(side, options.project),
      processes: {
        ...muirPeaks(samples),
        leftover: ended.map(({ leftover: { pid, name }, ending }) => ({
          pid,
          name,
          endedByDriver: ending.ok && ending.value,
        })),
      },
      newInOsTmp:
        osTmpBefore.ok && osTmpAfter.ok
          ? muirNewEntries(osTmpBefore.value, osTmpAfter.value)
          : [],
      leftoverStrykerTmp: strykerTmpEntries.ok ? strykerTmpEntries.value : [],
    },
  };
}

function strykerResult(run: MuirStrykerRun): MuirStrykerResult {
  return {
    exitCode: run.exitCode,
    timedOut: run.timedOut,
    reported: run.reported,
    ...muirReportScore(run.reported ? run.report : new Map()),
    leftoverInRunTmp: run.leftover,
  };
}

/** Settles each step, recording a step that throws in `errors`, so no failed step goes unreported. */
function settledInto(errors: string[]) {
  return async <T>(
    step: string,
    run: () => T | Promise<T>,
  ): Promise<MuirSettled<T>> => {
    try {
      return { ok: true, value: await run() };
    } catch (error) {
      errors.push(`${step}: ${muirMessageOf(error)}`);

      return { ok: false };
    }
  };
}

/** False when the process ended by itself before the driver could end it. */
function end(pid: number): boolean {
  try {
    process.kill(pid);

    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
      return false;
    }

    throw error;
  }
}

function configFile(side: MuirSide): string {
  return `stryker.${side}.config.mjs`;
}

function given(folder: string): string[] {
  const found = readdirSync(folder)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => resolve(folder, name));

  if (found.length === 0) {
    throw new Error(`${folder} holds no .tgz file.`);
  }

  return found;
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

async function commitOf(cwd: string): Promise<string> {
  const { exitCode, stdout, stderr } = await muirExec(
    'git',
    ['rev-parse', 'HEAD'],
    { cwd },
  );

  if (exitCode !== 0) {
    throw new Error(
      `git rev-parse HEAD in ${cwd} ended with exit code ${exitCode}:\n${stderr}`,
    );
  }

  return stdout.trim();
}

function writeResult(out: string, result: MuirOssResult): void {
  const file = join(out, 'result.json');

  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`Wrote ${file}\n`);
}
