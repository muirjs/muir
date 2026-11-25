export function muirSirynPlaywrightIsRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function muirSirynPlaywrightIsStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function muirSirynPlaywrightFieldOf(
  value: unknown,
  key: string,
): unknown {
  return muirSirynPlaywrightIsRecord(value) ? value[key] : undefined;
}
