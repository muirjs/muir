/** Every function is assignable to it, and `Reflect.apply` and `Reflect.construct` call it. */
export type MuirMoiraNodeTestAnyFunction = (...args: never) => unknown;

export function muirMoiraNodeTestIsObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function muirMoiraNodeTestIsFunction(
  value: unknown,
): value is MuirMoiraNodeTestAnyFunction {
  return typeof value === 'function';
}

export function muirMoiraNodeTestIsString(value: unknown): value is string {
  return typeof value === 'string';
}

export function muirMoiraNodeTestIsNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function muirMoiraNodeTestHasMember<TKey extends string, T>(
  value: unknown,
  key: TKey,
  check: (member: unknown) => member is T,
): value is Record<TKey, T> {
  return muirMoiraNodeTestIsObject(value) && check(Reflect.get(value, key));
}

/** The member of `value` under `key` that passes `check`; throws, naming `source`, when there is none. */
export function muirMoiraNodeTestMember<T>(
  value: unknown,
  key: string,
  check: (member: unknown) => member is T,
  source: string,
): T {
  const found: unknown = muirMoiraNodeTestIsObject(value)
    ? Reflect.get(value, key)
    : undefined;

  if (!check(found)) {
    throw new Error(
      `moira-node-test: ${source} has no ${key} of the shape this module reads.`,
    );
  }

  return found;
}
