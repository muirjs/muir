import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';

const wrappers: readonly unknown[] = [
  'TSSatisfiesExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'ParenthesizedExpression',
];

export function muirMoiraStorybookUnwrap(node: unknown): unknown {
  return wrappers.includes(muirMoiraStorybookField(node, 'type'))
    ? muirMoiraStorybookUnwrap(muirMoiraStorybookField(node, 'expression'))
    : node;
}

const literalTypes: readonly unknown[] = [
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
];

/** The value of a string, number, boolean or `null` literal, a template literal with no expression, or a negated number literal. */
export function muirMoiraStorybookPrimitiveLiteralOf(
  node: unknown,
): { readonly value: unknown } | undefined {
  const type = muirMoiraStorybookField(node, 'type');

  if (type === 'NullLiteral') {
    return { value: null };
  }

  if (literalTypes.includes(type)) {
    return { value: muirMoiraStorybookField(node, 'value') };
  }

  // Only a template literal has quasis, and only a unary minus has an operator '-' with a numeric argument value.
  const [quasi, ...more] = muirMoiraStorybookList(
    muirMoiraStorybookField(node, 'quasis'),
  );
  const cooked = muirMoiraStorybookField(quasi, 'value', 'cooked');

  if (more.length === 0 && typeof cooked === 'string') {
    return { value: cooked };
  }

  const negated = muirMoiraStorybookField(node, 'argument', 'value');

  return muirMoiraStorybookField(node, 'operator') === '-' &&
    typeof negated === 'number'
    ? { value: -negated }
    : undefined;
}

export function muirMoiraStorybookDeclarationOf(statement: unknown): unknown {
  return muirMoiraStorybookField(statement, 'type') === 'ExportNamedDeclaration'
    ? muirMoiraStorybookField(statement, 'declaration')
    : statement;
}

const storyFactories: readonly unknown[] = ['story', 'extend'];

/** Storybook 10.6.5 `isCsfFactoryCall`: a `.story()` or `.extend()` call on a plain name. */
export function muirMoiraStorybookIsStoryFactoryCall(node: unknown): boolean {
  return (
    muirMoiraStorybookField(node, 'callee', 'object', 'type') ===
      'Identifier' &&
    storyFactories.includes(
      muirMoiraStorybookField(node, 'callee', 'property', 'name'),
    )
  );
}

export function muirMoiraStorybookStoryArgument(init: unknown): unknown {
  const current = muirMoiraStorybookUnwrap(init);

  return muirMoiraStorybookIsStoryFactoryCall(current)
    ? muirMoiraStorybookList(muirMoiraStorybookField(current, 'arguments'))[0]
    : current;
}

export interface MuirMoiraStorybookAssignment {
  readonly statement: unknown;
  readonly target: unknown;
  readonly path: readonly unknown[];
  readonly value: unknown;
}

export function muirMoiraStorybookAssignmentOf(
  statement: unknown,
): readonly MuirMoiraStorybookAssignment[] {
  const [target, ...path] = memberChain(
    muirMoiraStorybookField(statement, 'expression', 'left'),
  );

  if (
    muirMoiraStorybookField(statement, 'expression', 'operator') !== '=' ||
    typeof target !== 'string'
  ) {
    return [];
  }

  return [
    {
      statement,
      target,
      path,
      value: muirMoiraStorybookField(statement, 'expression', 'right'),
    },
  ];
}

function memberChain(node: unknown): readonly unknown[] {
  return muirMoiraStorybookField(node, 'type') === 'MemberExpression'
    ? [
        ...memberChain(muirMoiraStorybookField(node, 'object')),
        muirMoiraStorybookKeyOf(node),
      ]
    : [muirMoiraStorybookField(node, 'name')];
}

export function muirMoiraStorybookAssignmentRootWithoutUnwrap(
  node: unknown,
): unknown {
  return muirMoiraStorybookField(node, 'type') === 'MemberExpression'
    ? muirMoiraStorybookAssignmentRootWithoutUnwrap(
        muirMoiraStorybookField(node, 'object'),
      )
    : node;
}

/** Storybook 10.6.5 `keyOf`: a member's name, or `undefined` when only running the file gives it. */
export function muirMoiraStorybookKeyOf(member: unknown): unknown {
  if (muirMoiraStorybookField(member, 'property', 'type') === 'StringLiteral') {
    return muirMoiraStorybookField(member, 'property', 'value');
  }

  return muirMoiraStorybookField(member, 'computed') === true
    ? undefined
    : muirMoiraStorybookField(member, 'property', 'name');
}

/** Storybook 10.6.5 CsfFile indexes a `B.test('name', ...)` statement that is a plain call with a string-literal name and two or more arguments; this check also needs no spread argument, as only running the file tells which argument a spread fills. */
export function muirMoiraStorybookIsIndexedTestCall(
  statement: unknown,
): boolean {
  const call = muirMoiraStorybookField(statement, 'expression');
  const args = muirMoiraStorybookList(
    muirMoiraStorybookField(call, 'arguments'),
  );

  return (
    muirMoiraStorybookField(call, 'type') === 'CallExpression' &&
    muirMoiraStorybookField(call, 'callee', 'property', 'name') === 'test' &&
    args.length >= 2 &&
    muirMoiraStorybookField(args[0], 'type') === 'StringLiteral' &&
    !args.some(
      (arg) => muirMoiraStorybookField(arg, 'type') === 'SpreadElement',
    )
  );
}

const memberTypes: readonly unknown[] = [
  'MemberExpression',
  'OptionalMemberExpression',
];

export function muirMoiraStorybookIsMember(node: unknown): boolean {
  return memberTypes.includes(muirMoiraStorybookField(node, 'type'));
}

export function muirMoiraStorybookIsCall(node: unknown): boolean {
  const type = muirMoiraStorybookField(node, 'type');

  return type === 'CallExpression' || type === 'OptionalCallExpression';
}

export function muirMoiraStorybookMemberRoot(node: unknown): unknown {
  const current = muirMoiraStorybookUnwrap(node);

  return muirMoiraStorybookIsMember(current)
    ? muirMoiraStorybookMemberRoot(muirMoiraStorybookField(current, 'object'))
    : current;
}
