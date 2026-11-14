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

/** Where a user-event receiver comes from, as far as the file proves it. */
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

/** The origins a value may have; `undefined` for a value that may be no user-event. */
type MayOrigins = readonly (UserEventOrigin | undefined)[];

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
  program: unknown,
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

  /** Whether `reference` uses what it names only through a member, or destructures it in a declaration. */
  const readsMembers = (reference: unknown): boolean => {
    const parent = tree.parentOf(reference);

    if (field(parent, 'type') === 'VariableDeclarator') {
      return field(parent, 'id', 'type') === 'ObjectPattern';
    }

    return isMember(parent) && field(parent, 'object') === reference;
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

  const referencesOf = Map.groupBy(scope.referencesIn(program), (reference) =>
    scope.bindingOf(reference),
  );
  /** The play context bindings whose every reference uses a member. */
  const readContexts: ReadonlySet<Binding> = new Set(
    [...referencesOf].flatMap(([binding, references]) =>
      binding?.kind === 'param' &&
      isUnwrittenContext(binding, binding.identifier) &&
      references.every(readsMembers)
        ? [binding]
        : [],
    ),
  );

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

  /** What `node` holds: a module's exports, the play context while every reference to its name uses a member, or an object the file proves nothing about. */
  const holderOf = (node: unknown): Holder => {
    const module = moduleOf(node);

    if (module !== undefined) {
      return { module };
    }

    const binding = scope.bindingOf(unwrap(node));

    return binding !== undefined && readContexts.has(binding)
      ? 'playContext'
      : 'unknown';
  };

  const bindingOrigins = (binding: Binding): MayOrigins => {
    if (binding.kind === 'import') {
      return [
        exportOrigin(importedName(binding.declaration), importSource(binding)),
      ];
    }

    if (field(binding.declaration, 'type') === 'VariableDeclarator') {
      const id = unwrap(field(binding.declaration, 'id'));
      const value = oneValue(binding);

      if (id === binding.identifier) {
        return valueOrigins(value);
      }

      return [
        id === userEventPattern(binding.identifier)
          ? originFrom(holderOf(awaited(value)), 'userEvent')
          : undefined,
      ];
    }

    const pattern =
      binding.kind === 'param'
        ? userEventPattern(binding.identifier)
        : undefined;

    if (pattern === undefined) {
      return [undefined];
    }

    return [
      originFrom(
        isUnwrittenContext(binding, pattern) ? 'playContext' : 'unknown',
        'userEvent',
      ),
    ];
  };

  /** The origins a local's one value, or the root of a written member, may have: a user-event's `setup()`, another receiver, either arm of a conditional or logical expression, or a sequence's last value. */
  const valueOrigins = (value: unknown): MayOrigins => {
    const node = unwrap(value);

    if (field(node, 'type') === 'ConditionalExpression') {
      return distinct(
        [field(node, 'consequent'), field(node, 'alternate')].flatMap(
          originsIn,
        ),
      );
    }

    if (field(node, 'type') === 'LogicalExpression') {
      return distinct(
        [field(node, 'left'), field(node, 'right')].flatMap(originsIn),
      );
    }

    if (field(node, 'type') === 'SequenceExpression') {
      return valueOrigins(list(field(node, 'expressions')).at(-1));
    }

    return originsIn(setupReceiver(node) ?? node);
  };

  /**
   * Each binding's origins, followed once. While a binding is followed it holds `[undefined]`, so a read of it from
   * inside its own value, or from another member of its cycle, gets only what its name alone gives. A member cached
   * mid-cycle may lack origins reached through the entry, but the write or receiver that entered the cycle collects
   * them, so no order of resolution changes a result.
   */
  const knownOrigins = new Map<Binding, MayOrigins>();
  /** The origins `receiver` may have; a member under a key the file does not name may be the holder's `userEvent`. */
  const originsIn = (receiver: unknown): MayOrigins => {
    const node = unwrap(receiver);

    if (isMember(node)) {
      const holder = holderOf(field(node, 'object'));
      const key = memberName(node);

      return key === undefined
        ? [undefined, originFrom(holder, 'userEvent')]
        : [originFrom(holder, key)];
    }

    const binding = scope.bindingOf(node);
    const named = originFrom('unknown', field(node, 'name'));

    if (binding === undefined) {
      return [named];
    }

    let origins = knownOrigins.get(binding);

    if (origins === undefined) {
      knownOrigins.set(binding, [undefined]);
      origins = bindingOrigins(binding);
      knownOrigins.set(binding, origins);
    }

    return origins.map((origin) => origin ?? named);
  };

  /** The origins the root of a written chain may have: it splits choices, sequences and `=` assignments at every level, and reads anything else as a local's one value. */
  const rootOrigins = (value: unknown): MayOrigins => {
    const node = unwrap(value);

    return valuesOf(node)?.flatMap(rootOrigins) ?? valueOrigins(node);
  };
  /** The origins of `node` and of each object a member expression reads, down to its root. */
  const chainOrigins = (node: unknown): MayOrigins =>
    isMember(node)
      ? [...originsIn(node), ...chainOrigins(unwrap(field(node, 'object')))]
      : rootOrigins(node);
  /** The origins of each member a write targets and of every object in its chain; a receiver of any of them is unproven. */
  const writtenOrigins: ReadonlySet<UserEventOrigin> = new Set(
    scope.writtenMembers
      .flatMap((member) => chainOrigins(unwrap(member)))
      .filter((origin) => origin !== undefined),
  );

  return (receiver) => {
    const origin = provenOrigin(originsIn(receiver));

    return origin !== undefined && writtenOrigins.has(origin)
      ? 'unproven'
      : origin;
  };
}

/** The origin a value proves from the origins it may have: none unless each is a user-event, and unproven when they differ. */
function provenOrigin(origins: MayOrigins): UserEventOrigin | undefined {
  const [first] = origins;

  if (origins.includes(undefined)) {
    return undefined;
  }

  return origins.every((origin) => origin === first) ? first : 'unproven';
}

/** Each origin once, so a value that reads another twice holds no more entries than it. */
function distinct(origins: MayOrigins): MayOrigins {
  return [...new Set(origins)];
}

/** The values `node` may evaluate to when it is a choice, a sequence or an `=` assignment; `undefined` for any other node. */
function valuesOf(node: unknown): readonly unknown[] | undefined {
  switch (field(node, 'type')) {
    case 'ConditionalExpression': {
      return [field(node, 'consequent'), field(node, 'alternate')];
    }
    case 'LogicalExpression': {
      return [field(node, 'left'), field(node, 'right')];
    }
    case 'SequenceExpression': {
      return list(field(node, 'expressions')).slice(-1);
    }
    case 'AssignmentExpression': {
      return field(node, 'operator') === '='
        ? [field(node, 'right')]
        : undefined;
    }
    default: {
      return undefined;
    }
  }
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
    field(write, 'operator') === '=' ? field(write, 'right') : undefined,
  );
  const init = field(binding.declaration, 'init');
  const values = [...(isNode(init) ? [init] : []), ...assigned];

  return values.length === 1 ? values[0] : undefined;
}
