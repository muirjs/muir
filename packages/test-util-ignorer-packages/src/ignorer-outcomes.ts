import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  muirMoiraMutatorsCoreInstrument,
  muirMoiraMutatorsCorePackageJsons,
  muirMoiraMutatorsFieldOf,
} from '@muirjs/moira-mutators';
import { strykerCoreSchema } from '@stryker-mutator/api/core';
import type { Ignorer } from '@stryker-mutator/api/ignore';

/** The outcome of each mutant Stryker's own instrumenter places in `code` with its built-in mutators and `ignorer`: the ignore reason, or `placed`. */
export async function muirIgnorerOutcomes(
  ignorer: Ignorer,
  code: string,
  name = 'a.tsx',
): Promise<string[]> {
  const corePackage = muirMoiraMutatorsCorePackageJsons()[0];
  const packageJson = createRequire(corePackage).resolve(
    '@stryker-mutator/instrumenter/package.json',
  );
  const version: unknown = muirMoiraMutatorsFieldOf(
    createRequire(corePackage)(packageJson),
    // Stryker disable next-line StringLiteral: the version only names the instrumenter in the error for one without an Instrumenter, and the installed one has it
    'version',
  );
  const instrument = await muirMoiraMutatorsCoreInstrument({
    // Stryker disable next-line StringLiteral: the package name only starts the error for an instrumenter without an Instrumenter, and the installed one has it
    packageName: '@muirjs/test-util-ignorer-packages',
    dir: dirname(packageJson),
    version: String(version),
  });
  // Stryker disable next-line ArrayDeclaration: excluding a mutator name that names no mutator excludes nothing
  const result = await instrument([{ name, content: code }], [], [ignorer]);
  const mutants: unknown = muirMoiraMutatorsFieldOf(result, 'mutants');

  assert.ok(Array.isArray(mutants));

  return mutants.map((mutant: unknown) =>
    muirMoiraMutatorsFieldOf(mutant, 'status') === 'Ignored'
      ? String(muirMoiraMutatorsFieldOf(mutant, 'statusReason'))
      : 'placed',
  );
}

/** Asserts that `code` has mutants and that every one of them has `outcome`. */
export async function muirAssertEveryOutcome(
  ignorer: Ignorer,
  code: string,
  outcome: string,
  name?: string,
): Promise<void> {
  const found = await muirIgnorerOutcomes(ignorer, code, name);

  assert.ok(found.length > 0, `no mutants in ${code}`);
  assert.deepEqual(new Set(found), new Set([outcome]), code);
}

/** Validates `options` the way Stryker core does, with the schemas `contributions` that plugin modules export. */
export async function muirValidateOptions(
  options: object,
  contributions: readonly object[],
): Promise<{ readonly valid: boolean; readonly log: readonly string[] }> {
  const config: unknown = await import(
    pathToFileURL(
      join(
        dirname(muirMoiraMutatorsCorePackageJsons()[0]),
        'dist',
        'src',
        'config',
        'index.js',
      ),
    ).href
  );
  const log: string[] = [];
  const record = (level: string) => (message: unknown) => {
    log.push(`${level} ${String(message)}`);
  };
  const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: record('warn'),
    error: record('error'),
    trace: () => undefined,
    fatal: () => undefined,
  };
  const builder: unknown = Reflect.construct(
    exportedFunction(config, 'MetaSchemaBuilder'),
    [strykerCoreSchema, logger],
  );
  const schema: unknown = Reflect.apply(
    exportedFunction(builder, 'buildMetaSchema'),
    builder,
    [contributions],
  );
  const validator: unknown = Reflect.construct(
    exportedFunction(config, 'OptionsValidator'),
    [schema, logger],
  );

  try {
    Reflect.apply(exportedFunction(validator, 'validate'), validator, [
      structuredClone(options),
      true,
    ]);

    return { valid: true, log };
  } catch {
    return { valid: false, log };
  }
}

function exportedFunction(namespace: unknown, name: string) {
  assert.ok(typeof namespace === 'object' && namespace !== null);

  const value: unknown = Reflect.get(namespace, name);

  assert.ok(typeof value === 'function');

  return value;
}
