import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import {
  muirMoiraMutatorsCorePackageJson,
  muirMoiraMutatorsFieldOf,
} from '@muirjs/moira-mutators';

/** The Program node of `source`, parsed by the Babel of the Stryker instrumenter in use. */
export async function programOf(source: string): Promise<unknown> {
  const instrumenterJson = createRequire(
    muirMoiraMutatorsCorePackageJson(),
  ).resolve('@stryker-mutator/instrumenter/package.json');
  const babelPath = createRequire(instrumenterJson).resolve('@babel/core');
  const parseSync = muirMoiraMutatorsFieldOf(
    await import(pathToFileURL(babelPath).href),
    'parseSync',
  );

  if (typeof parseSync !== 'function') {
    throw new Error('@babel/core has no parseSync');
  }

  const file: unknown = Reflect.apply(parseSync, undefined, [
    source,
    {
      filename: 'sample.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
    },
  ]);

  return muirMoiraMutatorsFieldOf(file, 'program');
}
