import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import ts from 'typescript';

import { documentedExports, prefixOf } from './readmes.ts';
import { workspaceRoot } from './stryker-configs.fixtures.ts';

const badge =
  '<img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">';

const packages = globSync('packages/*/README.md', { cwd: workspaceRoot })
  .map((readme) => readme.replaceAll('\\', '/').split('/')[1] ?? '')
  .sort();

function readme(name: string): string {
  return readFileSync(
    join(workspaceRoot, 'packages', name, 'README.md'),
    'utf8',
  );
}

/** The Stryker option keys the package's `strykerValidationSchema` declares, which a README may name. */
async function optionKeysOf(name: string): Promise<string[]> {
  const entry: unknown = await import(`@muirjs/${name}`);
  const schema =
    typeof entry === 'object' &&
    entry !== null &&
    'strykerValidationSchema' in entry
      ? entry.strykerValidationSchema
      : undefined;
  const properties =
    typeof schema === 'object' && schema !== null && 'properties' in schema
      ? schema.properties
      : undefined;

  return typeof properties === 'object' && properties !== null
    ? Object.keys(properties)
    : [];
}

function exportsOf(entry: string): Set<string> {
  const program = ts.createProgram([entry], {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const module = source && checker.getSymbolAtLocation(source);

  return new Set(
    module ? checker.getExportsOfModule(module).map(({ name }) => name) : [],
  );
}

describe('package READMEs', () => {
  it('finds the package READMEs', () => {
    assert.ok(packages.includes('moira-storybook'));
  });

  for (const name of packages) {
    it(`${name} shows the Muir badge`, () => {
      assert.ok(readme(name).includes(badge));
    });
  }

  for (const name of packages.filter(
    (withExports) => documentedExports(readme(withExports)).length > 0,
  )) {
    it(`${name} lists only names its entry exports, its prefix or its option keys`, async () => {
      const entry = join(workspaceRoot, 'packages', name, 'src', 'index.ts');
      assert.ok(existsSync(entry));
      const known = new Set([
        ...exportsOf(entry),
        prefixOf(name),
        ...(await optionKeysOf(name)),
      ]);

      assert.deepEqual(
        documentedExports(readme(name)).filter(
          (documentedName) => !known.has(documentedName),
        ),
        [],
      );
    });
  }
});

describe('prefixOf', () => {
  it('turns a package folder name into its name prefix', () => {
    assert.equal(prefixOf('moira-mutators'), 'MuirMoiraMutators');
  });
});

describe('documentedExports', () => {
  it('reads the backticked muir names up to the next section', () => {
    assert.deepEqual(
      documentedExports(
        '# P\n\n## Exports\n\n- `muirAlpha` and `MuirBeta`, not `args`.\n\n## Other\n\n`muirGamma`\n',
      ),
      ['muirAlpha', 'MuirBeta'],
    );
  });

  it('reads to the end of a README whose last section lists the exports', () => {
    assert.deepEqual(documentedExports('## Exports\n\n`muirA`'), ['muirA']);
  });

  it('ends the section only at a heading that starts its line', () => {
    assert.deepEqual(
      documentedExports('## Exports\n\n`muirA`, see ## Notes, `muirB`\n'),
      ['muirA', 'muirB'],
    );
  });

  it('starts the section only at a heading that starts its line', () => {
    assert.deepEqual(
      documentedExports('See the ## Exports\n`muirA`\n\n## Use it\n'),
      [],
    );
  });

  it('reads nothing from a README without the section', () => {
    assert.deepEqual(documentedExports('## Use it\n\n`muirA`'), []);
  });
});
