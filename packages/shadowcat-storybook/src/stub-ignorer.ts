import {
  muirMoiraStorybookField,
  muirMoiraStorybookFileNameOf,
} from '@muirjs/moira-storybook';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import {
  muirShadowcatStorybookIsStoryFile,
  muirShadowcatStorybookStrykerStorybookProject,
  type MuirShadowcatStorybookProjectLog,
} from './storybook-project.ts';
import {
  muirShadowcatStorybookStubIgnores,
  type MuirShadowcatStorybookStubIgnore,
} from './stub-verdict.ts';

export function muirShadowcatStorybookStubIgnorer(
  options: object,
  log: MuirShadowcatStorybookProjectLog,
): Ignorer {
  let ignores: readonly MuirShadowcatStorybookStubIgnore[] = [];

  return {
    shouldIgnore(path) {
      const node = muirMoiraStorybookField(path, 'node');

      if (muirMoiraStorybookField(node, 'type') === 'Program') {
        const fileName = muirMoiraStorybookFileNameOf(path);
        const code = muirMoiraStorybookField(path, 'hub', 'file', 'code');
        const project = muirShadowcatStorybookStrykerStorybookProject(
          options,
          log,
        );
        ignores =
          fileName !== undefined &&
          typeof code === 'string' &&
          muirShadowcatStorybookIsStoryFile(project, fileName)
            ? muirShadowcatStorybookStubIgnores(
                { program: node, code, fileName },
                project,
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

muirShadowcatStorybookStubIgnorer.inject = tokens(
  commonTokens.options,
  commonTokens.logger,
);
