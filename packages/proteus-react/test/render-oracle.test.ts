// Every mutant, active in the instrumented build, renders like the original source with that mutant's replacement
// spliced in at its location; with no mutant active, the build renders like the original. This holds under the oldest
// and the newest release of each supported React major, with the classic and with the automatic JSX transform. The
// fixture is the design spike's sample (spikes/design-opus/sample.tsx), rendered for two prop scenarios into static
// HTML by that version's react-dom and into a serialized element tree (props, handler presence, children).
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import ts from 'typescript';

import { muirProteusReactResolveFromCore } from '../src/install.ts';
import { defined } from './support/defined.ts';
import { exported, exportedFunction } from './support/exports.ts';
import {
  instrumentFully,
  type InstrumentedMutant,
} from './support/instrument-result.ts';
import { installInto, ours } from './support/installed.ts';

type Component = (props: unknown) => unknown;

interface ElementLike {
  readonly type: string | symbol | Component;
  readonly props: { readonly children?: unknown } & Record<string, unknown>;
}

/** One React version: its folder, and what the oracle needs from its `react` and `react-dom/server`. */
interface React {
  readonly load: (file: string) => Component;
  readonly html: (app: Component, props: unknown) => string;
}

/** The CommonJS builds of the sample for one JSX transform. */
interface Builds {
  readonly original: string;
  readonly instrumented: string;
  /** By mutant id: the original with that mutant's replacement spliced in. */
  readonly applied: ReadonlyMap<string, string>;
}

const root = join(import.meta.dirname, '..', '..', '..');
const samplePath = join(root, 'spikes', 'design-opus', 'sample.tsx');
// The classic transform calls React.createElement, so React must be in scope; the automatic one drops the import.
const source = `import * as React from 'react';\n${readFileSync(samplePath, 'utf8')}`;
const versionsDir = join(root, 'tools', 'react-versions');
// The workspace's own React resolves from the package, each other version from its folder, which installs it.
const reactDirs = [
  ...readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => join(versionsDir, name)),
  join(import.meta.dirname, '..'),
];
const transforms = [
  ['classic', ts.JsxEmit.React],
  ['automatic', ts.JsxEmit.ReactJSX],
] as const;

let mutants: readonly InstrumentedMutant[];
const builds = new Map<string, Builds>();

// The build gets a runtime namespace and an active-mutant variable of its own, so that it never reads or counts the
// mutants of a Stryker run of this package in the same process.
function isolated(code: string): string {
  return code
    .replaceAll('__stryker__', '__renderOracle__')
    .replaceAll('__STRYKER_ACTIVE_MUTANT__', '__RENDER_ORACLE_ACTIVE_MUTANT__');
}

function transpile(tsx: string, jsx: ts.JsxEmit): string {
  return ts.transpileModule(tsx, {
    compilerOptions: {
      jsx,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function offsetOf(line: number, column: number): number {
  return (
    source
      .split('\n')
      .slice(0, line)
      .reduce((sum, text) => sum + text.length + 1, 0) + column
  );
}

function withReplacement({ location, replacement }: InstrumentedMutant) {
  const start = offsetOf(location.start.line, location.start.column);
  const end = offsetOf(location.end.line, location.end.column);

  return source.slice(0, start) + replacement + source.slice(end);
}

before(async () => {
  const instrumenter = await installInto(
    await muirProteusReactResolveFromCore(),
  );
  const result = await instrumentFully(instrumenter, [
    { name: samplePath, content: source },
  ]);
  const instrumented = isolated(defined(result.files[0]).content);
  mutants = result.mutants;

  for (const [transform, jsx] of transforms) {
    builds.set(transform, {
      original: transpile(source, jsx),
      instrumented: transpile(instrumented, jsx),
      applied: new Map(
        mutants.map((mutant) => [
          mutant.id,
          transpile(withReplacement(mutant), jsx),
        ]),
      ),
    });
  }
});

function versionIn(dir: string): string {
  return String(
    exported(
      createRequire(join(dir, 'package.json'))('react/package.json'),
      'version',
    ),
  );
}

// Modules are written under the version's folder, not os.tmpdir(), so the `react` they require resolves to that
// version; `tmp` is ignored by git. A directory per process, as a Stryker run of this package runs several processes
// of this file in one sandbox at once.
function reactIn(outDir: string): React {
  const requireIn = createRequire(join(outDir, 'oracle.cjs'));
  const createElement = exportedFunction(requireIn('react'), 'createElement');
  const renderToStaticMarkup = exportedFunction(
    requireIn('react-dom/server'),
    'renderToStaticMarkup',
  );
  let counter = 0;

  return {
    load: (js) => {
      const file = join(outDir, `m${counter++}.cjs`);
      writeFileSync(file, js);
      const app = exportedFunction(requireIn(file), 'App');

      return (props): unknown => Reflect.apply(app, undefined, [props]);
    },
    html: (app, props) =>
      String(
        Reflect.apply(renderToStaticMarkup, undefined, [
          Reflect.apply(createElement, undefined, [app, props]),
        ]),
      ),
  };
}

const fragmentType = Symbol.for('react.fragment');

function isElement(node: object): node is ElementLike {
  return 'type' in node && 'props' in node;
}

function serialize(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node !== 'object') {
    return JSON.stringify(String(node));
  }

  if (Array.isArray(node)) {
    return node.map(serialize).join('');
  }

  if (!isElement(node)) {
    return `UNKNOWN ${JSON.stringify(node)}`;
  }

  const { type, props } = node;

  if (typeof type === 'function') {
    return `<${type.name}>${serialize(type(props))}</${type.name}>`;
  }

  if (type === fragmentType) {
    return serialize(props.children);
  }

  const { children, ...rest } = props;
  const attributes = Object.keys(rest)
    .sort()
    .filter((key) => rest[key] !== undefined)
    .map(
      (key) =>
        `${key}=${typeof rest[key] === 'function' ? 'fn' : JSON.stringify(rest[key])}`,
    )
    .join(' ');

  return `<${String(type)} ${attributes}>${serialize(children)}</${String(type)}>`;
}

const noop = (): undefined => undefined;
const scenarios = [
  {
    open: true,
    busy: false,
    items: [
      { id: '1', label: 'One' },
      { id: '2', label: 'Two' },
    ],
    user: { name: 'Ada' },
    label: 'Search',
    url: 'https://x.test',
    onClose: noop,
    onSave: noop,
  },
  {
    open: false,
    busy: true,
    items: [],
    user: { name: 'Bob' },
    error: 'Boom',
    label: 'Find',
    url: '/ext',
    onClose: noop,
    onSave: noop,
  },
];

function renderAll(react: React, app: Component): string {
  return scenarios
    .map((scenario) => {
      try {
        return `${react.html(app, scenario)}\n${serialize(app(scenario))}`;
      } catch (error) {
        return `THROWS ${String(error)}`;
      }
    })
    .join('\n');
}

// The instrumented header caches the namespace object, so the test changes it in place rather than replacing it.
const namespace: { activeMutant?: string | undefined } = {};
Reflect.set(globalThis, '__renderOracle__', namespace);

const label = ({
  id,
  mutatorName,
  location,
  replacement,
}: InstrumentedMutant): string =>
  `${id} ${mutatorName} L${location.start.line + 1}: ${replacement.replace(/\s+/g, ' ').slice(0, 60)}`;

const jsxMutants = () =>
  mutants.filter(({ mutatorName }) => ours.has(mutatorName));

for (const dir of reactDirs) {
  for (const [transform] of transforms) {
    describe(`render oracle on spikes/design-opus/sample.tsx, React ${versionIn(dir)}, ${transform} JSX transform`, () => {
      let outDir: string;
      let react: React;
      let original: string;
      let build: Component;

      before(() => {
        mkdirSync(join(dir, 'tmp'), { recursive: true });
        outDir = mkdtempSync(join(dir, 'tmp', 'render-oracle-'));
        react = reactIn(outDir);
        original = renderAll(
          react,
          react.load(defined(builds.get(transform)).original),
        );
        build = react.load(defined(builds.get(transform)).instrumented);
      });
      after(() => rmSync(outDir, { recursive: true, force: true }));

      function active(mutant: InstrumentedMutant): string {
        namespace.activeMutant = mutant.id;
        const actual = renderAll(react, build);
        namespace.activeMutant = undefined;

        return actual;
      }

      function mismatches(checked: readonly InstrumentedMutant[]): string[] {
        const { applied } = defined(builds.get(transform));

        return checked.flatMap((mutant) => {
          const expected = renderAll(
            react,
            react.load(defined(applied.get(mutant.id))),
          );
          const actual = active(mutant);

          return actual === expected
            ? []
            : [
                `${label(mutant)}\n  expected ${expected}\n  actual   ${actual}`,
              ];
        });
      }

      it('renders the instrumented build with no active mutant like the original, in both prop scenarios', () => {
        namespace.activeMutant = undefined;

        assert.equal(renderAll(react, build), original);
      });

      it('renders each JSX mutant like its hand-applied replacement, in both prop scenarios', () => {
        assert.deepEqual(mismatches(jsxMutants()), []);
      });

      it('renders each built-in mutant like its hand-applied replacement, in both prop scenarios', () => {
        assert.deepEqual(
          mismatches(
            mutants.filter(({ mutatorName }) => !ours.has(mutatorName)),
          ),
          [],
        );
      });

      it('renders each JSX mutant unlike the original in a prop scenario', () => {
        assert.deepEqual(
          jsxMutants()
            .filter((mutant) => active(mutant) === original)
            .map(label),
          [],
        );
      });
    });
  }
}

describe('render oracle on spikes/design-opus/sample.tsx', () => {
  it('gives at least one mutant of every mutator in the table', () => {
    assert.deepEqual(
      new Set(
        mutants
          .map(({ mutatorName }) => mutatorName)
          .filter((name) => ours.has(name)),
      ),
      ours,
    );
  });
});
