import {
  muirMoiraStorybookField,
  muirMoiraStorybookIsStoryFile,
  muirMoiraStorybookStubIgnores,
  muirMoiraStorybookTraversedFileNameOf,
  type MuirMoiraStorybookProjectLog,
  type MuirMoiraStorybookStubIgnore,
} from '@muirjs/moira-storybook';
import { muirShadowcatStorybookStrykerStorybookProject } from '@muirjs/shadowcat-storybook';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

export const muirShadowcatStorybookVitestPackageName =
  '@muirjs/shadowcat-storybook-vitest';

export const muirShadowcatStorybookVitestPluginName =
  'muir-shadowcat-storybook-vitest';

export function muirShadowcatStorybookVitestStubIgnorer(
  options: object,
  log: MuirMoiraStorybookProjectLog,
): Ignorer {
  let ignores: readonly MuirMoiraStorybookStubIgnore[] = [];

  return {
    shouldIgnore(path) {
      const node = muirMoiraStorybookField(path, 'node');

      if (muirMoiraStorybookField(node, 'type') === 'Program') {
        const fileName = muirMoiraStorybookTraversedFileNameOf(
          muirShadowcatStorybookVitestPackageName,
          path,
        );
        const code = muirMoiraStorybookField(path, 'hub', 'file', 'code');
        const project = muirShadowcatStorybookStrykerStorybookProject(
          options,
          log,
          muirShadowcatStorybookVitestPackageName,
        );
        ignores =
          fileName !== undefined &&
          typeof code === 'string' &&
          muirMoiraStorybookIsStoryFile(project, fileName)
            ? muirMoiraStorybookStubIgnores(
                { program: node, code, fileName },
                project,
                muirShadowcatStorybookVitestPluginName,
              )
            : [];
      }

      const argumentCall = callOfArgument(path);
      const ignore = ignores.find(({ start, end, covers }) => {
        const call = covers === 'call' ? node : argumentCall;

        return (
          muirMoiraStorybookField(call, 'start') === start &&
          muirMoiraStorybookField(call, 'end') === end
        );
      });

      return ignore?.reason;
    },
  };
}

function callOfArgument(path: unknown): unknown {
  return muirMoiraStorybookField(path, 'listKey') === 'arguments'
    ? muirMoiraStorybookField(path, 'parent')
    : undefined;
}

muirShadowcatStorybookVitestStubIgnorer.inject = tokens(
  commonTokens.options,
  commonTokens.logger,
);
