import {
  muirMutantLabel,
  muirMutantsByKey,
  type MuirMutantDetail,
  type MuirMutantStatus,
  type MuirReport,
} from '../report.ts';
import { muirSides, type MuirSide } from './options.ts';

export interface MuirScore {
  readonly counts: Readonly<Record<string, number>>;
  /** Stryker's mutation score: Killed and Timeout over those plus Survived and NoCoverage; null with none of them. */
  readonly score: number | null;
}

export interface MuirVerdict {
  /** `file:line:column-endLine:endColumn mutator replacement`, as both reports locate the mutant. */
  readonly mutant: string;
  readonly muir: MuirMutantStatus | null;
  readonly command: MuirMutantStatus | null;
}

export type MuirComparison =
  | { readonly compared: false; readonly reason: string }
  | {
      readonly compared: true;
      readonly disagreements: readonly MuirVerdict[];
      readonly verdicts: readonly MuirVerdict[];
    };

/** A side left out did not run. */
export type MuirBySide<T> = { readonly [TSide in MuirSide]?: T };

/** What a side that ran left to compare; no report when Stryker threw or wrote none. */
export type MuirSideReport =
  | { readonly reported: true; readonly report: MuirReport }
  | { readonly reported: false };

/** Keys each item's value by its side, in the items' order. */
export function muirBySide<TItem extends { readonly side: MuirSide }, T>(
  items: readonly TItem[],
  of: (item: TItem) => T,
): MuirBySide<T> {
  return items.reduce<MuirBySide<T>>(
    (bySide, item) => ({ ...bySide, [item.side]: of(item) }),
    {},
  );
}

export function muirScore(mutants: readonly MuirMutantDetail[]): MuirScore {
  const count = (status: MuirMutantStatus): number =>
    mutants.filter((mutant) => mutant.status === status).length;
  const detected = count('Killed') + count('Timeout');
  const valid = detected + count('Survived') + count('NoCoverage');

  return {
    counts: Object.fromEntries(
      [...new Set(mutants.map(({ status }) => status))]
        .sort()
        .map((status) => [status, count(status)]),
    ),
    score: valid === 0 ? null : (detected / valid) * 100,
  };
}

export interface MuirMutantsScore extends MuirScore {
  readonly mutants: number;
}

export function muirReportScore(report: MuirReport): MuirMutantsScore {
  const mutants = [...report.values()].flat();

  return { ...muirScore(mutants), mutants: mutants.length };
}

export function muirMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function muirCompare(
  muir: MuirReport,
  command: MuirReport,
): MuirVerdict[] {
  const muirStatuses = muirMutantsByKey(muir);
  const commandStatuses = muirMutantsByKey(command);
  const labels = new Map(
    [...muirStatuses, ...commandStatuses].map(([key, { file, mutant }]) => [
      key,
      muirMutantLabel(file, mutant),
    ]),
  );

  return [...labels].map(([key, label]) => ({
    mutant: label,
    muir: muirStatuses.get(key)?.mutant.status ?? null,
    command: commandStatuses.get(key)?.mutant.status ?? null,
  }));
}

/** Without a report on both sides there is nothing to compare, which an empty disagreement list would hide. */
export function muirComparison(
  bySide: MuirBySide<MuirSideReport>,
): MuirComparison {
  const ran = muirSides.filter((side) => bySide[side] !== undefined);
  const missing = muirSides.filter((side) => bySide[side] === undefined);

  if (ran.length === 0) {
    return { compared: false, reason: 'No side ran.' };
  }

  if (missing.length > 0) {
    // Stryker disable next-line StringLiteral: equivalent, as of the two sides exactly one ran here, so no separator shows
    const ranSides = ran.join(' and ');
    // Stryker disable next-line StringLiteral: equivalent, as of the two sides exactly one is missing here, so no separator shows
    const missingSides = missing.join(' and ');

    return {
      compared: false,
      reason: `Only the ${ranSides} side ran; merge its result.json with a ${missingSides} run with --merge.`,
    };
  }

  const { muir, command } = bySide;

  if (
    muir === undefined ||
    command === undefined ||
    !muir.reported ||
    !command.reported
  ) {
    return { compared: false, reason: 'A side wrote no report.' };
  }

  try {
    const verdicts = muirCompare(muir.report, command.report);

    return {
      compared: true,
      disagreements: verdicts.filter(
        (verdict) => verdict.muir !== verdict.command,
      ),
      verdicts,
    };
  } catch (error) {
    return { compared: false, reason: muirMessageOf(error) };
  }
}
