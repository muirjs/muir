import { muirMoiraMutatorsFieldOf } from './is-record.ts';

export const muirMoiraMutatorsCallTypes: readonly unknown[] = [
  'CallExpression',
  'OptionalCallExpression',
];
export const muirMoiraMutatorsMemberTypes: readonly unknown[] = [
  'MemberExpression',
  'OptionalMemberExpression',
];

/** The Babel binding that `name` refers to in the scope of `path`. */
export function muirMoiraMutatorsBindingOf(
  path: unknown,
  name: unknown,
): unknown {
  const scope = muirMoiraMutatorsFieldOf(path, 'scope');
  const getBinding = muirMoiraMutatorsFieldOf(scope, 'getBinding');

  return typeof getBinding === 'function'
    ? Reflect.apply(getBinding, scope, [name])
    : undefined;
}

/** `<x>.<y>`, `<x>[<y>]`, or either through `?.`. */
export function muirMoiraMutatorsIsMember(node: unknown): boolean {
  return muirMoiraMutatorsMemberTypes.includes(
    muirMoiraMutatorsFieldOf(node, 'type'),
  );
}

/** The property name of `<x>.<name>` or `<x>?.<name>`. */
export function muirMoiraMutatorsMemberNameOf(member: unknown): unknown {
  return muirMoiraMutatorsIsMember(member) &&
    muirMoiraMutatorsFieldOf(member, 'computed') === false
    ? muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(member, 'property'),
        'name',
      )
    : undefined;
}

export function muirMoiraMutatorsArgumentOf(
  call: unknown,
  index: number,
): unknown {
  const args = muirMoiraMutatorsFieldOf(call, 'arguments');

  return Array.isArray(args) ? args[index] : undefined;
}

/** The key of a non-computed property: the name of an identifier key, or the value of a literal key. */
export function muirMoiraMutatorsPropertyKey(property: unknown): unknown {
  const key = muirMoiraMutatorsFieldOf(property, 'key');

  return muirMoiraMutatorsFieldOf(property, 'computed') === false
    ? (muirMoiraMutatorsFieldOf(key, 'name') ??
        muirMoiraMutatorsFieldOf(key, 'value'))
    : undefined;
}

/** The property of the object literal whose key, by `propertyKey`, is `key`. */
export function muirMoiraMutatorsFindProperty(
  object: unknown,
  key: string,
): unknown {
  const properties = muirMoiraMutatorsFieldOf(object, 'properties');

  return Array.isArray(properties)
    ? properties.find(
        (property) => muirMoiraMutatorsPropertyKey(property) === key,
      )
    : undefined;
}
