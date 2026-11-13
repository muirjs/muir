import { isMember, unwrap } from './csf-nodes.ts';
import { field, list } from './node-field.ts';
import {
  awaited,
  importSourceOf,
  isNode,
  memberName,
  type TreeIndex,
} from './node-tree.ts';
import { propertyKey } from './object-value.ts';
import type { Binding, FileScope } from './scope.ts';

/** Where a user-event receiver comes from, as far as the file proves it. The test mutators take any origin; the reporter takes only `userEvent14`. */
export type UserEventOrigin = 'userEvent14' | 'vitestBrowser' | 'unproven';

/** The user-event methods that act on the page: those of user-event 14 (`@testing-library/user-event`, which `storybook/test` re-exports) and those only Vitest browser's userEvent has. */
export const userEventMethods: ReadonlySet<string> = new Set([
  'fill',
  'dragAndDrop',
  'wheel',
  'click',
  'dblClick',
  'tripleClick',
  'hover',
  'unhover',
  'tab',
  'keyboard',
  'pointer',
  'type',
  'clear',
  'selectOptions',
  'deselectOptions',
  'upload',
  'copy',
  'cut',
  'paste',
]);

/** The modules whose `userEvent` export is a user-event, and which one. */
const moduleOrigins: ReadonlyMap<unknown, UserEventOrigin> = new Map([
  ['storybook/test', 'userEvent14'],
  ['@testing-library/user-event', 'userEvent14'],
  ['vitest/browser', 'vitestBrowser'],
  ['@vitest/browser/context', 'vitestBrowser'],
] as const);

/** The one user-event module whose default export is a user-event. */
const defaultExportModule = '@testing-library/user-event';

/** The export name an import specifier imports: `default` for a default import, or a named import's identifier or string name. */
function importedName(specifier: unknown): unknown {
  return field(specifier, 'type') === 'ImportDefaultSpecifier'
    ? 'default'
    : (field(specifier, 'imported', 'name') ??
        field(specifier, 'imported', 'value'));
}

/** The origin of the export `name` of the module `source`: `userEvent` of a user-event module, or the default export of the one user-event module that has one. */
function exportOrigin(
  name: unknown,
  source: unknown,
): UserEventOrigin | undefined {
  if (name === 'default') {
    return source === defaultExportModule ? 'userEvent14' : undefined;
  }

  return name === 'userEvent' ? moduleOrigins.get(source) : undefined;
}

function withoutDefault(pattern: unknown): unknown {
  return field(pattern, 'type') === 'AssignmentPattern'
    ? field(pattern, 'left')
    : pattern;
}

/** Gives the origin of a receiver, or `undefined` when it is no user-event. A test function is one Storybook runs with its play context as the first argument. */
export function userEventOrigins(
  tree: TreeIndex,
  scope: FileScope,
  testFunctions: ReadonlySet<unknown>,
): (receiver: unknown) => UserEventOrigin | undefined {
  const isPlayContext = (param: unknown): boolean => {
    const owner = tree.parentOf(param);

    return (
      testFunctions.has(owner) && list(field(owner, 'params'))[0] === param
    );
  };

  /** Whether `root`, a test function's first parameter with any default aside, declares `binding`, and nothing writes it. */
  const isUnwrittenContext = (binding: Binding, root: unknown): boolean =>
    root === withoutDefault(binding.declaration) &&
    isPlayContext(binding.declaration) &&
    binding.writes.length === 0;

  /** The pattern that holds `identifier` under the key `userEvent`, a default aside. */
  const userEventPattern = (identifier: unknown): unknown => {
    const parent = tree.parentOf(identifier);
    const property =
      field(parent, 'type') === 'AssignmentPattern'
        ? tree.parentOf(parent)
        : parent;

    return field(property, 'type') === 'ObjectProperty' &&
      propertyKey(property) === 'userEvent'
      ? tree.parentOf(property)
      : undefined;
  };

  const bindingOrigin = (
    binding: Binding,
    seen: ReadonlySet<Binding>,
  ): UserEventOrigin | undefined => {
    if (binding.kind === 'import') {
      return exportOrigin(
        importedName(binding.declaration),
        importSource(binding),
      );
    }

    if (field(binding.declaration, 'type') === 'VariableDeclarator') {
      const id = unwrap(field(binding.declaration, 'id'));
      const value = oneValue(binding);

      if (id === binding.identifier) {
        return valueOrigin(value, seen);
      }

      return id === userEventPattern(binding.identifier)
        ? destructuredOrigin(awaited(value))
        : undefined;
    }

    const pattern =
      binding.kind === 'param'
        ? userEventPattern(binding.identifier)
        : undefined;

    if (pattern === undefined) {
      return undefined;
    }

    return isUnwrittenContext(binding, pattern) ? 'userEvent14' : 'unproven';
  };

  const importSource = (binding: Binding): unknown =>
    field(tree.parentOf(binding.declaration), 'source', 'value');
  /** The module whose exports `node` holds: a namespace import that it names, or an `import()`. */
  const moduleOf = (node: unknown): unknown => {
    const binding = scope.bindingOf(unwrap(node));

    return binding?.kind === 'import' &&
      field(binding.declaration, 'type') === 'ImportNamespaceSpecifier'
      ? importSource(binding)
      : field(importSourceOf(awaited(node)), 'value');
  };
  /** Whether `node` names a test function's play context parameter that nothing writes. */
  const isPlayContextName = (node: unknown): boolean => {
    const binding = scope.bindingOf(unwrap(node));

    return (
      binding?.kind === 'param' &&
      isUnwrittenContext(binding, binding.identifier)
    );
  };
  /** The origin of `{ userEvent: x } = value`: from a user-event module's exports, or from a play context. */
  const destructuredOrigin = (value: unknown): UserEventOrigin | undefined =>
    exportOrigin('userEvent', moduleOf(value)) ??
    (isPlayContextName(value) ? 'userEvent14' : undefined);
  /** The origin of `<object>.userEvent`. */
  const contextMemberOrigin = (object: unknown): UserEventOrigin =>
    isPlayContextName(object) ? 'userEvent14' : 'unproven';
  const memberOrigin = (member: unknown): UserEventOrigin | undefined => {
    const name = memberName(member);
    const object = field(member, 'object');

    return (
      exportOrigin(name, moduleOf(object)) ??
      (name === 'userEvent' ? contextMemberOrigin(object) : undefined)
    );
  };

  /** The origin of a local's one value: a user-event's `setup()`, another receiver, or a choice between two receivers. */
  const valueOrigin = (
    value: unknown,
    seen: ReadonlySet<Binding>,
  ): UserEventOrigin | undefined => {
    const node = unwrap(value);

    if (field(node, 'type') === 'ConditionalExpression') {
      return choiceOrigin(
        originIn(field(node, 'consequent'), seen),
        originIn(field(node, 'alternate'), seen),
      );
    }

    return originIn(setupReceiver(node) ?? node, seen);
  };
  /** The origin of `receiver`, where `seen` holds the locals already followed, so a local whose value reads itself ends the search. */
  const originIn = (
    receiver: unknown,
    seen: ReadonlySet<Binding>,
  ): UserEventOrigin | undefined => {
    const node = unwrap(receiver);

    if (isMember(node)) {
      return memberOrigin(node);
    }

    const binding = scope.bindingOf(node);
    const origin =
      binding === undefined || seen.has(binding)
        ? undefined
        : bindingOrigin(binding, new Set([...seen, binding]));

    return (
      origin ?? (field(node, 'name') === 'userEvent' ? 'unproven' : undefined)
    );
  };

  return (receiver) => originIn(receiver, new Set());
}

/** The origin of a choice between two receivers: none unless both are user-events, and unproven when they differ. */
function choiceOrigin(
  first: UserEventOrigin | undefined,
  second: UserEventOrigin | undefined,
): UserEventOrigin | undefined {
  if (first === undefined || second === undefined) {
    return undefined;
  }

  return first === second ? first : 'unproven';
}

/** The receiver of `<receiver>.setup()`. */
function setupReceiver(value: unknown): unknown {
  const call = unwrap(value);
  const callee = field(call, 'callee');

  return field(call, 'type') === 'CallExpression' &&
    memberName(callee) === 'setup'
    ? field(callee, 'object')
    : undefined;
}

/** The one value a local is ever given, by its declarator's `init` or a later `=`; `undefined` when anything else, such as `++`, a `for...of` head or a second `var`, also changes it. */
function oneValue(binding: Binding): unknown {
  const assigned = binding.writes.map((write) =>
    field(write, 'type') === 'AssignmentExpression' &&
    field(write, 'operator') === '='
      ? field(write, 'right')
      : undefined,
  );
  const init = field(binding.declaration, 'init');
  const values = [...(isNode(init) ? [init] : []), ...assigned];

  return values.length === 1 ? values[0] : undefined;
}
