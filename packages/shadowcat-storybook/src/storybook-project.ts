import { execFileSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getInterpretedFile,
  STORY_FILE_TEST_REGEXP,
} from 'storybook/internal/common';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookIsRecord,
  muirMoiraStorybookIsStringArray,
  muirMoiraStorybookMockTransformerPluginName,
} from '@muirjs/moira-storybook';
import { loadConfig } from 'storybook/internal/csf-tools';

import type { MuirShadowcatStorybookLoadResult } from './loader-result.ts';
import {
  muirShadowcatStorybookOptions,
  muirShadowcatStorybookVitestConfigFile,
} from './options.ts';
import { muirShadowcatStorybookPackageName } from './package-name.ts';
import { muirShadowcatStorybookParseProgram } from './parse.ts';
import {
  muirShadowcatStorybookDefaultTestTags,
  muirShadowcatStorybookReadPreviewTest,
  muirShadowcatStorybookUnreadableSettings,
  type MuirShadowcatStorybookResetSettings,
  type MuirShadowcatStorybookTagFilter,
  type MuirShadowcatStorybookTestTags,
} from './reset-setting.ts';

export interface MuirShadowcatStorybookProjectLog {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
}

export interface MuirShadowcatStorybookProject {
  readonly configDir: string;
  readonly storyFiles: ReadonlySet<string> | 'fallback';
  readonly transformer: 'seen' | 'not-seen';
  readonly previewTest: MuirShadowcatStorybookResetSettings;
  readonly testTags: MuirShadowcatStorybookTestTags;
}

type VitestTags =
  | {
      readonly kind: 'resolved';
      readonly tags: MuirShadowcatStorybookTagFilter;
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

const projects = new Map<string, MuirShadowcatStorybookProject>();

const fallbackStoryFiles =
  "story files are guessed by the name pattern of Storybook's CSF indexer: names ending in stories or story with a .js, .jsx, .mjs, .mjsx, .ts or .tsx extension";

export function muirShadowcatStorybookStrykerStorybookProject(
  options: object,
  log: MuirShadowcatStorybookProjectLog,
): MuirShadowcatStorybookProject {
  return muirShadowcatStorybookProject(
    muirShadowcatStorybookOptions(options).configDir,
    log,
    muirShadowcatStorybookVitestConfigFile(options),
  );
}

/** `vitestConfigFile` is Stryker's `vitest.configFile`; without it, Vitest looks the config up from the working directory, as Stryker's Vitest runner does. */
export function muirShadowcatStorybookProject(
  givenConfigDir: string,
  log: MuirShadowcatStorybookProjectLog,
  vitestConfigFile?: string,
): MuirShadowcatStorybookProject {
  const configDir = resolve(givenConfigDir);
  const key = `${configDir}\0${vitestConfigFile ?? ''}`;
  const project =
    projects.get(key) ?? loadProject(configDir, vitestConfigFile, log);
  projects.set(key, project);

  return project;
}

function loadProject(
  configDir: string,
  vitestConfigFile: string | undefined,
  log: MuirShadowcatStorybookProjectLog,
): MuirShadowcatStorybookProject {
  const { storybook: result, vitestTags } = loadStorybook(
    configDir,
    vitestConfigFile,
  );
  const { test: previewTest, tags: previewTags } = readPreview(configDir, log);

  const testTags = {
    ...tagFilter(vitestTags, vitestConfigFile, log),
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
        `${muirShadowcatStorybookPackageName}: no Storybook main file in ${configDir}, so ${fallbackStoryFiles}`,
      );

      return fallbackProject(configDir, previewTest, testTags);
    }
    case 'failed': {
      log.warn(
        `${muirShadowcatStorybookPackageName}: Storybook could not load ${configDir}, so ${fallbackStoryFiles}: ${result.error}`,
      );

      return fallbackProject(configDir, previewTest, testTags);
    }
  }
}

function tagFilter(
  vitestTags: VitestTags,
  vitestConfigFile: string | undefined,
  log: MuirShadowcatStorybookProjectLog,
): MuirShadowcatStorybookTagFilter {
  switch (vitestTags.kind) {
    case 'resolved': {
      return vitestTags.tags;
    }
    case 'failed': {
      log.warn(
        `${muirShadowcatStorybookPackageName}: Vitest could not load ${vitestConfigFile ?? `its config from ${process.cwd()}`}, so the tested stories are the stories tagged test: ${vitestTags.error}`,
      );

      return muirShadowcatStorybookDefaultTestTags;
    }
    case 'no-vitest': {
      log.warn(
        `${muirShadowcatStorybookPackageName}: Vitest is not installed, so the tested stories are the stories tagged test`,
      );

      return muirShadowcatStorybookDefaultTestTags;
    }
    case 'unreadable': {
      log.warn(
        `${muirShadowcatStorybookPackageName}: the Storybook loader wrote a tag filter of an unknown shape, so the tested stories are the stories tagged test`,
      );

      return muirShadowcatStorybookDefaultTestTags;
    }
  }
}

export function muirShadowcatStorybookIsStoryFile(
  project: MuirShadowcatStorybookProject,
  fileName: string,
): boolean {
  if (project.storyFiles === 'fallback') {
    return STORY_FILE_TEST_REGEXP.test(basename(fileName));
  }

  return project.storyFiles.has(normalizePath(fileName));
}

export function muirShadowcatStorybookStoryFilePaths(
  project: MuirShadowcatStorybookProject,
): readonly string[] {
  return project.storyFiles === 'fallback'
    ? globSync('**/*', {
        exclude: (path) => basename(path) === 'node_modules',
      })
        .map((file) => resolve(file))
        .filter((file) => muirShadowcatStorybookIsStoryFile(project, file))
    : [...project.storyFiles];
}

function normalizePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^[a-z]:/, (drive) => drive.toUpperCase());
}

function fallbackProject(
  configDir: string,
  previewTest: MuirShadowcatStorybookResetSettings,
  testTags: MuirShadowcatStorybookTestTags,
): MuirShadowcatStorybookProject {
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
  configDir: string,
  log: MuirShadowcatStorybookProjectLog,
): {
  readonly test: MuirShadowcatStorybookResetSettings;
  readonly tags: readonly string[];
} {
  const file = getInterpretedFile(join(configDir, 'preview'));

  if (file === undefined) {
    return { test: {}, tags: [] };
  }

  try {
    const code = readFileSync(file, 'utf8');
    const tags: unknown = loadConfig(code, file)
      .parse()
      .getFieldValue(['tags']);

    return {
      test: muirShadowcatStorybookReadPreviewTest(
        muirShadowcatStorybookParseProgram(code, file),
      ),
      tags: muirMoiraStorybookIsStringArray(tags) ? tags : [],
    };
  } catch (error) {
    log.warn(
      `${muirShadowcatStorybookPackageName}: could not parse ${file}, so its parameters.test is unknown and its tags are left out: ${String(error)}`,
    );

    return { test: muirShadowcatStorybookUnreadableSettings, tags: [] };
  }
}

function loadStorybook(
  configDir: string,
  vitestConfigFile: string | undefined,
): {
  readonly storybook: MuirShadowcatStorybookLoadResult;
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

    return muirShadowcatStorybookParseLoaderResult(
      JSON.parse(readFileSync(resultFile, 'utf8')),
    );
  } finally {
    rmSync(resultDir, { recursive: true, force: true });
  }
}

/** Parses the result file of the Storybook loader child, which `LoaderResult` describes. */
export function muirShadowcatStorybookParseLoaderResult(value: unknown): {
  readonly storybook: MuirShadowcatStorybookLoadResult;
  readonly vitestTags: VitestTags;
} {
  return {
    storybook: parseResult(value),
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
      include: include ?? muirShadowcatStorybookDefaultTestTags.include,
      exclude: exclude ?? [],
      skip: skip ?? [],
    },
  };
}

function parseResult(value: unknown): MuirShadowcatStorybookLoadResult {
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
    `${muirShadowcatStorybookPackageName}: the Storybook loader wrote a result of an unknown shape`,
  );
}
