import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';

import {
  muirMoiraStorybookField,
  muirMoiraStorybookHasRecords,
  muirMoiraStorybookIsStoryFile,
  muirMoiraStorybookList,
  muirMoiraStorybookOutcomeUncheckedFinding,
  muirMoiraStorybookRecordVariable,
  muirMoiraStorybookSpyStubName,
  muirMoiraStorybookSpyStubOutcomeName,
  muirMoiraStorybookStoryFilePaths,
  muirMoiraStorybookUncheckedFinding,
  type MuirMoiraStorybookProject,
  type MuirMoiraStorybookProjectLog,
} from '@muirjs/moira-storybook';
import {
  PlanKind,
  type MutantEarlyResultPlan,
  type MutantRunPlan,
  type MutantTestCoverage,
} from '@stryker-mutator/api/core';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';
import type { Reporter } from '@stryker-mutator/api/report';

import {
  muirBansheeStorybookVitestInteractionHints,
  type MuirBansheeStorybookVitestInteractionHint,
  type MuirBansheeStorybookVitestReportFiles,
  type MuirBansheeStorybookVitestReportMutant,
  muirBansheeStorybookVitestSkippedOnRangeError,
} from './interaction-hints.ts';
import { muirShadowcatStorybookStrykerStorybookProject } from '@muirjs/shadowcat-storybook';
import { muirBansheeStorybookVitestPackageName } from './package-name.ts';
import {
  muirBansheeStorybookVitestSiteFindings,
  type MuirBansheeStorybookVitestSiteFinding,
} from './stub-findings.ts';

export interface MuirBansheeStorybookVitestReport {
  readonly findings: readonly StubFinding[];
  readonly interactionHints: readonly MuirBansheeStorybookVitestInteractionHint[];
  readonly staticStoryMutants: readonly StaticStoryMutant[];
}

type StubFinding =
  | (MuirBansheeStorybookVitestSiteFinding & { readonly file: string })
  | ((
      | typeof muirMoiraStorybookUncheckedFinding
      | typeof muirMoiraStorybookOutcomeUncheckedFinding
    ) & {
      readonly file: string;
      readonly line: number;
    });

interface ReportInput {
  readonly files: MuirBansheeStorybookVitestReportFiles;
}

type Position = MuirBansheeStorybookVitestReportMutant['location']['start'];

interface StaticStoryMutant {
  readonly file: string;
  readonly line: number;
  readonly mutatorName: string;
  readonly netTime: number;
}

type MutantPlan = (
  | Pick<MutantRunPlan, 'plan' | 'netTime'>
  | Pick<MutantEarlyResultPlan, 'plan'>
) & {
  readonly mutant: Pick<
    MutantTestCoverage,
    'fileName' | 'mutatorName' | 'static' | 'location'
  >;
};

interface PlanEvent {
  readonly mutantPlans: readonly MutantPlan[];
}

export function muirBansheeStorybookVitestReporter(
  options: object,
  log: MuirMoiraStorybookProjectLog,
) {
  let staticStoryMutants: readonly StaticStoryMutant[] = [];
  const recordFile = join(
    tmpdir(),
    `muir-storybook-records-${randomUUID()}.jsonl`,
  );
  process.env[muirMoiraStorybookRecordVariable] = recordFile;
  const storybook = (): MuirMoiraStorybookProject =>
    muirShadowcatStorybookStrykerStorybookProject(
      options,
      log,
      muirBansheeStorybookVitestPackageName,
    );

  return {
    onDryRunCompleted(): void {
      const rewritten = muirMoiraStorybookHasRecords(recordFile);
      const seen = storybook().transformer === 'seen';

      if (rewritten && !seen) {
        log.warn(
          `${muirBansheeStorybookVitestPackageName}: the mock transformer rewrote stubs during the dry run, but the Storybook main file's viteFinal does not add muirPixieStorybookViteMockTransformerPlugin(), so the muir-shadowcat-storybook-vitest ignorer treated repaired stubs as erased; add the plugin through viteFinal`,
        );
      }

      if (seen && !rewritten) {
        log.warn(
          `${muirBansheeStorybookVitestPackageName}: the Storybook main file's viteFinal adds muirPixieStorybookViteMockTransformerPlugin(), but it rewrote no stub during the dry run, so the muir-shadowcat-storybook-vitest ignorer may have kept stubs that the mock reset erases; check that the test run uses the Storybook Vite config, or ignore this if no story file stubs a spy outside a function`,
        );
      }
    },
    onMutationTestingPlanReady({ mutantPlans }: PlanEvent): void {
      staticStoryMutants = mutantPlans.flatMap((plan) =>
        plan.plan === PlanKind.Run &&
        plan.mutant.static === true &&
        muirMoiraStorybookIsStoryFile(storybook(), plan.mutant.fileName)
          ? [
              {
                file: projectPath(plan.mutant.fileName),
                line: plan.mutant.location.start.line + 1,
                mutatorName: plan.mutant.mutatorName,
                netTime: plan.netTime,
              },
            ]
          : [],
      );
    },
    onMutationTestReportReady({ files }: ReportInput): void {
      const findings = excludesSpyStub(options)
        ? []
        : stubFindings(files, storybook(), (message) => log.warn(message));
      const hints = muirBansheeStorybookVitestInteractionHints(
        files,
        (message) => log.warn(message),
      );
      const report: MuirBansheeStorybookVitestReport = {
        findings,
        interactionHints: hints,
        staticStoryMutants,
      };
      mkdirSync('reports', { recursive: true });
      writeFileSync(
        join('reports', 'muir-banshee-storybook-vitest.json'),
        JSON.stringify(report, null, 2),
      );
      log.info(consoleBlock(report));
    },
    wrapUp(): void {
      rmSync(recordFile, { force: true });
    },
  } satisfies Reporter;
}

muirBansheeStorybookVitestReporter.inject = tokens(
  commonTokens.options,
  commonTokens.logger,
);

function consoleBlock({
  findings,
  interactionHints: hints,
  staticStoryMutants,
}: MuirBansheeStorybookVitestReport): string {
  if (
    findings.length === 0 &&
    hints.length === 0 &&
    staticStoryMutants.length === 0
  ) {
    return `${muirBansheeStorybookVitestPackageName}: no spy stub findings and no static story mutants`;
  }

  const counts = Object.entries(
    Object.groupBy(findings, ({ verdict }) => verdict),
  ).map(([verdict, group]) => `${group.length} ${verdict}`);
  const shapeCounts = Object.entries(
    Object.groupBy(hints, ({ shape }) => shape),
  ).map(([shape, group]) => `${group.length} ${shape}`);

  return [
    findings.length === 0
      ? `${muirBansheeStorybookVitestPackageName}: no spy stub findings`
      : `${muirBansheeStorybookVitestPackageName}: ${findings.length} spy stub findings (${counts.join(', ')})`,
    ...findings.map((finding) => {
      const method = 'method' in finding ? ` ${finding.method}` : '';

      return `  ${finding.verdict}  ${finding.file}:${finding.line}${method}  ${finding.reason}; ${finding.fix}`;
    }),
    ...(hints.length === 0
      ? []
      : [
          `${muirBansheeStorybookVitestPackageName}: ${hints.length} interaction hints (${shapeCounts.join(', ')})`,
          ...hints.flatMap(({ shape, file, line, reason, fix, comment }) => [
            `  ${shape}  ${file}:${line}  ${reason}; ${fix}`,
            `    ${comment}`,
          ]),
        ]),
    ...(staticStoryMutants.length === 0
      ? []
      : [
          `  static story mutants: ${staticStoryMutants.length}, each runs every test; net times in reports/muir-banshee-storybook-vitest.json`,
        ]),
  ].join('\n');
}

function stubFindings(
  files: ReportInput['files'],
  project: MuirMoiraStorybookProject,
  warn: (message: string) => void,
): readonly StubFinding[] {
  const storyFiles = new Set([
    ...Object.keys(files).filter((file) =>
      muirMoiraStorybookIsStoryFile(project, resolve(file)),
    ),
    ...muirMoiraStorybookStoryFilePaths(project).map(projectPath),
  ]);

  return [
    ...[...storyFiles].flatMap((file) =>
      muirBansheeStorybookVitestStoryFileFindings(
        file,
        () => files[file]?.source ?? readFileSync(file, 'utf8'),
        project,
        warn,
      ),
    ),
    ...Object.entries(files).flatMap(([file, { mutants }]) =>
      survivorFindings(file, mutants),
    ),
  ];
}

/**
 * The unchecked and outcome-unchecked stubs of one file's mutants (storybook ADR-0007): each line with a surviving
 * removal, and each line with a surviving outcome mutant whose stub's removal was killed or timed out.
 */
function survivorFindings(
  file: string,
  mutants: readonly MuirBansheeStorybookVitestReportMutant[],
): readonly StubFinding[] {
  const mutantsOf = (
    mutatorName:
      | typeof muirMoiraStorybookSpyStubName
      | typeof muirMoiraStorybookSpyStubOutcomeName,
    statuses: readonly MuirBansheeStorybookVitestReportMutant['status'][],
  ): readonly MuirBansheeStorybookVitestReportMutant[] =>
    mutants.filter(
      (mutant) =>
        mutant.mutatorName === mutatorName && statuses.includes(mutant.status),
    );
  const detectedRemovals = new Set(
    mutantsOf(muirMoiraStorybookSpyStubName, ['Killed', 'Timeout']).flatMap(
      pairedOutcomeSpans,
    ),
  );
  const uncheckedLines = new Set(
    mutantsOf(muirMoiraStorybookSpyStubName, ['Survived']).map(lineOf),
  );
  const outcomeUncheckedLines = new Set(
    mutantsOf(muirMoiraStorybookSpyStubOutcomeName, ['Survived'])
      .filter((mutant) => detectedRemovals.has(spanOf(mutant)))
      .map(lineOf),
  );

  return [
    ...[...uncheckedLines].map((line) => ({
      file,
      line,
      ...muirMoiraStorybookUncheckedFinding,
    })),
    ...[...outcomeUncheckedLines].map((line) => ({
      file,
      line,
      ...muirMoiraStorybookOutcomeUncheckedFinding,
    })),
  ];
}

function lineOf({ location }: MuirBansheeStorybookVitestReportMutant): number {
  return location.start.line;
}

/**
 * The spans an outcome mutant of the same stub as `removal` can have: the removal's own, as for a definition-time
 * stub, and the removal's less one column, as the removal of a stub statement also covers its semicolon. The stubs
 * of one chain start at the same place but end apart, so the end tells them apart.
 */
function pairedOutcomeSpans(
  removal: MuirBansheeStorybookVitestReportMutant,
): readonly string[] {
  const { start, end } = removal.location;

  return [
    spanOf(removal),
    spanKey(start, { line: end.line, column: end.column - 1 }),
  ];
}

function spanOf({
  location: { start, end },
}: MuirBansheeStorybookVitestReportMutant): string {
  return spanKey(start, end);
}

function spanKey(start: Position, end: Position): string {
  return `${start.line}:${start.column}-${end.line}:${end.column}`;
}

/**
 * The spy stub findings of the story file `file`, whose source `sourceOf` reads; none, after a warning, when Babel
 * cannot parse it or reading its tree throws a `RangeError`. An error from `sourceOf`, such as
 * `ERR_FS_FILE_TOO_LARGE` for a file over 2 GiB, propagates and fails the report.
 */
export function muirBansheeStorybookVitestStoryFileFindings(
  file: string,
  sourceOf: () => string,
  project: MuirMoiraStorybookProject,
  warn: (message: string) => void,
): readonly StubFinding[] {
  const onUnparsable = (fileName: string, error: unknown): void =>
    warn(
      `${muirBansheeStorybookVitestPackageName}: Babel could not parse ${projectPath(fileName)}, so muir-banshee-storybook-vitest skipped its spy stubs: ${error instanceof Error ? error.message : String(error)}`,
    );
  const source = sourceOf();
  const findings = muirBansheeStorybookVitestSkippedOnRangeError(
    () =>
      muirBansheeStorybookVitestSiteFindings(
        source,
        file,
        project,
        onUnparsable,
      ),
    (message) =>
      warn(
        `${muirBansheeStorybookVitestPackageName}: muir-banshee-storybook-vitest could not read the spy stubs of ${projectPath(file)}, so it skipped them: ${message}`,
      ),
  );

  return (findings ?? []).map((finding) => ({ file, ...finding }));
}

function excludesSpyStub(options: object): boolean {
  return muirMoiraStorybookList(
    muirMoiraStorybookField(options, 'mutator', 'excludedMutations'),
  ).includes(muirMoiraStorybookSpyStubName);
}

function projectPath(fileName: string): string {
  return relative(process.cwd(), fileName).split(sep).join('/');
}
