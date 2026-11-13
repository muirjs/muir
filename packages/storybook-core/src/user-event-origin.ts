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

/** What a receiver is read from: a module's exports, the play context, or an object the file proves nothing about. */
type Holder = { readonly module: unknown } | 'playContext' | 'unknown';

/** The origin of the property `key` of `holder`: a user-event export of its module, the play context's `userEvent`, or any other `userEvent`, which is unproven. */
function originFrom(holder: Holder, key: unknown): UserEventOrigin | undefined {
  const exported =
    typeof holder === 'object' ? exportOrigin(key, holder.module) : undefined;

  if (exported !== undefined || key !== 'userEvent') {
    return exported;
  }

  return holder === 'playContext' ? 'userEvent14' : 'unproven';
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

  /** Whether `reference` reads a member of what it names, or destructures it in a declaration, and so leaves its members as they are. */
  const readsMembers = (reference: unknown): boolean => {
    const parent = tree.parentOf(reference);

    if (field(parent, 'type') === 'VariableDeclarator') {
      return (
        field(parent, 'init') === reference &&
        field(parent, 'id', 'type') === 'ObjectPattern'
      );
    }

    return (
      isMember(parent) &&
      field(parent, 'object') === reference &&
      !isAssigned(parent)
    );
  };

  /** Whether an assignment writes `member`, or a member read from it. */
  const isAssigned = (member: unknown): boolean => {
    const parent = tree.parentOf(member);

    return (
      (field(parent, 'type') === 'AssignmentExpression' &&
        field(parent, 'left') === member) ||
      (isMember(parent) &&
        field(parent, 'object') === member &&
        isAssigned(parent))
    );
  };

  /** What `node` holds: a module's exports, the play context while every reference to its name reads members, or an object the file proves nothing about. */
  const holderOf = (node: unknown): Holder => {
    const module = moduleOf(node);

    if (module !== undefined) {
      return { module };
    }

    const binding = scope.bindingOf(unwrap(node));

    return binding?.kind === 'param' &&
      isUnwrittenContext(binding, binding.identifier) &&
      scope
        .referencesIn(tree.parentOf(binding.declaration))
        .filter((reference) => scope.bindingOf(reference) === binding)
        .every(readsMembers)
      ? 'playContext'
      : 'unknown';
  };

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
        ? originFrom(holderOf(awaited(value)), 'userEvent')
        : undefined;
    }

    const pattern =
      binding.kind === 'param'
        ? userEventPattern(binding.identifier)
        : undefined;

    if (pattern === undefined) {
      return undefined;
    }

    return originFrom(
      isUnwrittenContext(binding, pattern) ? 'playContext' : 'unknown',
      'userEvent',
    );
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
      return originFrom(holderOf(field(node, 'object')), memberName(node));
    }

    const binding = scope.bindingOf(node);
    const origin =
      binding === undefined || seen.has(binding)
        ? undefined
        : bindingOrigin(binding, new Set([...seen, binding]));

    return origin ?? originFrom('unknown', field(node, 'name'));
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
