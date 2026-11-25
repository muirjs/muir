import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import type { Logger } from '@stryker-mutator/api/logging';

import { muirSirynPlaywrightFieldOf } from './is-record.ts';

export class MuirSirynPlaywrightStrykerHelpersChanged extends Error {
  constructor(what: string) {
    super(
      `The installed @stryker-mutator/instrumenter changed the helpers it puts in instrumented files (${what}), so the Playwright test runner cannot give pages Stryker's helpers.`,
    );
  }
}

const probeName = 'muirSirynPlaywrightStrykerProbe';

// Stryker disable next-line BooleanLiteral: every log method ignores its message, so an enabled level changes nothing
const off = () => false;
const ignore = () => undefined;
const silentLog: Logger = {
  isTraceEnabled: off,
  isDebugEnabled: off,
  isInfoEnabled: off,
  isWarnEnabled: off,
  isErrorEnabled: off,
  isFatalEnabled: off,
  trace: ignore,
  debug: ignore,
  info: ignore,
  warn: ignore,
  error: ignore,
  fatal: ignore,
};

function captured(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].flatMap(
    // Stryker disable next-line ArrayDeclaration: each pattern's only group takes part in every match, so name is never undefined
    ([, name]) => name ?? [],
  );
}

export async function muirSirynPlaywrightLoadPageHelpers(): Promise<string> {
  const core = createRequire(
    createRequire(import.meta.url).resolve(
      '@stryker-mutator/core/package.json',
    ),
  );
  const instrumenterModule: unknown = await import(
    pathToFileURL(core.resolve('@stryker-mutator/instrumenter')).href
  );

  return muirSirynPlaywrightPageHelpersFrom(instrumenterModule);
}

export async function muirSirynPlaywrightPageHelpersFrom(
  instrumenterModule: unknown,
): Promise<string> {
  const Instrumenter = muirSirynPlaywrightFieldOf(
    instrumenterModule,
    'Instrumenter',
  );

  if (typeof Instrumenter !== 'function') {
    throw new MuirSirynPlaywrightStrykerHelpersChanged(
      'it exports no Instrumenter class',
    );
  }

  const instrumenter: unknown = Reflect.construct(Instrumenter, [silentLog]);
  const instrument = muirSirynPlaywrightFieldOf(instrumenter, 'instrument');

  if (typeof instrument !== 'function') {
    throw new MuirSirynPlaywrightStrykerHelpersChanged(
      'its Instrumenter has no instrument method',
    );
  }

  const result: unknown = await Reflect.apply(instrument, instrumenter, [
    [{ name: 'probe.js', content: `${probeName} = 1 + 1;`, mutate: true }],
    {
      plugins: null,
      // Stryker disable next-line ArrayDeclaration: no mutator is named "Stryker was here", so excluding it excludes nothing
      excludedMutations: [],
      ignorers: [],
    },
  ]);
  const files = muirSirynPlaywrightFieldOf(result, 'files');
  const content = muirSirynPlaywrightFieldOf(
    Array.isArray(files) ? files[0] : undefined,
    'content',
  );

  if (typeof content !== 'string') {
    throw new MuirSirynPlaywrightStrykerHelpersChanged(
      'its Instrumenter returned no instrumented file',
    );
  }

  return muirSirynPlaywrightPageHelpersScript(content);
}

export function muirSirynPlaywrightPageHelpersScript(
  instrumented: string,
): string {
  const probeAt = instrumented.search(new RegExp(`^${probeName}\\b`, 'm'));

  if (probeAt < 0) {
    throw new MuirSirynPlaywrightStrykerHelpersChanged(
      `the instrumented probe has no probe statement: ${instrumented}`,
    );
  }

  const header = instrumented.slice(0, probeAt);
  const names = captured(header, /^function ([\w$]+)\(/gm);

  if (names.length === 0) {
    throw new MuirSirynPlaywrightStrykerHelpersChanged(
      `the header declares no helper function: ${instrumented}`,
    );
  }

  const undeclared = captured(instrumented.slice(probeAt), /([\w$]+)\(/g).find(
    (name) => !names.includes(name),
  );

  if (undeclared !== undefined) {
    throw new MuirSirynPlaywrightStrykerHelpersChanged(
      `the probe calls ${undeclared}, which the header does not declare`,
    );
  }

  return `${header}\nObject.assign(globalThis, { ${names.join(', ')} });`;
}
