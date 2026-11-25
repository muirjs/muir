import { muirSirynPlaywrightIsRecord } from './is-record.ts';

type Writable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * The global that Stryker's instrumented code and the hooks share, in a worker, a page or a server.
 * Instrumented code may create it first, so each field claims nothing.
 */
export type MuirSirynPlaywrightStrykerNamespace =
  Writable<StrykerNamespaceFields>;

interface StrykerNamespaceFields {
  readonly activeMutant?: unknown;
  readonly currentTestId?: unknown;
  readonly mutantCoverage?: unknown;
  readonly hitCount?: unknown;
  readonly hitLimit?: unknown;
  /** The runner's own mark: instrumented code read activeMutant, so it loaded here. */
  readonly instrumented?: true;
}

/**
 * Stryker's header reads activeMutant as each instrumented file starts to run
 * (`instrumentationBabelHeader` in @stryker-mutator/instrumenter's src/util/syntax-helpers.ts, 10.1.1), and the
 * runner only writes it, so its first read marks the namespace instrumented.
 */
export function muirSirynPlaywrightMarkInstrumentedReads(
  namespace: MuirSirynPlaywrightStrykerNamespace,
): void {
  let activeMutant = namespace.activeMutant;
  Object.defineProperty(namespace, 'activeMutant', {
    get: () => {
      namespace.instrumented = true;

      return activeMutant;
    },
    set: (value: unknown) => {
      activeMutant = value;
    },
  });
}

export function muirSirynPlaywrightGlobalNamespace(
  name: string,
): MuirSirynPlaywrightStrykerNamespace {
  const scope: Record<string, unknown> = globalThis;
  const found = scope[name];

  if (muirSirynPlaywrightIsRecord(found)) {
    return found;
  }

  const created: MuirSirynPlaywrightStrykerNamespace = {};
  scope[name] = created;

  return created;
}
