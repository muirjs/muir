export type MuirMoiraStorybookBindings = ReadonlyMap<string, unknown>;

/** The bindings a name's init reads, so that following a cycle of names ends. */
export function muirMoiraStorybookWithoutBinding(
  bindings: MuirMoiraStorybookBindings,
  name: unknown,
): MuirMoiraStorybookBindings {
  return new Map([...bindings].filter(([bound]) => bound !== name));
}
