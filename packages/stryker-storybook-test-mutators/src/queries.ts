import type { types } from '@babel/core';

import { nameOf } from './nodes.ts';

// The Testing Library queries, by what they match.
export const queryKinds: readonly string[] = [
  'Role',
  'LabelText',
  'PlaceholderText',
  'Text',
  'DisplayValue',
  'AltText',
  'Title',
  'TestId',
];

/** The Testing Library query methods with one of the prefixes, such as `getBy` or `findAllBy`, and one of the kinds. */
export function queryMethods(
  prefixes: readonly string[],
  kinds: readonly string[] = queryKinds,
): readonly string[] {
  return prefixes.flatMap((prefix) => kinds.map((kind) => `${prefix}${kind}`));
}

/** The prefixes of the queries for one element. */
export const elementQueryPrefixes: readonly string[] = [
  'getBy',
  'findBy',
  'queryBy',
];

/** `<x>.getBy<Query>(...)`, `<x>.findBy<Query>(...)` or `<x>.queryBy<Query>(...)`: a Testing Library query for one element. */
export function isQueryCall(node: types.Node): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    elementQueries.includes(nameOf(node.callee.property) ?? '')
  );
}

const elementQueries = queryMethods(elementQueryPrefixes);
