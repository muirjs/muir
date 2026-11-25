import type { types } from '@babel/core';
import { muirMoiraStorybookField } from '@muirjs/moira-storybook';

// The Testing Library queries, by what they match.
export const muirProteusStorybookTestQueryKinds: readonly string[] = [
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
export function muirProteusStorybookTestQueryMethods(
  prefixes: readonly string[],
  kinds: readonly string[] = muirProteusStorybookTestQueryKinds,
): readonly string[] {
  return prefixes.flatMap((prefix) => kinds.map((kind) => `${prefix}${kind}`));
}

/** The prefixes of the queries for one element. */
export const muirProteusStorybookTestElementQueryPrefixes: readonly string[] = [
  'getBy',
  'findBy',
  'queryBy',
];

/** `<x>.getBy<Query>(...)`, `<x>.findBy<Query>(...)` or `<x>.queryBy<Query>(...)`: a Testing Library query for one element. */
export function muirProteusStorybookTestIsQueryCall(node: types.Node): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    elementQueries.has(muirMoiraStorybookField(node.callee.property, 'name'))
  );
}

const elementQueries: ReadonlySet<unknown> = new Set(
  muirProteusStorybookTestQueryMethods(
    muirProteusStorybookTestElementQueryPrefixes,
  ),
);
