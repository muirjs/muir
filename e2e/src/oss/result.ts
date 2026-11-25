import { muirIsRecord } from '../report.ts';
import type { MuirOssPatch } from './options.ts';
import type { MuirProcessPeaks } from './processes.ts';
import type {
  MuirBySide,
  MuirComparison,
  MuirMutantsScore,
} from './verdicts.ts';

/** What the project's copy ran with on both sides; the command side's `node --test` flags are in its strykerConfig. */
export interface MuirProjectSetup {
  readonly mutate: readonly string[];
  readonly testFiles: readonly string[];
  readonly patches: readonly MuirOssPatch[];
}

/**
 * The header fields that decide a run's verdicts beyond its sides' Stryker configurations: a merge matches them across
 * its runs, and a checkpoint is kept only under the same ones.
 */
export interface MuirDecidingFields {
  readonly project: string;
  readonly sourceCommit: string;
  readonly node: string;
  readonly platform: string;
  /** Stryker's `timeoutMS` from `--mutant-timeout-ms`; null for Stryker's default. */
  readonly mutantTimeoutMs: number | null;
  /** muirInstalledVersions of the copy: a clone without a lockfile can install newer dependencies on a rerun. */
  readonly installedVersions: readonly string[];
  /** sha256 of each tarball, sorted: every package is version 0.0.0, so the names cannot tell builds apart. */
  readonly tarballDigests: readonly string[];
  readonly projectSetup: MuirProjectSetup;
}

/** Keyed by the interface, so the compiler refuses a field added there and missing here. */
const decidingFieldSet: Readonly<Record<keyof MuirDecidingFields, null>> = {
  project: null,
  sourceCommit: null,
  node: null,
  platform: null,
  mutantTimeoutMs: null,
  installedVersions: null,
  tarballDigests: null,
  projectSetup: null,
};

export const muirDecidingFields: readonly (keyof MuirDecidingFields)[] =
  Object.keys(decidingFieldSet).filter(
    (field): field is keyof MuirDecidingFields => field in decidingFieldSet,
  );

export interface MuirOssHeader extends MuirDecidingFields {
  readonly source: string;
  readonly workspaceCommit: string;
  readonly concurrency: number;
  readonly timeLimitMinutes: number;
  /** The `--mutate` patterns; empty when the run mutated the project's whole set. */
  readonly mutate: readonly string[];
  readonly tarballs: readonly string[];
  readonly npmBefore: string;
  readonly startedAt: string;
}

export interface MuirLeftover {
  readonly pid: number;
  readonly name: string;
  readonly endedByDriver: boolean;
}

export interface MuirStrykerResult extends MuirMutantsScore {
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly reported: boolean;
  readonly leftoverInRunTmp: readonly string[];
}

export interface MuirSideResult {
  /** Null when the Stryker run itself threw; `errors` says why. */
  readonly stryker: MuirStrykerResult | null;
  /** Each step that threw, so a failed step leaves the result of the others. */
  readonly errors: readonly string[];
  /** For a resumed side, the last run's time only. */
  readonly wallMs: number;
  /**
   * Mutants in the checkpoint that an earlier run of the same part left when it ended before its report; Stryker
   * retests those whose code or tests changed.
   */
  readonly resumedMutants: number;
  /** muirStrykerConfig of the side, which a merge matches across its batches of the side. */
  readonly strykerConfig: string;
  readonly processes: MuirProcessPeaks & {
    readonly leftover: readonly MuirLeftover[];
  };
  readonly newInOsTmp: readonly string[];
  readonly leftoverStrykerTmp: readonly string[];
}

/** The result.json of a run, with each side's `<side>.mutation.json` beside it. */
export type MuirOssResult = MuirOssHeader &
  (
    | { readonly preparedIn: string }
    | ({ readonly sides: MuirBySide<MuirSideResult> } & MuirComparison)
  );

/** What a merge needs of a run's result.json: the deciding fields as written, and each side's entry as written. */
export interface MuirParsedOssResult {
  readonly project: string;
  readonly deciding: ReadonlyMap<keyof MuirDecidingFields, unknown>;
  readonly sides: Readonly<Record<string, unknown>>;
}

/** Reads the parsed JSON of a driver run's result.json, refusing a merge's result and anything that is not a run's. */
export function muirParseOssResult(
  file: string,
  value: unknown,
): MuirParsedOssResult {
  if (muirIsRecord(value) && 'mergedFrom' in value) {
    throw new Error(
      `${file} is the result of a merge; merges do not compose, so merge the runs it lists in mergedFrom.`,
    );
  }

  if (muirIsRecord(value)) {
    const missing = muirDecidingFields.find((field) => !(field in value));

    if (missing !== undefined) {
      throw new Error(
        `${file} is not the result.json of a driver run that a merge can read: it lacks ${missing}.`,
      );
    }

    const { project, sides } = value;

    if (typeof project === 'string' && muirIsRecord(sides)) {
      return {
        project,
        deciding: new Map(
          muirDecidingFields.map((field) => [field, value[field]]),
        ),
        sides,
      };
    }
  }

  throw new Error(`${file} is not the result.json of a driver run.`);
}

/** The result.json of a merge, which writes no `<side>.mutation.json`. */
export type MuirMergeResult = {
  readonly project: string;
  readonly mergedFrom: readonly string[];
  readonly scores: MuirBySide<MuirMutantsScore>;
} & MuirComparison;
