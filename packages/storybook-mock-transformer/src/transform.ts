import { parse } from '@babel/parser';
import {
  appendRecord,
  definitionTimeStubs,
  type StubMethod,
  type StubSite,
} from '@layzee/storybook-core';
import MagicString, { type SourceMap } from 'magic-string';

import { packageName } from './package-name.ts';

export interface TransformResult {
  readonly code: string;
  readonly map: SourceMap;
}

const replacements: Readonly<Record<StubMethod, (spy: string) => string>> = {
  mockReturnValue: (spy) => `((value) => ${spy}(() => value))(`,
  mockResolvedValue: (spy) => `((value) => ${spy}(async () => value))(`,
  mockRejectedValue: (spy) =>
    `((value) => ${spy}(async () => { throw value; }))(`,
  mockImplementation: (spy) => `${spy}(`,
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
    .filter((stub) => !followsAStub(stub, stubs))
    .flatMap(({ spy, method, once, start, argumentStart }) =>
      once || argumentStart === undefined
        ? []
        : [{ start, end: argumentStart, text: replacements[method](spy) }],
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

/** Whether another stub of the chain comes before this one: it starts at the same call and ends earlier. */
function followsAStub(stub: StubSite, stubs: readonly StubSite[]): boolean {
  return stubs.some(
    (inner) => inner.start === stub.start && inner.end < stub.end,
  );
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
