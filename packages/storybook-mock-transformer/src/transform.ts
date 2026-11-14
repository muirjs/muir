import { parse } from '@babel/parser';
import {
  appendRecord,
  chainUpTo,
  definitionTimeStubs,
  type StubMethod,
} from '@layzee/storybook-core';
import MagicString, { type SourceMap } from 'magic-string';

import { packageName } from './package-name.ts';

export interface TransformResult {
  readonly code: string;
  readonly map: SourceMap;
}

/** The text that replaces a stub call up to its first argument; `between` is what stands between the spy call and the stub method, such as `.mockName('load')`. */
const replacements: Readonly<
  Record<StubMethod, (spy: string, between: string) => string>
> = {
  mockReturnValue: (spy, between) =>
    `((value) => ${spy}(() => value)${between})(`,
  mockResolvedValue: (spy, between) =>
    `((value) => ${spy}(async () => value)${between})(`,
  mockRejectedValue: (spy, between) =>
    `((value) => ${spy}(async () => { throw value; })${between})(`,
  mockImplementation: (spy, between) =>
    between === ''
      ? `${spy}(`
      : `((implementation) => ${spy}(implementation)${between})(`,
};

export function transform(
  code: string,
  id: string,
): TransformResult | undefined {
  const [file = id] = id.split('?');

  if (!/\.[cm]?[jt]sx?$/.test(file) || !code.includes('storybook/test')) {
    return undefined;
  }

  const stubs = definitionTimeStubs(parseModule(code, file));
  const edits = stubs
    .filter((stub) => chainUpTo(stub, stubs).length === 1)
    .flatMap(
      ({ spy, method, once, start, argumentStart, spyCallEnd, receiverEnd }) =>
        once || argumentStart === undefined
          ? []
          : [
              {
                start,
                end: argumentStart,
                text: replacements[method](
                  spy,
                  code.slice(spyCallEnd, receiverEnd),
                ),
              },
            ],
    );

  if (edits.length === 0) {
    return undefined;
  }

  const output = new MagicString(code);
  edits.forEach(({ start, end, text }) => output.overwrite(start, end, text));
  appendRecord(file, edits.length);

  return {
    code: output.toString(),
    map: output.generateMap({ source: file, hires: true }),
  };
}

function parseModule(code: string, file: string): unknown {
  try {
    return parse(code, {
      sourceType: 'module',
      plugins: /\.[cm]?ts$/.test(file) ? ['typescript'] : ['typescript', 'jsx'],
    }).program;
  } catch (error: unknown) {
    throw new Error(
      `${packageName}: cannot parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
