import {
  muirMoiraStorybookField,
  muirMoiraStorybookIsRecord,
  muirMoiraStorybookProject,
  type MuirMoiraStorybookProject,
  type MuirMoiraStorybookProjectLog,
} from '@muirjs/moira-storybook';

export interface MuirShadowcatStorybookOptions {
  readonly configDir: string;
}

export const muirShadowcatStorybookPlayModes = ['ignore', 'mutate'] as const;

/** The `muirShadowcatStorybookCsf` options of a Stryker config. */
export interface MuirShadowcatStorybookCsfOptions {
  readonly play?: (typeof muirShadowcatStorybookPlayModes)[number];
}

/** Stryker's Vitest runner passes `vitest.configFile` to `createVitest` as `config` (vitest-test-runner.ts 207-208 at v10.1.1). */
export function muirShadowcatStorybookVitestConfigFile(
  options: object,
): string | undefined {
  const configFile = muirMoiraStorybookField(options, 'vitest', 'configFile');

  return typeof configFile === 'string' ? configFile : undefined;
}

/** Reads `muirShadowcatStorybook`; an error names `packageName`, the package of the plugin the user configured. */
export function muirShadowcatStorybookOptions(
  options: object,
  packageName: string,
): MuirShadowcatStorybookOptions {
  const muirShadowcatStorybook: unknown = Reflect.get(
    options,
    'muirShadowcatStorybook',
  );
  const configDir = muirMoiraStorybookIsRecord(muirShadowcatStorybook)
    ? muirShadowcatStorybook['configDir']
    : undefined;

  if (configDir === undefined) {
    return { configDir: '.storybook' };
  }

  if (typeof configDir !== 'string') {
    throw new Error(
      `${packageName}: muirShadowcatStorybook.configDir must be a string, not ${String(configDir)}`,
    );
  }

  return { configDir };
}

export function muirShadowcatStorybookStrykerStorybookProject(
  options: object,
  log: MuirMoiraStorybookProjectLog,
  packageName: string,
): MuirMoiraStorybookProject {
  return muirMoiraStorybookProject(
    packageName,
    muirShadowcatStorybookOptions(options, packageName).configDir,
    log,
    muirShadowcatStorybookVitestConfigFile(options),
  );
}
