import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { it } from 'node:test';

import { muirExec } from '../../src/exec.ts';
import {
  muirConcurrency,
  muirConsumerEnv,
  muirInstallPacked,
  muirLeftover,
  muirMutants,
  muirPack,
  muirRemoveDeadRunDirs,
  muirRemoveOnExit,
  muirStryker,
  type MuirStrykerRun,
} from '../../src/fixture.ts';

const { MUIR_E2E_REACT: react } = process.env;

if (react === undefined || !/^\d+\.\d+\.\d+$/.test(react)) {
  throw new Error(
    `Set MUIR_E2E_REACT to the React version the fixture installs, such as 18.3.1. It is ${react === undefined ? 'unset' : `"${react}"`}.`,
  );
}

const concurrency = muirConcurrency(process.env);
const dirPrefix = 'muir-storybook-react-e2e-';

muirRemoveDeadRunDirs(tmpdir(), dirPrefix);
const dir = realpathSync.native(
  mkdtempSync(join(tmpdir(), `${dirPrefix}${process.pid}-`)),
);
const tmp = join(dir, 'tmp');

muirRemoveOnExit(dir);
cpSync(
  join(import.meta.dirname, '..', '..', 'fixtures', 'storybook-react'),
  dir,
  {
    recursive: true,
  },
);
mkdirSync(tmp);

// What a Storybook and React project installs: the README's packages, the React ones, and the internal packages they
// depend on. A forgotten internal package fails the install, or, once it is on npm, the registry test below.
const installed = [
  'banshee-storybook-vitest',
  'moira-mutators',
  'moira-storybook',
  'pixie-storybook-vite',
  'proteus-msw',
  'proteus-react',
  'proteus-storybook',
  'proteus-storybook-test',
  'shadowcat-js',
  'shadowcat-react',
  'shadowcat-storybook',
  'shadowcat-storybook-vitest',
];
const tarballs = await muirPack(join(dir, 'tarballs'));

await muirInstallPacked(dir, [
  ...tarballs.filter((tarball) =>
    installed.some((name) =>
      new RegExp(`^muirjs-${name}-\\d`).test(basename(tarball)),
    ),
  ),
  `react@${react}`,
  `react-dom@${react}`,
]);

// First, on the fresh install: a Stryker run would leave Vite's dependency cache warm for the story tests.
const storyTests = await muirExec(
  process.execPath,
  [join('node_modules', 'vitest', 'vitest.mjs'), 'run'],
  { cwd: dir, env: muirConsumerEnv(tmp, process.env), timeoutMs: 5 * 60_000 },
);
const reporters = ['muir-banshee-storybook-vitest'];
const components = await muirStryker(dir, 'stryker.config.mjs', concurrency, {
  reporters,
});
const testCode = await muirStryker(
  dir,
  'stryker.test-code.config.mjs',
  concurrency,
  { reporters },
);

function installedVersion(name: string): string {
  return readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8');
}

/** The mutants that ran: a story file's Ignored mutants are counted per ignorer instead. */
function notIgnored(lines: readonly string[]): string[] {
  return lines.filter((line) => !line.endsWith(' Ignored'));
}

/** How many mutants each ignorer reported as Ignored, by the ignorer name that starts the reason. */
function ignoredPerIgnorer(run: MuirStrykerRun): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const mutant of run.reported ? [...run.report.values()].flat() : []) {
    if (mutant.status === 'Ignored') {
      const ignorer = mutant.statusReason.replace(/:.*$/s, '');

      counts[ignorer] = (counts[ignorer] ?? 0) + 1;
    }
  }

  return counts;
}

// React 16 to 18 apply `Pinger.defaultProps` when `onPing` is undefined, so the two mutants that make it undefined
// survive; React 19 ignores defaultProps on a function component, and the story test kills them.
const defaultPropsControl =
  Number(react.split('.')[0]) < 19 ? 'Survived' : 'Killed';

it(`installs React ${react}`, () => {
  assert.ok(installedVersion('react').includes(`"version": "${react}"`));
  assert.ok(installedVersion('react-dom').includes(`"version": "${react}"`));
});

it('installs every Muir package from a packed tarball, none from the registry', () => {
  const lock = readFileSync(join(dir, 'package-lock.json'), 'utf8');
  // Each locked package's path and where it came from, such as "node_modules/@muirjs/shadowcat-js" and "file:...".
  const resolved = [
    ...lock.matchAll(
      /"(node_modules\/@muirjs\/[^"/]+)": \{[^}]*?"resolved": "([^"]+)"/g,
    ),
  ].map((match) =>
    match
      .slice(1)
      .join(' ')
      .replace(/ file:.*$/, ' file'),
  );

  assert.deepEqual(
    resolved,
    installed.map((name) => `node_modules/@muirjs/${name} file`),
  );
});

it('passes the story tests on a fresh install', () => {
  assert.equal(storyTests.exitCode, 0, storyTests.stdout + storyTests.stderr);
});

it('mutates the components with the React mutators and reports the class names as Ignored', () => {
  assert.deepEqual(muirMutants(components, 'src/Counter.tsx'), [
    '8:60 BlockStatement {} Killed',
    '10:27 BlockStatement {} Killed',
    '11:14 ArithmeticOperator count - 1 Survived',
    '12:5 OptionalChaining onChange(count + 1) Survived',
    '12:16 ArithmeticOperator count - 1 Killed',
    '16:21 ConditionalExpression false Ignored',
    '16:21 ConditionalExpression true Ignored',
    '16:21 EqualityOperator count <= 0 Ignored',
    '16:21 EqualityOperator count >= 0 Ignored',
    '16:33 StringLiteral "" Ignored',
    '16:61 StringLiteral "" Ignored',
    '17:13 MuirProteusReactElementRole role={undefined} Killed',
    '17:27 MuirProteusReactLabelAttribute aria-label="" Killed',
    '18:10 MuirProteusReactChildExpression null Killed',
    '20:7 MuirProteusReactElementRole <span onClick={increment}> Add </span> Killed',
    '20:49 MuirProteusReactTextLiteral Killed',
  ]);
  assert.deepEqual(muirMutants(components, 'src/Pinger.tsx'), [
    '3:63 BlockStatement {} Killed',
    '4:48 StringLiteral "" Killed',
    "7:5 MuirProteusReactElementRole <span onClick={() => setMessage(onPing ? onPing() : 'none')}> {message} </span> Killed",
    '9:16 ArrowFunction () => undefined Killed',
    '9:53 StringLiteral "" NoCoverage',
    '11:8 MuirProteusReactChildExpression null Killed',
    '17:23 ObjectLiteral {} Survived',
    '17:33 ArrowFunction () => undefined Survived',
    '17:39 StringLiteral "" NoCoverage',
    '19:64 BlockStatement {} Killed',
    `20:18 MuirProteusReactEventHandler onPing={undefined} ${defaultPropsControl}`,
  ]);
});

it('mutates only the args of the story files and ignores the rest of them', () => {
  assert.deepEqual(
    notIgnored(muirMutants(components, 'src/Counter.stories.tsx')),
    [
      '9:9 MuirProteusStorybookArgs { onChange: fn() } Killed',
      '9:9 ObjectLiteral {} Killed',
      '9:18 StringLiteral "" Killed',
      '27:9 ObjectLiteral {} Killed',
      '27:18 StringLiteral "" Killed',
      '28:11 ArrowFunction () => undefined Killed',
      '29:14 MuirProteusReactLabelAttribute aria-label="" Killed',
    ],
  );
  assert.deepEqual(
    notIgnored(muirMutants(components, 'src/Pinger.stories.tsx')),
    [
      `9:9 ObjectLiteral {} ${defaultPropsControl}`,
      '9:39 StringLiteral "" Killed',
    ],
  );
  assert.deepEqual(ignoredPerIgnorer(components), {
    'muir-shadowcat-storybook-csf': 30,
    'muir-shadowcat-react-styling': 6,
  });
});

it('reports no spy stub and the static story mutants of the components run', () => {
  assert.match(
    components.output,
    /no spy stub findings\s+static story mutants: 8, each runs every test/,
  );
});

it('mutates the interactions of the story test code and kills them', () => {
  assert.deepEqual(muirMutants(testCode, 'src/Counter.stories.tsx'), [
    "18:5 MuirProteusStorybookTestClickFocus await canvas.getByRole('button', { name: 'Add' }).focus(); Killed",
    '18:5 MuirProteusStorybookTestInteraction ; Killed',
  ]);
  assert.deepEqual(muirMutants(testCode, 'src/Pinger.stories.tsx'), [
    "18:5 MuirProteusStorybookTestClickFocus await canvas.getByRole('button', { name: 'idle' }).focus(); Killed",
    '18:5 MuirProteusStorybookTestInteraction ; Killed',
  ]);
  assert.match(
    testCode.output,
    /no spy stub findings and no static story mutants/,
  );
});

it('leaves nothing in its temporary directory after either run', () => {
  assert.deepEqual(
    [...muirLeftover(components), ...muirLeftover(testCode)],
    [],
  );
});
