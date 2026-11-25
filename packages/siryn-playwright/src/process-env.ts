export function muirSirynPlaywrightEnvOf(
  names: readonly string[],
): Record<string, string | undefined> {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

export async function muirSirynPlaywrightWithEnv<T>(
  values: Readonly<Record<string, string | undefined>>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = muirSirynPlaywrightEnvOf(Object.keys(values));
  muirSirynPlaywrightSetEnv(values);

  try {
    return await fn();
  } finally {
    muirSirynPlaywrightSetEnv(previous);
  }
}

export function muirSirynPlaywrightSetEnv(
  values: Readonly<Record<string, string | undefined>>,
) {
  Object.entries(values).forEach(([name, value]) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  });
}
