import type { NodePath } from '@babel/core';

import type { MuirMoiraNodeTestMutator } from '@muirjs/moira-node-test';

/**
 * Removes an assignment statement, such as `x = y;` or `obj.k = v;`, which no mutator of Stryker's removes. Like
 * Stryker's removal of a call statement, it is dropped when another mutant shares the statement, as in `x = true;`.
 * An assignment to `process.env` stays: a test that points `HOME` at a temporary folder would act on the real one.
 */
export const muirProteusJsAssignmentStatement: MuirMoiraNodeTestMutator<'MuirProteusJsAssignmentStatement'> =
  {
    name: 'MuirProteusJsAssignmentStatement',
    sample: 'x = y;\n',
    *mutate(path, t) {
      if (!path.isExpressionStatement()) {
        return;
      }

      const assignment = path.get('expression');

      if (
        assignment.isAssignmentExpression({ operator: '=' }) &&
        !isEnvironmentVariable(assignment.get('left'))
      ) {
        yield t.emptyStatement();
      }
    },
    filter: (mutantsInScope) => mutantsInScope.length === 1,
  };

function isEnvironmentVariable(target: NodePath): boolean {
  return (
    target.matchesPattern('process.env') ||
    (target.isMemberExpression() &&
      target.get('object').matchesPattern('process.env'))
  );
}
