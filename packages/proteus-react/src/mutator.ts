import type { NodePath, types } from '@babel/core';

// `as const` though Stryker leaves it unmutated (https://github.com/stryker-mutator/stryker-js/issues/6208): the compiler rejects a call to a member it lacks.
export const muirProteusReactBabelTypeMembers = [
  'booleanLiteral',
  'cloneNode',
  'conditionalExpression',
  'identifier',
  'isBinaryExpression',
  'isBooleanLiteral',
  'isCallExpression',
  'isConditionalExpression',
  'isFunction',
  'isIdentifier',
  'isJSXAttribute',
  'isJSXElement',
  'isJSXEmptyExpression',
  'isJSXExpressionContainer',
  'isJSXFragment',
  'isJSXIdentifier',
  'isJSXText',
  'isLiteral',
  'isLogicalExpression',
  'isMemberExpression',
  'isNullLiteral',
  'isOptionalCallExpression',
  'isOptionalMemberExpression',
  'isStringLiteral',
  'isTSAsExpression',
  'isTSNonNullExpression',
  'isTSSatisfiesExpression',
  'isUnaryExpression',
  'jsxAttribute',
  'jsxClosingElement',
  'jsxElement',
  'jsxExpressionContainer',
  'jsxIdentifier',
  'jsxOpeningElement',
  'jsxText',
  'nullLiteral',
  'stringLiteral',
  'unaryExpression',
] as const satisfies readonly (keyof typeof types)[];

export type MuirProteusReactBabelTypes = Pick<
  typeof types,
  (typeof muirProteusReactBabelTypeMembers)[number]
> & {
  readonly react: Pick<typeof types.react, 'buildChildren'>;
};

export interface MuirProteusReactMutator {
  readonly name: string;
  readonly sample: string;
  readonly rules: readonly MuirProteusReactRule[];
}

// In place of `as const`: Stryker mutates nothing inside an `as` expression, which would leave every rule of the
// table out of a mutation run.
export function muirProteusReactMutatorTable<
  const T extends readonly MuirProteusReactMutator[],
>(table: T): T {
  return table;
}

export type MuirProteusReactRule =
  | MuirProteusReactAttributeRule
  | MuirProteusReactNodeRule;

export interface MuirProteusReactAttributeRule {
  readonly kind: 'attribute';
  readonly attributes: readonly string[] | RegExp;
  readonly on: {
    readonly bare?: 'remove';
    readonly string?: 'empty' | 'remove' | 'flip';
    readonly expression?: 'empty' | 'remove' | 'false' | 'negate';
  };
  skip?(
    site: MuirProteusReactAttributeSite,
    t: MuirProteusReactBabelTypes,
  ): boolean;
}

export interface MuirProteusReactNodeRule {
  readonly kind: 'node';
  mutate(path: NodePath, t: MuirProteusReactBabelTypes): Iterable<types.Node>;
}

export interface MuirProteusReactAttributeSite {
  readonly name: string;
  readonly value: MuirProteusReactAttributeValue;
  readonly element: MuirProteusReactElementSite;
  readonly path: NodePath<types.JSXAttribute>;
}

export type MuirProteusReactAttributeValue =
  | { readonly kind: 'bare' }
  | { readonly kind: 'string'; readonly text: string }
  | { readonly kind: 'expression'; readonly expression: types.Expression };

export interface MuirProteusReactElementSite {
  readonly name: string | undefined;
  readonly attributes: ReadonlySet<string>;
  readonly node: types.JSXElement;
}

type Replacement = NonNullable<
  MuirProteusReactAttributeRule['on'][keyof MuirProteusReactAttributeRule['on']]
>;

export interface MuirProteusReactNodeMutatorLike {
  readonly name: string;
  mutate(
    path: NodePath,
    context: { readonly isExpressionContext: boolean },
  ): Iterable<types.Node>;
}

export function muirProteusReactToNodeMutator(
  mutator: MuirProteusReactMutator,
  t: MuirProteusReactBabelTypes,
): MuirProteusReactNodeMutatorLike {
  return {
    name: mutator.name,
    *mutate(path) {
      const site = attributeSite(path, t);

      for (const rule of mutator.rules) {
        yield* rule.kind === 'node'
          ? rule.mutate(path, t)
          : attributeMutants(rule, site, t);
      }
    },
  };
}

function* attributeMutants(
  rule: MuirProteusReactAttributeRule,
  site: MuirProteusReactAttributeSite | undefined,
  t: MuirProteusReactBabelTypes,
): Iterable<types.JSXAttribute> {
  if (
    site === undefined ||
    !matches(rule.attributes, site.name) ||
    rule.skip?.(site, t) === true
  ) {
    return;
  }

  const replacement = rule.on[site.value.kind];

  if (replacement !== undefined) {
    yield* replaced(site, replacement, t);
  }
}

function matches(
  attributes: MuirProteusReactAttributeRule['attributes'],
  name: string,
): boolean {
  return attributes instanceof RegExp
    ? attributes.test(name)
    : attributes.includes(name);
}

function attributeSite(
  path: NodePath,
  t: MuirProteusReactBabelTypes,
): MuirProteusReactAttributeSite | undefined {
  if (!path.isJSXAttribute() || !t.isJSXIdentifier(path.node.name)) {
    return undefined;
  }

  const value = readValue(path.node.value, t);
  const element = muirProteusReactElementSiteOf(
    path.parentPath.parentPath?.node,
    t,
  );

  return value === undefined || element === undefined
    ? undefined
    : { name: path.node.name.name, value, element, path };
}

export function muirProteusReactElementSiteOf(
  node: types.Node | null | undefined,
  t: MuirProteusReactBabelTypes,
): MuirProteusReactElementSite | undefined {
  if (!t.isJSXElement(node)) {
    return undefined;
  }

  const { name, attributes } = node.openingElement;
  const names = attributes.flatMap(
    (entry) => muirProteusReactAttributeName(entry, t) ?? [],
  );

  return {
    name: t.isJSXIdentifier(name) ? name.name : undefined,
    attributes: new Set(names),
    node,
  };
}

export function muirProteusReactAttributeName(
  entry: types.JSXOpeningElement['attributes'][number],
  t: MuirProteusReactBabelTypes,
): string | undefined {
  return t.isJSXAttribute(entry) && t.isJSXIdentifier(entry.name)
    ? entry.name.name
    : undefined;
}

export function muirProteusReactDecodeValue(
  value: types.JSXAttribute['value'],
  t: MuirProteusReactBabelTypes,
): MuirProteusReactAttributeValue | { readonly kind: 'other' } {
  if (value === null || value === undefined) {
    return { kind: 'bare' };
  }

  if (t.isStringLiteral(value)) {
    return { kind: 'string', text: value.value };
  }

  return t.isJSXExpressionContainer(value) &&
    !t.isJSXEmptyExpression(value.expression)
    ? { kind: 'expression', expression: value.expression }
    : { kind: 'other' };
}

function readValue(
  value: types.JSXAttribute['value'],
  t: MuirProteusReactBabelTypes,
): MuirProteusReactAttributeValue | undefined {
  const decoded = muirProteusReactDecodeValue(value, t);

  if (decoded.kind === 'other') {
    return undefined;
  }

  // The built-in StringLiteral, BooleanLiteral, ArrowFunction and BlockStatement mutators own these.
  return decoded.kind === 'expression' &&
    (t.isLiteral(decoded.expression) || t.isFunction(decoded.expression))
    ? undefined
    : decoded;
}

function* replaced(
  site: MuirProteusReactAttributeSite,
  replacement: Replacement,
  t: MuirProteusReactBabelTypes,
): Iterable<types.JSXAttribute> {
  const name = t.jsxIdentifier(site.name);
  const { value } = site;

  switch (replacement) {
    case 'empty': {
      if (value.kind !== 'string' || value.text !== '') {
        yield t.jsxAttribute(name, t.stringLiteral(''));
      }

      return;
    }

    case 'remove': {
      if (!removalChangesNothing(site, t)) {
        yield t.jsxAttribute(
          name,
          t.jsxExpressionContainer(t.identifier('undefined')),
        );
      }

      return;
    }

    case 'false': {
      yield t.jsxAttribute(
        name,
        t.jsxExpressionContainer(t.booleanLiteral(false)),
      );

      return;
    }

    case 'negate': {
      const negated =
        value.kind === 'expression' ? negation(value.expression, t) : undefined;

      if (negated !== undefined) {
        yield t.jsxAttribute(name, t.jsxExpressionContainer(negated));
      }

      return;
    }

    case 'flip': {
      if (value.kind === 'string') {
        yield t.jsxAttribute(name, t.stringLiteral(flipped(value.text)));
      }

      return;
    }
  }
}

// Playwright reads only aria-hidden="true", so removing "false" changes nothing. aria-disabled="false" is
// not like it: it stops a disabled ancestor from disabling the element (hasAriaDisabledInChain).
function removalChangesNothing(
  { name, value }: MuirProteusReactAttributeSite,
  t: MuirProteusReactBabelTypes,
): boolean {
  return (
    (value.kind === 'string' &&
      value.text === 'false' &&
      name === 'aria-hidden') ||
    (value.kind === 'expression' &&
      t.isIdentifier(value.expression, { name: 'undefined' }))
  );
}

// `!(expr)` is always false for a string value, as in `!(c ? 'true' : 'false')` and `!String(open)`.
function negation(
  expression: types.Expression,
  t: MuirProteusReactBabelTypes,
): types.Expression | undefined {
  const value = withoutTypeWrapper(expression, t);

  if (t.isConditionalExpression(value)) {
    const consequent = negation(value.consequent, t);
    const alternate = negation(value.alternate, t);

    return consequent === undefined && alternate === undefined
      ? undefined
      : t.conditionalExpression(
          t.cloneNode(value.test, true),
          consequent ?? t.cloneNode(value.consequent, true),
          alternate ?? t.cloneNode(value.alternate, true),
        );
  }

  if (t.isStringLiteral(value)) {
    return t.stringLiteral(flipped(value.value));
  }

  if (t.isBooleanLiteral(value)) {
    return t.booleanLiteral(!value.value);
  }

  if (
    t.isLiteral(value) ||
    t.isIdentifier(value, { name: 'undefined' }) ||
    isStringCall(value, t)
  ) {
    return undefined;
  }

  return t.unaryExpression('!', t.cloneNode(expression, true));
}

function flipped(text: string): string {
  return text === 'true' ? 'false' : 'true';
}

function withoutTypeWrapper(
  expression: types.Expression,
  t: MuirProteusReactBabelTypes,
): types.Expression {
  return t.isTSAsExpression(expression) ||
    t.isTSSatisfiesExpression(expression) ||
    t.isTSNonNullExpression(expression)
    ? withoutTypeWrapper(expression.expression, t)
    : expression;
}

function isStringCall(
  expression: types.Expression,
  t: MuirProteusReactBabelTypes,
): boolean {
  if (
    !t.isCallExpression(expression) &&
    !t.isOptionalCallExpression(expression)
  ) {
    return false;
  }

  const { callee } = expression;

  return (
    t.isIdentifier(callee, { name: 'String' }) ||
    ((t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) &&
      t.isIdentifier(callee.property, { name: 'toString' }))
  );
}

export function muirProteusReactIsJsxChild(path: NodePath): boolean {
  return (
    path.parentPath?.isJSXElement() === true ||
    path.parentPath?.isJSXFragment() === true
  );
}
