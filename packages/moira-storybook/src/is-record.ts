export function muirMoiraStorybookIsRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function muirMoiraStorybookIsStringArray(
  value: unknown,
): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}
