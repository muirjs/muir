import { execFileSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  muirMoiraStorybookIsRecord,
  muirMoiraStorybookIsStringArray,
} from './is-record.ts';
import type { MuirMoiraStorybookLoadResult } from './loader-result.ts';
import { muirMoiraStorybookField } from './node-field.ts';
import { muirMoiraStorybookParseProgram } from './parse.ts';
import {
  muirMoiraStorybookDefaultTestTags,
  muirMoiraStorybookReadPreviewTest,
  muirMoiraStorybookUnreadableSettings,
  type MuirMoiraStorybookResetSettings,
  type MuirMoiraStorybookTagFilter,
  type MuirMoiraStorybookTestTags,
} from './reset-setting.ts';
import {
  muirMoiraStorybookInternalCommon,
  muirMoiraStorybookInternalCsfTools,
} from './storybook-internals.ts';
import { muirMoiraStorybookMockTransformerPluginName } from './stryker-record.ts';

export interface MuirMoiraStorybookProjectLog {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
}

export interface MuirMoiraStorybookProject {
  readonly configDir: string;
  readonly storyFiles: ReadonlySet<string> | 'fallback';
  readonly transformer: 'seen' | 'not-seen';
  readonly previewTest: MuirMoiraStorybookResetSettings;
  readonly testTags: MuirMoiraStorybookTestTags;
}

type VitestTags =
  | {
      readonly kind: 'resolved';
      readonly tags: MuirMoiraStorybookTagFilter;
    }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'no-vitest' }
  | { readonly kind: 'unreadable' };

const childFile = fileURLToPath(
  new URL(
    `./load-storybook.child${extname(fileURLToPath(import.meta.url))}`,
    import.meta.url,
  ),
);

const projects = new Map<string, MuirMoiraStorybookProject>();

const fallbackStoryFiles =
  "story files are guessed by the name pattern of Storybook's CSF indexer: names ending in stories or story with a .js, .jsx, .mjs, .mjsx, .ts or .tsx extension";

/**
 * `packageName` starts every message, so a message names the plugin package the user configured. `vitestConfigFile`
 * is Stryker's `vitest.configFile`; without it, Vitest looks the config up from the working directory, as Stryker's
 * Vitest runner does.
 */
export function muirMoiraStorybookProject(
  packageName: string,
  givenConfigDir: string,
  log: MuirMoiraStorybookProjectLog,
  vitestConfigFile?: string,
): MuirMoiraStorybookProject {
  const configDir = resolve(givenConfigDir);
  const key = `${configDir}\0${vitestConfigFile ?? ''}`;
  const project =
    projects.get(key) ??
    loadProject(packageName, configDir, vitestConfigFile, log);
  projects.set(key, project);

  return project;
}

function loadProject(
  packageName: string,
  configDir: string,
  vitestConfigFile: string | undefined,
  log: MuirMoiraStorybookProjectLog,
): MuirMoiraStorybookProject {
  const { storybook: result, vitestTags } = loadStorybook(
    packageName,
    configDir,
    vitestConfigFile,
  );
  const { test: previewTest, tags: previewTags } = readPreview(
    packageName,
    configDir,
    log,
  );

  const testTags = {
    ...tagFilter(packageName, vitestTags, vitestConfigFile, log),
    previewTags,
  };

  switch (result.kind) {
    case 'loaded': {
      return {
        configDir,
        storyFiles: new Set(
          result.storyFiles
            .filter((file) => extname(file) !== '.mdx')
            .map(normalizePath),
        ),
        transformer: result.pluginNames.includes(
          muirMoiraStorybookMockTransformerPluginName,
        )
          ? 'seen'
          : 'not-seen',
        previewTest,
        testTags,
      };
    }
    case 'no-main': {
      log.info(
        `${packageName}: no Storybook main file in ${configDir}, so ${fallbackStoryFiles}`,
      );

      return fallbackProject(configDir, previewTest, testTags);
    }
    case 'failed': {
      log.warn(
        `${packageName}: Storybook could not load ${configDir}, so ${fallbackStoryFiles}: ${result.error}`,
      );

      return fallbackProject(configDir, previewTest, testTags);
    }
  }
}

function tagFilter(
  packageName: string,
  vitestTags: VitestTags,
  vitestConfigFile: string | undefined,
  log: MuirMoiraStorybookProjectLog,
): MuirMoiraStorybookTagFilter {
  switch (vitestTags.kind) {
    case 'resolved': {
      return vitestTags.tags;
    }
    case 'failed': {
      log.warn(
        `${packageName}: Vitest could not load ${vitestConfigFile ?? `its config from ${process.cwd()}`}, so the tested stories are the stories tagged test: ${vitestTags.error}`,
      );

      return muirMoiraStorybookDefaultTestTags;
    }
    case 'no-vitest': {
      log.warn(
        `${packageName}: Vitest is not installed, so the tested stories are the stories tagged test`,
      );

      return muirMoiraStorybookDefaultTestTags;
    }
    case 'unreadable': {
      log.warn(
        `${packageName}: the Storybook loader wrote a tag filter of an unknown shape, so the tested stories are the stories tagged test`,
      );

      return muirMoiraStorybookDefaultTestTags;
    }
  }
}

export function muirMoiraStorybookIsStoryFile(
  project: MuirMoiraStorybookProject,
  fileName: string,
): boolean {
  if (project.storyFiles === 'fallback') {
    return muirMoiraStorybookInternalCommon().STORY_FILE_TEST_REGEXP.test(
      basename(fileName),
    );
  }

  return project.storyFiles.has(normalizePath(fileName));
}

export function muirMoiraStorybookStoryFilePaths(
  project: MuirMoiraStorybookProject,
): readonly string[] {
  return project.storyFiles === 'fallback'
    ? globSync('**/*', {
        exclude: (path) => basename(path) === 'node_modules',
      })
        .map((file) => resolve(file))
        .filter((file) => muirMoiraStorybookIsStoryFile(project, file))
    : [...project.storyFiles];
}

function normalizePath(path: string): string {
  const slashed = path.replaceAll('\\', '/');

  // Stryker disable next-line all: only a Windows path starts with a drive letter and holds no other colon, and CI mutates on Linux
  return slashed.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
}

function fallbackProject(
  configDir: string,
  previewTest: MuirMoiraStorybookResetSettings,
  testTags: MuirMoiraStorybookTestTags,
): MuirMoiraStorybookProject {
  return {
    configDir,
    storyFiles: 'fallback',
    transformer: 'not-seen',
    previewTest,
    testTags,
  };
}

/** The tags are read as Storybook 10.6.5 vitest-plugin index.ts `extractTagsFromPreview` reads them. */
function readPreview(
  packageName: string,
  configDir: string,
  log: MuirMoiraStorybookProjectLog,
): {
  readonly test: MuirMoiraStorybookResetSettings;
  readonly tags: readonly string[];
} {
  const file = muirMoiraStorybookInternalCommon().getInterpretedFile(
    join(configDir, 'preview'),
  );

  if (file === undefined) {
    return { test: {}, tags: [] };
  }

  const { loadConfig } = muirMoiraStorybookInternalCsfTools();

  try {
    const code = readFileSync(file, 'utf8');
    const tags: unknown = loadConfig(code, file)
      .parse()
      .getFieldValue(['tags']);

    return {
      test: muirMoiraStorybookReadPreviewTest(
        muirMoiraStorybookParseProgram(code, file),
      ),
      tags: muirMoiraStorybookIsStringArray(tags) ? tags : [],
    };
  } catch (error) {
    log.warn(
      `${packageName}: could not parse ${file}, so its parameters.test is unknown and its tags are left out: ${String(error)}`,
    );

    return { test: muirMoiraStorybookUnreadableSettings, tags: [] };
  }
}

function loadStorybook(
  packageName: string,
  configDir: string,
  vitestConfigFile: string | undefined,
): {
  readonly storybook: MuirMoiraStorybookLoadResult;
  readonly vitestTags: VitestTags;
} {
  const resultDir = mkdtempSync(join(tmpdir(), 'muir-storybook-'));
  const resultFile = join(resultDir, 'result.json');

  try {
    execFileSync(
      process.execPath,
      [
        childFile,
        configDir,
        resultFile,
        ...(vitestConfigFile === undefined ? [] : [vitestConfigFile]),
      ],
      { stdio: 'ignore' },
    );

    return muirMoiraStorybookParseLoaderResult(
      JSON.parse(readFileSync(resultFile, 'utf8')),
      packageName,
    );
  } finally {
    rmSync(resultDir, { recursive: true, force: true });
  }
}

/** Parses the result file of the Storybook loader child, which `LoaderResult` describes. */
export function muirMoiraStorybookParseLoaderResult(
  value: unknown,
  packageName: string,
): {
  readonly storybook: MuirMoiraStorybookLoadResult;
  readonly vitestTags: VitestTags;
} {
  return {
    storybook: parseResult(value, packageName),
    vitestTags: parseTestTags(muirMoiraStorybookField(value, 'testTags')),
  };
}

function parseTestTags(value: unknown): VitestTags {
  const kind = muirMoiraStorybookField(value, 'kind');
  const error = muirMoiraStorybookField(value, 'error');

  if (kind === 'failed' && typeof error === 'string') {
    return { kind, error };
  }

  if (kind === 'no-vitest') {
    return { kind };
  }

  const values = ['include', 'exclude', 'skip'].map((key) =>
    muirMoiraStorybookField(value, key),
  );

  if (
    kind !== 'resolved' ||
    !values.every((tags) => tags === undefined || typeof tags === 'string')
  ) {
    return { kind: 'unreadable' };
  }

  const [include, exclude, skip] = values.map((tags) =>
    typeof tags === 'string' ? tags.split(',').filter(Boolean) : undefined,
  );

  return {
    kind: 'resolved',
    tags: {
      include: include ?? muirMoiraStorybookDefaultTestTags.include,
      exclude: exclude ?? [],
      skip: skip ?? [],
    },
  };
}

function parseResult(
  value: unknown,
  packageName: string,
): MuirMoiraStorybookLoadResult {
  if (muirMoiraStorybookIsRecord(value)) {
    const { kind, storyFiles, pluginNames, error } = value;

    if (
      kind === 'loaded' &&
      muirMoiraStorybookIsStringArray(storyFiles) &&
      muirMoiraStorybookIsStringArray(pluginNames)
    ) {
      return { kind, storyFiles, pluginNames };
    }

    if (kind === 'no-main') {
      return { kind };
    }

    if (kind === 'failed' && typeof error === 'string') {
      return { kind, error };
    }
  }

  throw new Error(
    `${packageName}: the Storybook loader wrote a result of an unknown shape`,
  );
}
