import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { traverse, types as t } from '@babel/core';

import {
  muirProteusJsxElementSiteOf,
  muirProteusJsxToNodeMutator,
} from '../src/mutator.ts';
import { muirProteusJsxMutatorsFor } from '../src/mutators.ts';
import type { MuirProteusJsxRoleTable } from '../src/implicit-roles.ts';
import { parse } from './support/babel.ts';
import { defined } from './support/defined.ts';

function elementRoleMutants(
  code: string,
  roles: MuirProteusJsxRoleTable,
): string[] {
  const file = parse(code);
  const mutator = muirProteusJsxToNodeMutator(
    defined(
      muirProteusJsxMutatorsFor(roles).find(
        ({ name }) => name === 'MuirProteusJsxElementRole',
      ),
    ),
    t,
  );
  const show = (node: t.Node): string => {
    const element = muirProteusJsxElementSiteOf(node, t);

    return element === undefined
      ? node.type
      : `<${[element.name, ...element.attributes].join(' ')}>`;
  };
  const found: string[] = [];

  traverse(file, {
    enter(path) {
      const node = path.isJSXAttribute() ? path.parentPath.parent : path.node;
      found.push(
        ...[...mutator.mutate(path, { isExpressionContext: true })].map(
          (replacement) => `${show(node)} -> ${show(replacement)}`,
        ),
      );
    },
  });

  return found;
}

describe('MuirProteusJsxElementRole', () => {
  it('swaps for a span exactly the elements whose role in the table is button or link', () => {
    const roles: MuirProteusJsxRoleTable = new Map([
      ['div', { role: 'button' }],
      ['nav', { role: 'link', requiredAttribute: 'data-to' }],
      ['p', { role: 'paragraph' }],
    ]);

    assert.deepEqual(
      elementRoleMutants(
        '<div><nav data-to="x" /><nav /><p /><button /><a href="/" /></div>;',
        roles,
      ),
      ['<div> -> <span>', '<nav data-to> -> <span data-to>'],
    );
  });

  it('keeps a role attribute that restates the role the table gives', () => {
    const roles: MuirProteusJsxRoleTable = new Map([
      ['div', { role: 'button' }],
    ]);

    assert.deepEqual(
      elementRoleMutants(
        '<b><div role="button" /><p role="button" /></b>;',
        roles,
      ),
      ['<div role> -> <span role>', '<p role> -> JSXAttribute'],
    );
  });
});
