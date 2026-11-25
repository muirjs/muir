export function muirMoiraMutatorsIsRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function muirMoiraMutatorsFieldOf(value: unknown, key: string): unknown {
  return muirMoiraMutatorsIsRecord(value) ? value[key] : undefined;
}
