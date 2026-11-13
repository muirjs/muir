import { field } from './node-field.ts';
import { descendants, memberName, type TreeIndex } from './node-tree.ts';

export interface Check {
  readonly node: unknown;
  /** `expect`: `expect(...)`, or `expect.soft`, `expect.element` or `expect.poll`; `query`: a failing query, `find(All)?By*` or `get(All)?By*`, which throws when it finds nothing. */
  readonly kind: 'expect' | 'query';
  /** `.not` in the member chain after an expect call; a query is never negative. */
  readonly negative: boolean;
}

/** The statement that ends the following checks. */
export type WindowEnd =
  | {
      readonly by: 'interaction';
      /** The ending site; `at(node)` gives its interaction. */
      readonly node: unknown;
      /** It stands in this interaction's own statement list. */
      readonly sameList: boolean;
      /** It is the very next statement of this interaction's own statement list. */
      readonly adjacent: boolean;
      /** Its first argument is structurally equivalent to this one's, positions and comments aside. */
      readonly sameTarget: boolean;
    }
  | { readonly by: 'step' }
  | { readonly by: 'maybe' }
  | { readonly by: 'none' };

export interface FollowingChecks {
  /** Source order. */
  readonly checks: readonly Check[];
  readonly end: WindowEnd;
  /** The statement LzStorybookAssertionBefore copies before the interaction, or `undefined`. */
  readonly copy: unknown;
}

/** `findBy*`, `findAllBy*`, `getBy*` and `getAllBy*`, on any receiver or none; `queryBy*` finds nothing quietly. */
const failingQuery = /^(find|get)(All)?By/;

/** The check that `node` is, when it is a check call. */
function checkOf(node: unknown): Check | undefined {
  const callee = field(node, 'callee');
  const name = memberName(callee) ?? field(callee, 'name');

  return field(node, 'type') === 'CallExpression' &&
    typeof name === 'string' &&
    failingQuery.test(name)
    ? { node, kind: 'query', negative: false }
    : undefined;
}

/** The checks that follow the interaction at `site`: in the statements after it, up to the first that is or holds an interaction. */
export function followingChecksOf(
  site: unknown,
  tree: TreeIndex,
): FollowingChecks {
  const statements = tree.listOf(site) ?? [];
  const later = statements.slice(statements.indexOf(site) + 1);

  return {
    checks: later.flatMap(descendants).flatMap((node) => {
      const check = checkOf(node);

      return check === undefined ? [] : [check];
    }),
    end: { by: 'none' },
    copy: undefined,
  };
}

/** `step(...)`, or `<context>.step(...)` on a play context that is not destructured. */
export function isStepCall(node: unknown): boolean {
  const callee = field(node, 'callee');

  return (
    field(node, 'type') === 'CallExpression' &&
    (field(callee, 'name') === 'step' ||
      (field(callee, 'type') === 'MemberExpression' &&
        field(callee, 'object', 'type') === 'Identifier' &&
        memberName(callee) === 'step'))
  );
}
