import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import { fixupConfigRules } from '@eslint/compat';
import nx from '@nx/eslint-plugin';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import n from 'eslint-plugin-n';
import nodeTest from 'eslint-node-test';
import playwright from 'eslint-plugin-playwright';
import jsoncParser from 'jsonc-eslint-parser';
import tseslint from 'typescript-eslint';

// The workspace joins two rule sets: the node:test projects' and the Playwright and Storybook projects'. The
// node:test projects lint through their own eslint.config.mjs, which spreads this one, so their globs are relative to
// the project; every other project lints through this file, so the Playwright globs are relative to the root.
const playwrightProjects = [
  'apps/**',
  'oss/**',
  'tools/*.ts',
  'tools/packed-demo/**',
  'packages/moira-storybook/**',
  'packages/pixie-storybook-vite/**',
  'packages/proteus-react/**',
  'packages/proteus-msw/**',
  'packages/moira-mutators/**',
  'packages/proteus-playwright/**',
  'packages/siryn-playwright/**',
  'packages/shadowcat-js/**',
  'packages/shadowcat-react/**',
  'packages/shadowcat-storybook/**',
  'packages/shadowcat-telemetry/**',
  'packages/proteus-storybook/**',
  'packages/proteus-storybook-test/**',
  'packages/test-util-ignorer-packages/**',
  'packages/test-util-mutator-packages/**',
];

/** Limits configs to the Playwright projects: a file must match one project glob and the config's own files. */
function inPlaywrightProjects(configs) {
  return configs.map(({ files, ...config }) => ({
    ...config,
    files: playwrightProjects.flatMap((project) =>
      files
        ? files.map((pattern) => [
            project,
            ...(Array.isArray(pattern) ? pattern : [pattern]),
          ])
        : [project],
    ),
  }));
}

/** Keeps configs off the Playwright projects. */
function outsidePlaywrightProjects(configs) {
  return configs.map((config) => ({
    ...config,
    ignores: [...(config.ignores ?? []), ...playwrightProjects],
  }));
}

function raiseWarning(level) {
  if (level === 'warn' || level === 1) {
    return 'error';
  }

  if (Array.isArray(level)) {
    return [raiseWarning(level[0]), ...level.slice(1)];
  }

  return level;
}

/** Every enabled rule reports at error, including those a preset or plugin sets to warn. */
export function withWarningsAsErrors(configs) {
  return configs.map((config) =>
    config.rules
      ? {
          ...config,
          rules: Object.fromEntries(
            Object.entries(config.rules).map(([rule, level]) => [
              rule,
              raiseWarning(level),
            ]),
          ),
        }
      : config,
  );
}

/** A library's files may depend on libraries, and its test files on test-util projects too (docs/adr ADR-0008). */
function moduleBoundaries(testUtilTags) {
  return [
    'error',
    {
      enforceBuildableLibDependency: true,
      allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
      depConstraints: [
        {
          sourceTag: 'type:lib',
          onlyDependOnLibsWithTags: ['type:lib', ...testUtilTags],
        },
        {
          sourceTag: 'type:tool',
          onlyDependOnLibsWithTags: ['type:lib'],
        },
        {
          sourceTag: 'type:test-util',
          onlyDependOnLibsWithTags: ['type:test-util', 'type:lib'],
        },
        {
          sourceTag: 'type:app',
          onlyDependOnLibsWithTags: ['type:lib'],
        },
        {
          sourceTag: 'type:e2e',
          onlyDependOnLibsWithTags: ['type:app', 'type:lib'],
        },
      ],
    },
  ];
}

// node:test projects

// Relative to the config ESLint loads: the root one or a package's, which spreads this one.
// The workspace's ESLint rules keep their tests beside them, outside src/ and test/.
const toolTest = ['tools/eslint-rules/*.test.ts'];
const src = ['**/src/**/*.ts', 'tools/eslint-rules/*.ts'];
const test = ['**/test/**/*.ts', ...toolTest];
// Code samples the mutators' tests mutate, not tests.
const synthetic = ['**/test/synthetic/**'];
// Consumer projects the e2e suite installs; they break workspace rules on purpose.
const e2eFixtures = ['**/e2e/fixtures/**'];

// The rules of typescript-eslint's strict-type-checked preset, spread into the src and test block; the nx configs
// already set up its parser and plugin.
const strictTypeChecked = Object.assign(
  {},
  ...tseslint.configs.strictTypeChecked.map(({ rules }) => rules ?? {}),
);

const declared = ':matches(TSInterfaceDeclaration, TSTypeAliasDeclaration)';
// Every block that sets no-restricted-syntax spreads these: a later block replaces the rule's options.
const readonlyMembers = [
  {
    selector: `${declared} TSPropertySignature:not([readonly=true])`,
    message: 'Mark the member readonly.',
  },
  {
    selector: `${declared} TSPropertySignature :not(TSTypeOperator[operator='readonly']) > TSArrayType`,
    message: 'Use readonly T[] for an array in a declared type.',
  },
  {
    selector: `${declared} TSPropertySignature TSTypeReference[typeName.name='Array']`,
    message: 'Use ReadonlyArray<T> for Array<T> in a declared type.',
  },
];

// Spread into every block that sets no-restricted-syntax for src or tests, for the same reason.
const noTypeAssertions = [
  {
    // Also `as const`, which consistent-type-assertions allows.
    selector: 'TSAsExpression, TSTypeAssertion',
    message:
      'Stryker 10 mutates nothing inside an `as` expression. Annotate the binding, use `satisfies`, or Object.freeze() a literal table instead.',
  },
];

// Spread beside noTypeAssertions. Runtime-private # members replace the TypeScript modifier.
const noPrivateModifier = [
  {
    selector:
      ':matches(PropertyDefinition, MethodDefinition, TSParameterProperty, AccessorProperty, TSAbstractPropertyDefinition, TSAbstractMethodDefinition)[accessibility="private"]',
    message: 'Use a # member instead of the private modifier.',
  },
];

// A disable of one of these lets a cast, an any or an unchecked claim through; prove the type instead. The list holds
// no-restricted-syntax for its `as` ban, so its other bans cannot be disabled either.
const undisableableRules = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-unsafe-*',
  '@typescript-eslint/consistent-type-assertions',
  '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/ban-ts-comment',
  'no-restricted-syntax',
  '@typescript-eslint/no-misused-promises',
];

const nodeTestConfigs = [
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs'],
    plugins: comments.recommended.plugins,
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      // A file-level disable at the top of a file needs no matching enable.
      '@eslint-community/eslint-comments/disable-enable-pair': [
        'error',
        { allowWholeFile: true },
      ],
      '@eslint-community/eslint-comments/no-restricted-disable': [
        'error',
        ...undisableableRules,
      ],
    },
  },
  {
    // @types/node types an assert.register function as returning void, but node:test returns its promise to the
    // caller, so this file's async reports assertion keeps its no-misused-promises disable.
    files: ['**/test/reported.fixtures.ts'],
    rules: {
      '@eslint-community/eslint-comments/no-restricted-disable': [
        'error',
        ...undisableableRules.filter(
          (rule) => rule !== '@typescript-eslint/no-misused-promises',
        ),
      ],
    },
  },
  {
    // flat/javascript sets these three to warn; every enabled rule runs at error.
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': moduleBoundaries([]),
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': moduleBoundaries(['type:test-util']),
    },
  },
  {
    files: ['**/*.ts', '**/*.mjs'],
    rules: { '@nx/workspace-require-windows-hide': 'error' },
  },
  {
    files: [...src, ...test],
    plugins: { n },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { n: { version: '^22.18.0 || >=24.0.0' } },
    rules: {
      'n/no-deprecated-api': 'error',
      'n/no-unsupported-features/node-builtins': [
        'error',
        { ignores: ['module.registerHooks', 'util.getCallSites'] },
      ],
      'n/no-unsupported-features/es-builtins': 'error',
      'n/no-unsupported-features/es-syntax': 'error',
      'n/prefer-node-protocol': 'error',
      'n/prefer-promises/fs': 'error',
      'n/prefer-promises/dns': 'error',
      'n/no-path-concat': 'error',
      'preserve-caught-error': 'error',
      ...strictTypeChecked,
      '@typescript-eslint/no-floating-promises': [
        'error',
        // Never add 'test': it also silences an un-awaited t.test() subtest.
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['it', 'describe', 'suite'],
            },
          ],
        },
      ],
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          ...strictTypeChecked[
            '@typescript-eslint/restrict-template-expressions'
          ][1],
          // Looser than the preset: a number has one rendering in a template literal, so String() around it adds
          // noise and catches nothing. Nullish, boolean, object and any values are still reported.
          allowNumber: true,
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // src passes on a caught value, typed unknown, that may be no Error; tests reject with such values to cover it.
      '@typescript-eslint/prefer-promise-reject-errors': [
        'error',
        { allowThrowingUnknown: true },
      ],
      '@typescript-eslint/only-throw-error': [
        'error',
        { allowThrowingUnknown: true },
      ],
      // The core rule rewrites a bracket access to an index signature, which noPropertyAccessFromIndexSignature
      // refuses; this one allows it under that flag.
      'dot-notation': 'off',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      // Augmenting node:test's types takes a namespace inside `declare module`.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@nx/workspace-stryker-disable-comment': 'error',
    },
  },
  {
    files: src,
    ignores: toolTest,
    rules: {
      'n/no-process-exit': 'error',
      'n/no-extraneous-import': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.name=/^set(Timeout|Interval)$/][arguments.length<2]',
          message:
            'Pass the delay explicitly, so MuirProteusNodeTimerDelay can mutate it.',
        },
        ...noTypeAssertions,
        ...noPrivateModifier,
        ...readonlyMembers,
      ],
    },
  },
  {
    files: [...src, ...test],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...['node:assert', 'assert', 'assert/strict'].map((name) => ({
              name,
              message:
                "Import assert from 'node:assert/strict', whose equal and deepEqual are the strict methods.",
            })),
            {
              name: 'node:test',
              importNames: ['before', 'after', 'beforeEach', 'afterEach'],
              message:
                'Shared hooks hide what a test starts from. Write a setup function each test calls, and clean up per test with t.after.',
            },
          ],
        },
      ],
    },
  },
  {
    // Test rules stay off src: @muirjs/madrox-node-test's src imports node:test as a library.
    files: test,
    plugins: { 'node-test': nodeTest },
    rules: {
      ...nodeTest.configs.recommended.rules,
      'node-test/prefer-test-context-assert': 'off',
      'node-test/no-import-test-files': 'off',
      'node-test/no-process-env-mutation': 'off',
      'node-test/no-process-exit-in-test': 'off',
      'node-test/no-export': 'off',
      'node-test/no-done-callback': 'error',
      'node-test/no-skip-without-reason': 'error',
      'node-test/no-commented-tests': 'error',
      'node-test/no-snapshot-in-loop': 'error',
      'node-test/no-assert-in-hook': 'error',
      // The tests' empty functions are no-op test doubles.
      '@typescript-eslint/no-empty-function': 'off',
      '@nx/workspace-no-assertion-in-iteration': 'error',
      'no-restricted-properties': [
        'error',
        ...['muirTestEach', 'muirTestFor'].map((object) => ({
          object,
          property: 'only',
          message:
            'Remove .only before committing: it makes node:test --test-only skip every other test.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        ...noTypeAssertions,
        ...noPrivateModifier,
        ...readonlyMembers,
      ],
    },
  },
  {
    files: ['**/test/**/*.test.ts', ...toolTest],
    rules: { 'node-test/no-export': 'error' },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      // It asks for `!` in place of `as NonNullable<T>`, both of which the two rules above report.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      // Deprecated in favour of no-empty-object-type, which reports the same node.
      '@typescript-eslint/no-empty-interface': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.mjs'],
    rules: {
      // eslint-config-prettier turns it off, but 'all' never conflicts with Prettier.
      curly: ['error', 'all'],
      '@typescript-eslint/naming-convention': [
        'error',
        // Applies to variables only; environment variable names are string keys and keep UPPER_SNAKE_CASE.
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase'],
          custom: { regex: '^[A-Z][A-Z0-9]+$', match: false },
        },
        { selector: 'variable', modifiers: ['destructured'], format: null },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          custom: { regex: '^T([A-Z][A-Za-z0-9]*)?$', match: true },
        },
      ],
    },
  },
];

// Playwright and Storybook projects

const playwrightRecommended = playwright.configs['flat/recommended'];

function dependencyChecks(ignoredDependencies) {
  return [
    'error',
    {
      ignoredDependencies,
      ignoredFiles: [
        '{projectRoot}/test/**',
        '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
      ],
    },
  ];
}

const declaredType = ':matches(TSInterfaceDeclaration, TSTypeAliasDeclaration)';

const typeSafetyRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    { assertionStyle: 'never' },
  ],
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-expect-error': true,
      'ts-ignore': true,
      'ts-nocheck': true,
      'ts-check': false,
    },
  ],
  'dot-notation': 'off',
  '@typescript-eslint/dot-notation': 'error',
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'variable',
      format: ['camelCase', 'PascalCase'],
      custom: { regex: '^[A-Z][A-Z0-9]+$', match: false },
    },
    { selector: 'variable', modifiers: ['destructured'], format: null },
    {
      selector: 'typeParameter',
      format: ['PascalCase'],
      custom: { regex: '^T([A-Z][A-Za-z0-9]*)?$', match: true },
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: `${declaredType} TSPropertySignature:not([readonly=true])`,
      message: 'Mark the member readonly.',
    },
    {
      selector: `${declaredType} TSPropertySignature :not(TSTypeOperator[operator='readonly']) > TSArrayType`,
      message: 'Use readonly T[] or ReadonlyArray<T>.',
    },
    {
      selector: `${declaredType} TSPropertySignature TSTypeReference[typeName.name='Array']`,
      message: 'Use readonly T[] or ReadonlyArray<T>.',
    },
    {
      selector:
        ':matches(PropertyDefinition, MethodDefinition, TSParameterProperty, AccessorProperty, TSAbstractPropertyDefinition, TSAbstractMethodDefinition)[accessibility="private"]',
      message: 'Use a # member instead of the private modifier.',
    },
  ],
};

const playwrightConfigs = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  // The React, jsx-a11y and import plugins call context methods that ESLint 10 removed; fixupConfigRules restores them.
  ...fixupConfigRules(nx.configs['flat/react']).map((config) => ({
    ...config,
    files: (config.files ?? ['**/*']).map((pattern) => [
      'apps/demo-app/**',
      pattern,
    ]),
  })),
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': moduleBoundaries([]),
    },
  },
  {
    files: ['packages/*/test/**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': moduleBoundaries(['type:test-util']),
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {
      // Deprecated; their replacements, no-empty-object-type and no-global-assign, are on.
      '@typescript-eslint/no-empty-interface': 'off',
      'no-native-reassign': 'off',
      // Object.assign({}, proven, ...) types as a Proven (T & U) without being one; a spread does not.
      'prefer-object-spread': 'error',
    },
  },
  {
    files: ['packages/**/*.ts', 'packages/**/*.tsx'],
    ignores: ['packages/proteus-react/test/corpus/**'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeSafetyRules,
  },
  {
    files: ['tools/*.ts'],
    languageOptions: {
      parserOptions: {
        // The project service finds only the nearest tsconfig.json; the tools belong to tsconfig.tools.json.
        project: ['tsconfig.tools.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeSafetyRules,
  },
  {
    files: ['tools/bench-playwright-runs.ts'],
    rules: {
      // The benchmark reads internals of the runner that the package does not export.
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  ...fixupConfigRules({
    files: [
      'apps/demo-app/**/*.ts',
      'apps/demo-app/**/*.tsx',
      'apps/demo-app/**/*.js',
      'apps/demo-app/**/*.jsx',
    ],
    // Not flatConfigs.strict whole: its plugin object differs from the package export that flat/react
    // registers, and ESLint refuses two objects under one plugin name.
    plugins: { 'jsx-a11y': jsxA11y },
    rules: jsxA11y.flatConfigs.strict.rules,
  }),
  {
    files: ['**/*.spec.ts', '**/playwright*.config.{ts,mts}'],
    ...playwrightRecommended,
    rules: {
      ...playwrightRecommended.rules,
      'playwright/no-commented-out-tests': 'error',
      'playwright/no-get-by-title': 'error',
      'playwright/no-raw-locators': 'error',
      'playwright/prefer-native-locators': 'error',
      'playwright/no-nth-methods': 'error',
      'playwright/no-action-timeout': 'error',
      'playwright/no-slowed-test': 'error',
      'playwright/require-to-pass-timeout': 'error',
      'playwright/prefer-comparison-matcher': 'error',
      'playwright/prefer-equality-matcher': 'error',
      'playwright/prefer-to-be': 'error',
      'playwright/prefer-to-contain': 'error',
      'playwright/prefer-lowercase-title': 'error',
      'playwright/no-template-literal-title': 'error',
      'playwright/no-test-return-statement': 'error',
      'playwright/no-export': 'error',
      'playwright/require-annotation-reason': 'error',
      'playwright/no-magic-timeouts': 'error',
      'playwright/missing-playwright-await': [
        'error',
        { includePageLocatorMethods: true },
      ],
    },
  },
  {
    files: ['packages/*/package.json'],
    languageOptions: { parser: jsoncParser },
    rules: {
      // Core is the plugin host, resolved at run time rather than imported.
      '@nx/dependency-checks': dependencyChecks(['@stryker-mutator/core']),
    },
  },
  {
    files: [
      'packages/proteus-react/package.json',
      'packages/proteus-storybook-test/package.json',
      'packages/proteus-storybook/package.json',
      'packages/proteus-msw/package.json',
    ],
    rules: {
      // The mutators import Babel for types only.
      '@nx/dependency-checks': dependencyChecks([
        '@stryker-mutator/core',
        '@babel/core',
      ]),
    },
  },
];

export default withWarningsAsErrors([
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/.stryker-tmp',
      '**/vite.config.*.timestamp*',
      '**/test-output',
      '**/test-results',
      ...synthetic,
      ...e2eFixtures,
      // Instrumented bundles that the browser tests write before each run.
      'packages/siryn-playwright/test/**/public/*.js',
      'packages/siryn-playwright/test/browser/load-fixture/pages/unused.js',
    ],
  },
  ...outsidePlaywrightProjects(nodeTestConfigs),
  ...inPlaywrightProjects(playwrightConfigs),
]);
