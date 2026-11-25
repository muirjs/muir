export type Bindings = ReadonlyMap<string, unknown>;

/** The bindings a name's init reads, so that following a cycle of names ends. */
export function withoutBinding(bindings: Bindings, name: unknown): Bindings {
  return new Map([...bindings].filter(([bound]) => bound !== name));
}
