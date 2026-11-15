import type { Bindings } from './bindings.ts';
import {
  assignmentOf,
  assignmentRootWithoutUnwrap,
  declarationOf,
  isIndexedTestCall,
  isMember,
  isStoryFactoryCall,
  memberRoot,
  storyArgument,
  unwrap,
  type Assignment,
} from './csf-nodes.ts';
import { isRecord } from './is-record.ts';
import { field, list } from './node-field.ts';

interface NamesReadElsewhere {
  readonly usedOutsideReadForms: ReadonlySet<unknown>;
  readonly sharingWithWritten: ReadonlySet<unknown>;
  readonly written: ReadonlySet<unknown>;
  readonly readByOtherObjects: ReadonlySet<unknown>;
}

export function namesReadElsewhere(
  body: readonly unknown[],
  bindings: Bindings,
  metaBindings: readonly (readonly [unknown, unknown])[],
): NamesReadElsewhere {
  const reaches = reachesOf([...bindings, ...metaBindings], bindings);
  const read = new Set([
    ...body.flatMap(identifiersInReadForms),
    ...reaches.map(({ identifier }) => identifier),
  ]);
  const usedOutsideReadForms = identifiersIgnoringScopes(body)
    .filter((identifier) => !read.has(identifier))
    .map((identifier) => field(identifier, 'name'));
  const assignments = body.flatMap(assignmentOf);
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
  const declaration = declarationOf(statement);

  return [
    field(declaration, 'id'),
    ...list(field(declaration, 'declarations')).flatMap((declarator) => {
      const init = unwrap(field(declarator, 'init'));

      return [
        field(declarator, 'id'),
        isStoryFactoryCall(init) ? field(init, 'callee', 'object') : undefined,
      ];
    }),
    ...list(field(statement, 'specifiers')).flatMap((specifier) => [
      field(specifier, 'local'),
      field(specifier, 'exported'),
    ]),
    ...(isIndexedTestCall(statement)
      ? [
          field(statement, 'expression', 'callee', 'object'),
          ...list(field(statement, 'expression', 'arguments')),
        ]
      : // Stryker disable next-line ArrayDeclaration: this list is only searched for identifier nodes, and a string is none
        []),
    ...(field(statement, 'expression', 'operator') === '='
      ? [
          assignmentRootWithoutUnwrap(
            field(statement, 'expression', 'left', 'object'),
          ),
          field(statement, 'expression', 'right'),
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
  assignments: readonly Assignment[],
  usedOutsideReadForms: readonly unknown[],
): readonly string[] {
  return assignments.flatMap(({ target, path, value }) => {
    const name = field(value, 'name');

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
  bindings: Bindings,
): readonly Reach[] {
  return inits.flatMap(([from, init]) => {
    const wholeHeld = wholeHeldRoots(init);

    return identifiersSharedBy(init).flatMap((identifier) => {
      const to = field(identifier, 'name');

      return typeof to === 'string' &&
        bindings.has(to) &&
        !primitiveTypes.includes(field(unwrap(bindings.get(to)), 'type'))
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
  const current = unwrap(init);

  if (field(current, 'type') === 'Identifier') {
    return [current];
  }

  return list(field(storyArgument(current), 'properties')).map((property) =>
    memberRoot(field(property, 'argument')),
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
  const current = unwrap(node);

  if (field(current, 'type') === 'Identifier') {
    return [current];
  }

  if (isStoryFactoryCall(current)) {
    return identifiersSharedBy(storyArgument(current));
  }

  if (isMember(current)) {
    return identifiersSharedBy(field(current, 'object'));
  }

  return list(field(current, 'properties')).flatMap((property) =>
    identifiersSharedBy(
      field(
        property,
        field(property, 'type') === 'SpreadElement' ? 'argument' : 'value',
      ),
    ),
  );
}

function identifiersIgnoringScopes(node: unknown): readonly unknown[] {
  if (!isRecord(node) || node['type'] === 'TSTypeQuery') {
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
