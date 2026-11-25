import type { types } from '@babel/core';
import { field, type Interaction } from '@layzee/storybook-core';
import {
  firstArgumentSite,
  roleSite,
  swapMutator,
  type Site,
} from '@layzee/stryker-mutator-install';

import {
  elementQueryPrefixes,
  isQueryCall,
  queryKinds,
  queryMethods,
} from './queries.ts';
import type { LzStorybookTestMutator } from './mutator.ts';
import { packageName } from './package-name.ts';
import { placedInteractionAimedAt, placedInteractionAt } from './story-file.ts';

function sampleOf(statement: string): string {
  return `export const Story = {\n  play: async ({ canvas, userEvent }) => {\n    ${statement}\n  },\n};\n`;
}

const clickMethods: ReadonlySet<unknown> = new Set(['click', 'dblClick']);

/** A click target with no effects of its own: an identifier, a query, or an awaited query, any of them under `!`. `value` is what the target reads: for a name bound once by `const`, that const's init. */
function focusTarget(
  target: types.Node | undefined,
  value: types.Node | undefined,
): types.Expression | undefined {
  if (target?.type === 'TSNonNullExpression') {
    return focusTarget(target.expression, value) === undefined
      ? undefined
      : target;
  }

  if (target?.type === 'Identifier') {
    return value !== undefined && isTextFieldQuery(value) ? undefined : target;
  }

  if (target?.type !== 'AwaitExpression' && target?.type !== 'CallExpression') {
    return undefined;
  }

  const query = target.type === 'AwaitExpression' ? target.argument : target;

  return isQueryCall(query) && !isTextFieldQuery(query) ? target : undefined;
}

// Queries that find form fields, which a click is meant to focus.
const fieldQueries = queryMethods(elementQueryPrefixes, [
  'LabelText',
  'PlaceholderText',
]);

/** A query for a text field: by a text field role, by label or by placeholder. */
function isTextFieldQuery(query: types.Node): boolean {
  const role = queryRole(query);

  return (
    (role !== undefined && textFieldRoles.includes(role)) ||
    callsOneOf(query, fieldQueries)
  );
}

/** Whether `call` is `<x>.<method>(...)` for one of `methods`. */
function callsOneOf(call: types.Node, methods: readonly unknown[]): boolean {
  return methods.includes(methodOf(call));
}

/** The method name of `<x>.<method>(...)`. */
function methodOf(call: types.Node): string | undefined {
  return call.type === 'CallExpression' &&
    call.callee.type === 'MemberExpression' &&
    call.callee.property.type === 'Identifier'
    ? call.callee.property.name
    : undefined;
}

// Clicking an element of these roles is meant to focus it.
const textFieldRoles: readonly string[] = ['textbox', 'searchbox', 'combobox'];

const roleQueries = queryMethods(elementQueryPrefixes, ['Role']);

/** The role a `*ByRole` query names in a string literal. */
function queryRole(query: types.Node): string | undefined {
  if (query.type !== 'CallExpression' || !callsOneOf(query, roleQueries)) {
    return undefined;
  }

  const [role] = query.arguments;

  return role?.type === 'StringLiteral' ? role.value : undefined;
}

export function clickFocusMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookClickFocus';
} {
  return {
    name: 'LzStorybookClickFocus',
    sample: sampleOf('await userEvent.click(button);'),
    *mutate(path, t) {
      const interaction = placedInteractionAt(path);

      if (
        interaction?.kind !== 'userEvent' ||
        !clickMethods.has(interaction.method)
      ) {
        return;
      }

      const [first] = interaction.args;
      const value = interaction.targetValue;
      const target = t.isNode(first)
        ? focusTarget(first, t.isNode(value) ? value : undefined)
        : undefined;

      if (target === undefined) {
        return;
      }

      const focus = t.callExpression(
        t.memberExpression(t.cloneNode(target), t.identifier('focus')),
        [],
      );

      yield path.isExpressionStatement()
        ? t.expressionStatement(
            path.node.expression.type === 'AwaitExpression'
              ? t.awaitExpression(focus)
              : focus,
          )
        : focus;
    },
  };
}

const repeatedMethods: ReadonlySet<unknown> = new Set([
  'click',
  'dblClick',
  'keyboard',
]);

/** A fireEvent click, or a user-event click, dblClick or key press other than one that a second press repeats with no change. */
function isRepeated(interaction: Interaction): boolean {
  if (interaction.kind === 'fireEvent') {
    return interaction.method === 'click';
  }

  const [key] = interaction.args;

  return (
    interaction.kind === 'userEvent' &&
    repeatedMethods.has(interaction.method) &&
    !(
      interaction.method === 'keyboard' &&
      idempotentKeys.has(field(key, 'value'))
    )
  );
}

const idempotentKeys: ReadonlySet<unknown> = new Set(['{Home}', '{End}']);

export function interactionRepeatMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookInteractionRepeat';
} {
  return {
    name: 'LzStorybookInteractionRepeat',
    sample: sampleOf('await userEvent.click(button);'),
    *mutate(path, t) {
      const interaction = placedInteractionAt(path);

      if (interaction === undefined || !isRepeated(interaction)) {
        return;
      }

      if (path.isExpressionStatement()) {
        yield t.blockStatement([
          t.cloneNode(path.node),
          t.cloneNode(path.node),
        ]);

        return;
      }

      if (!path.isExpression()) {
        throw new Error(
          // Stryker disable next-line StringLiteral: no input reaches this throw, as an interaction is an expression statement or an arrow's expression body, and an arrow's expression body is an expression
          `${packageName}: LzStorybookInteractionRepeat read an interaction at a ${path.node.type}, which is neither an expression statement nor an expression`,
        );
      }

      // fireEvent dispatches synchronously, so the second click runs at once; a user-event call is awaited before the next.
      if (interaction.kind === 'fireEvent') {
        const call = path.isAwaitExpression() ? path.node.argument : path.node;

        yield t.sequenceExpression([t.cloneNode(call), t.cloneNode(call)]);

        return;
      }

      const twice = [path.node, path.node].map((body) =>
        t.expressionStatement(t.awaitExpression(t.cloneNode(body))),
      );

      yield t.callExpression(
        t.arrowFunctionExpression([], t.blockStatement(twice), true),
        [],
      );
    },
  };
}

const roleQuerySite = roleSite(roleQueries);
const argumentQuerySite = firstArgumentSite(
  queryMethods(
    elementQueryPrefixes,
    queryKinds.filter((kind) => kind !== 'Role'),
  ),
);

/** The `name` of a `*ByRole(role, { name })` query, keyed by its role, or the first argument of another query. */
function querySite(call: unknown): Site | undefined {
  return roleQuerySite(call) ?? argumentQuerySite(call);
}

export function interactionTargetMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookInteractionTarget';
} {
  const swap = swapMutator(
    'LzStorybookInteractionTarget',
    sampleOf(
      "await userEvent.click(canvas.getByRole('button', { name: 'a' }));\n    await userEvent.click(canvas.getByRole('button', { name: 'b' }));",
    ),
    querySite,
  );

  return {
    name: swap.name,
    sample: swap.sample,
    *mutate(path, t) {
      if (placedInteractionAimedAt(path) === undefined) {
        return;
      }

      yield* [...swap.mutate(path, { cloneNode: (node) => node })]
        .filter((node) => t.isNode(node))
        .map((node) => t.cloneNode(node));
    },
  };
}

export function assertionBeforeMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookAssertionBefore';
} {
  return {
    name: 'LzStorybookAssertionBefore',
    sample: sampleOf(
      'await userEvent.click(button);\n    await expect(args.onClick).toHaveBeenCalled();',
    ),
    *mutate(path, t) {
      const statements = [
        placedInteractionAt(path)?.following.copy,
        path.node,
      ].filter((node) => t.isNode(node) && t.isStatement(node));

      if (statements.length < 2) {
        return;
      }

      yield t.blockStatement(statements.map((node) => t.cloneNode(node)));
    },
  };
}

export function interactionMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookInteraction';
} {
  return {
    name: 'LzStorybookInteraction',
    sample: sampleOf("await userEvent.click(canvas.getByRole('button'));"),
    *mutate(path, t) {
      if (placedInteractionAt(path) !== undefined) {
        yield path.isExpressionStatement()
          ? t.emptyStatement()
          : t.identifier('undefined');
      }
    },
  };
}
