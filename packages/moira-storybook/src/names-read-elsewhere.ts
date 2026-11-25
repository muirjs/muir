import type { MuirMoiraStorybookBindings } from './bindings.ts';
import {
  muirMoiraStorybookAssignmentOf,
  muirMoiraStorybookAssignmentRootWithoutUnwrap,
  muirMoiraStorybookDeclarationOf,
  muirMoiraStorybookIsIndexedTestCall,
  muirMoiraStorybookIsMember,
  muirMoiraStorybookIsStoryFactoryCall,
  muirMoiraStorybookMemberRoot,
  muirMoiraStorybookStoryArgument,
  muirMoiraStorybookUnwrap,
  type MuirMoiraStorybookAssignment,
} from './csf-nodes.ts';
import { muirMoiraStorybookIsRecord } from './is-record.ts';
import {
  muirMoiraStorybookField,
  muirMoiraStorybookList,
} from './node-field.ts';

interface NamesReadElsewhere {
  readonly usedOutsideReadForms: ReadonlySet<unknown>;
  readonly sharingWithWritten: ReadonlySet<unknown>;
  readonly written: ReadonlySet<unknown>;
  readonly readByOtherObjects: ReadonlySet<unknown>;
}

export function muirMoiraStorybookNamesReadElsewhere(
  body: readonly unknown[],
  bindings: MuirMoiraStorybookBindings,
  metaBindings: readonly (readonly [unknown, unknown])[],
): NamesReadElsewhere {
  const reaches = reachesOf([...bindings, ...metaBindings], bindings);
  const read = new Set([
    ...body.flatMap(identifiersInReadForms),
    ...reaches.map(({ identifier }) => identifier),
  ]);
  const usedOutsideReadForms = identifiersIgnoringScopes(body)
    .filter((identifier) => !read.has(identifier))
    .map((identifier) => muirMoiraStorybookField(identifier, 'name'));
  const assignments = body.flatMap(muirMoiraStorybookAssignmentOf);
  const written = withFamilies(
    new Set([
      ...usedOutsideReadForms,
      ...assignments.map(({ target }) => target),
      ...writtenThrough(assignments, usedOutsideReadForms),
    ]),
    reaches,
  );

  return {
    usedOutsideReadForms: new Set(usedOutsideReadForms),
    sharingWithWritten: new Set(
      reaches
        .filter(({ from }) => written.has(from))
        .flatMap(({ from, to }) => [from, to]),
    ),
    written,
    readByOtherObjects: withReachedAndWholeHolders(
      new Set(
        reaches
          .filter(({ from, to, holdsWhole }) => from !== to && !holdsWhole)
          .map(({ to }) => to),
      ),
      reaches,
    ),
  };
}

function identifiersInReadForms(statement: unknown): readonly unknown[] {
  const declaration = muirMoiraStorybookDeclarationOf(statement);

  return [
    muirMoiraStorybookField(declaration, 'id'),
    ...muirMoiraStorybookList(
      muirMoiraStorybookField(declaration, 'declarations'),
    ).flatMap((declarator) => {
      const init = muirMoiraStorybookUnwrap(
        muirMoiraStorybookField(declarator, 'init'),
      );

      return [
        muirMoiraStorybookField(declarator, 'id'),
        muirMoiraStorybookIsStoryFactoryCall(init)
          ? muirMoiraStorybookField(init, 'callee', 'object')
          : undefined,
      ];
    }),
    ...muirMoiraStorybookList(
      muirMoiraStorybookField(statement, 'specifiers'),
    ).flatMap((specifier) => [
      muirMoiraStorybookField(specifier, 'local'),
      muirMoiraStorybookField(specifier, 'exported'),
    ]),
    ...(muirMoiraStorybookIsIndexedTestCall(statement)
      ? [
          muirMoiraStorybookField(statement, 'expression', 'callee', 'object'),
          ...muirMoiraStorybookList(
            muirMoiraStorybookField(statement, 'expression', 'arguments'),
          ),
        ]
      : // Stryker disable next-line ArrayDeclaration: this list is only searched for identifier nodes, and a string is none
        []),
    ...(muirMoiraStorybookField(statement, 'expression', 'operator') === '='
      ? [
          muirMoiraStorybookAssignmentRootWithoutUnwrap(
            muirMoiraStorybookField(statement, 'expression', 'left', 'object'),
          ),
          muirMoiraStorybookField(statement, 'expression', 'right'),
        ]
      : // Stryker disable next-line ArrayDeclaration: this list is only searched for identifier nodes, and a string is none
        []),
  ];
}

function withReachedAndWholeHolders(
  names: ReadonlySet<unknown>,
  reaches: readonly Reach[],
): ReadonlySet<unknown> {
  const added = reaches.flatMap(({ from, to, holdsWhole }) => [
    ...(names.has(from) && !names.has(to) ? [to] : []),
    ...(holdsWhole && names.has(to) && !names.has(from) ? [from] : []),
  ]);

  return added.length === 0
    ? names
    : withReachedAndWholeHolders(new Set([...names, ...added]), reaches);
}

function writtenThrough(
  assignments: readonly MuirMoiraStorybookAssignment[],
  usedOutsideReadForms: readonly unknown[],
): readonly string[] {
  return assignments.flatMap(({ target, path, value }) => {
    const name = muirMoiraStorybookField(value, 'name');

    return typeof name === 'string' &&
      (usedOutsideReadForms.includes(target) ||
        assignments.some(
          (other) =>
            other.target === target &&
            other.path.length > path.length &&
            path.every((key, index) => other.path[index] === key),
        ))
      ? [name]
      : // Stryker disable next-line ArrayDeclaration: the names are looked up as bindings, and the file binds no name with a space in it
        [];
  });
}

function withFamilies(
  names: ReadonlySet<unknown>,
  reaches: readonly Reach[],
): ReadonlySet<unknown> {
  const reached = reaches
    .filter(({ from, to }) => names.has(from) !== names.has(to))
    .flatMap(({ from, to }) => [from, to]);

  return reached.length === 0
    ? names
    : withFamilies(new Set([...names, ...reached]), reaches);
}

interface Reach {
  readonly from: unknown;
  readonly to: string;
  readonly identifier: unknown;
  readonly holdsWhole: boolean;
}

function reachesOf(
  inits: readonly (readonly [unknown, unknown])[],
  bindings: MuirMoiraStorybookBindings,
): readonly Reach[] {
  return inits.flatMap(([from, init]) => {
    const wholeHeld = wholeHeldRoots(init);

    return identifiersSharedBy(init).flatMap((identifier) => {
      const to = muirMoiraStorybookField(identifier, 'name');

      return typeof to === 'string' &&
        bindings.has(to) &&
        !primitiveTypes.includes(
          muirMoiraStorybookField(
            muirMoiraStorybookUnwrap(bindings.get(to)),
            'type',
          ),
        )
        ? [
            {
              from,
              to,
              identifier,
              holdsWhole: wholeHeld.includes(identifier),
            },
          ]
        : [];
    });
  });
}

/** The nodes whose whole object `init` holds: `init` itself as a name, else the root of each spread of its story object. Only looked up by identifier, so a property that is no spread adds an `undefined` root that matches none. */
function wholeHeldRoots(init: unknown): readonly unknown[] {
  const current = muirMoiraStorybookUnwrap(init);

  if (muirMoiraStorybookField(current, 'type') === 'Identifier') {
    return [current];
  }

  return muirMoiraStorybookList(
    muirMoiraStorybookField(
      muirMoiraStorybookStoryArgument(current),
      'properties',
    ),
  ).map((property) =>
    muirMoiraStorybookMemberRoot(muirMoiraStorybookField(property, 'argument')),
  );
}

const primitiveTypes: readonly unknown[] = [
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
  'BigIntLiteral',
  'TemplateLiteral',
];

function identifiersSharedBy(node: unknown): readonly unknown[] {
  const current = muirMoiraStorybookUnwrap(node);

  if (muirMoiraStorybookField(current, 'type') === 'Identifier') {
    return [current];
  }

  if (muirMoiraStorybookIsStoryFactoryCall(current)) {
    return identifiersSharedBy(muirMoiraStorybookStoryArgument(current));
  }

  if (muirMoiraStorybookIsMember(current)) {
    return identifiersSharedBy(muirMoiraStorybookField(current, 'object'));
  }

  return muirMoiraStorybookList(
    muirMoiraStorybookField(current, 'properties'),
  ).flatMap((property) =>
    identifiersSharedBy(
      muirMoiraStorybookField(
        property,
        muirMoiraStorybookField(property, 'type') === 'SpreadElement'
          ? 'argument'
          : 'value',
      ),
    ),
  );
}

function identifiersIgnoringScopes(node: unknown): readonly unknown[] {
  if (!muirMoiraStorybookIsRecord(node) || node['type'] === 'TSTypeQuery') {
    // Stryker disable next-line ArrayDeclaration: a string in this list gives namesReadElsewhere an undefined name, which marks only a story whose local is undefined: a namespace re-export, which Storybook 10.6.5's index never lists, or a re-export by string name, which its Vitest transform does not test; classifyStubs drops both, and csfShapes never reads the flag
    return [];
  }

  if (node['type'] === 'Identifier') {
    return [node];
  }

  if (node['type'] === 'MemberExpression' && node['computed'] === false) {
    return identifiersIgnoringScopes(node['object']);
  }

  if (node['type'] === 'ObjectProperty' && node['computed'] === false) {
    return identifiersIgnoringScopes(node['value']);
  }

  return Object.values(node).flatMap(identifiersIgnoringScopes);
}
