import { field, fileNameOf } from '@layzee/storybook-core';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import {
  isStoryFile,
  strykerStorybookProject,
  type ProjectLog,
} from './storybook-project.ts';
import { stubIgnores, type StubIgnore } from './stub-verdict.ts';

export function stubIgnorer(options: object, log: ProjectLog): Ignorer {
  let ignores: readonly StubIgnore[] = [];

  return {
    shouldIgnore(path) {
      const node = field(path, 'node');

      if (field(node, 'type') === 'Program') {
        const fileName = fileNameOf(path);
        const code = field(path, 'hub', 'file', 'code');
        const project = strykerStorybookProject(options, log);
        ignores =
          fileName !== undefined &&
          typeof code === 'string' &&
          isStoryFile(project, fileName)
            ? stubIgnores({ program: node, code, fileName }, project)
            : [];
      }

      const argumentCall = callOfArgument(path);
      const ignore = ignores.find(({ start, end, covers }) => {
        const call = covers === 'call' ? node : argumentCall;

        return field(call, 'start') === start && field(call, 'end') === end;
      });

      return ignore?.reason;
    },
  };
}

function callOfArgument(path: unknown): unknown {
  return field(path, 'listKey') === 'arguments'
    ? field(path, 'parent')
    : undefined;
}

stubIgnorer.inject = tokens(commonTokens.options, commonTokens.logger);
