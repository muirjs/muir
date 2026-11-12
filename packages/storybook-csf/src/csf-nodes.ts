import { field, list } from './node-field.ts';

const wrappers: readonly unknown[] = [
  'TSSatisfiesExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'ParenthesizedExpression',
];

export function unwrap(node: unknown): unknown {
  return wrappers.includes(field(node, 'type'))
    ? unwrap(field(node, 'expression'))
    : node;
}

export function declarationOf(statement: unknown): unknown {
  return field(statement, 'type') === 'ExportNamedDeclaration'
    ? field(statement, 'declaration')
    : statement;
}

const storyFactories: readonly unknown[] = ['story', 'extend'];

/** Storybook 10.6.5 `isCsfFactoryCall`: a `.story()` or `.extend()` call on a plain name. */
export function isStoryFactoryCall(node: unknown): boolean {
  return (
    field(node, 'callee', 'object', 'type') === 'Identifier' &&
    storyFactories.includes(field(node, 'callee', 'property', 'name'))
  );
}

export function storyArgument(init: unknown): unknown {
  const current = unwrap(init);

  return isStoryFactoryCall(current)
    ? list(field(current, 'arguments'))[0]
    : current;
}

export interface Assignment {
  readonly statement: unknown;
  readonly target: unknown;
  readonly path: readonly unknown[];
  readonly value: unknown;
}

export function assignmentOf(statement: unknown): readonly Assignment[] {
  const [target, ...path] = memberChain(field(statement, 'expression', 'left'));

  if (
    field(statement, 'expression', 'operator') !== '=' ||
    typeof target !== 'string'
  ) {
    return [];
  }

  return [
    {
      statement,
      target,
      path,
      value: field(statement, 'expression', 'right'),
    },
  ];
}

function memberChain(node: unknown): readonly unknown[] {
  return field(node, 'type') === 'MemberExpression'
    ? [...memberChain(field(node, 'object')), keyOf(node)]
    : [field(node, 'name')];
}

/** Storybook 10.6.5 `keyOf`: a member's name, or `undefined` when only running the file gives it. */
export function keyOf(member: unknown): unknown {
  if (field(member, 'property', 'type') === 'StringLiteral') {
    return field(member, 'property', 'value');
  }

  return field(member, 'computed') === true
    ? undefined
    : field(member, 'property', 'name');
}

/** Storybook 10.6.5 CsfFile indexes a `B.test('name', ...)` statement that is a plain call with a string-literal name and two or more arguments; this check also needs no spread argument, as only running the file tells which argument a spread fills. */
export function isIndexedTestCall(statement: unknown): boolean {
  const call = field(statement, 'expression');
  const args = list(field(call, 'arguments'));

  return (
    field(call, 'type') === 'CallExpression' &&
    field(call, 'callee', 'property', 'name') === 'test' &&
    args.length >= 2 &&
    field(args[0], 'type') === 'StringLiteral' &&
    !args.some((arg) => field(arg, 'type') === 'SpreadElement')
  );
}

const memberTypes: readonly unknown[] = [
  'MemberExpression',
  'OptionalMemberExpression',
];

export function isMember(node: unknown): boolean {
  return memberTypes.includes(field(node, 'type'));
}

export function memberRoot(node: unknown): unknown {
  const current = unwrap(node);

  return isMember(current) ? memberRoot(field(current, 'object')) : current;
}
