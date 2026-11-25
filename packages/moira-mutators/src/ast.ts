import { fieldOf } from './is-record.ts';

export const callTypes: readonly unknown[] = [
  'CallExpression',
  'OptionalCallExpression',
];
export const memberTypes: readonly unknown[] = [
  'MemberExpression',
  'OptionalMemberExpression',
];

/** The Babel binding that `name` refers to in the scope of `path`. */
export function bindingOf(path: unknown, name: unknown): unknown {
  const scope = fieldOf(path, 'scope');
  const getBinding = fieldOf(scope, 'getBinding');

  return typeof getBinding === 'function'
    ? Reflect.apply(getBinding, scope, [name])
    : undefined;
}

/** `<x>.<y>`, `<x>[<y>]`, or either through `?.`. */
export function isMember(node: unknown): boolean {
  return memberTypes.includes(fieldOf(node, 'type'));
}

/** The property name of `<x>.<name>` or `<x>?.<name>`. */
export function memberNameOf(member: unknown): unknown {
  return isMember(member) && fieldOf(member, 'computed') === false
    ? fieldOf(fieldOf(member, 'property'), 'name')
    : undefined;
}

export function argumentOf(call: unknown, index: number): unknown {
  const args = fieldOf(call, 'arguments');

  return Array.isArray(args) ? args[index] : undefined;
}

/** The key of a non-computed property: the name of an identifier key, or the value of a literal key. */
export function propertyKey(property: unknown): unknown {
  const key = fieldOf(property, 'key');

  return fieldOf(property, 'computed') === false
    ? (fieldOf(key, 'name') ?? fieldOf(key, 'value'))
    : undefined;
}

/** The property of the object literal whose key, by `propertyKey`, is `key`. */
export function findProperty(object: unknown, key: string): unknown {
  const properties = fieldOf(object, 'properties');

  return Array.isArray(properties)
    ? properties.find((property) => propertyKey(property) === key)
    : undefined;
}
