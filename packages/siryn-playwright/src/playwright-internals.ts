import { createRequire } from 'node:module';
import { inspect } from 'node:util';

import type { FullResult, Reporter } from '@playwright/test/reporter';

import {
  muirSirynPlaywrightFieldOf,
  muirSirynPlaywrightIsRecord,
} from './is-record.ts';
import type { MuirSirynPlaywrightPageSettings } from './protocol.ts';

type Status = FullResult['status'];

export interface MuirSirynPlaywrightRunTestsParams {
  readonly locations: readonly string[];
  readonly testIds?: readonly string[] | undefined;
  readonly projects?: readonly string[] | undefined;
  readonly workers?: number;
  readonly maxFailures?: number | undefined;
  readonly timeout?: number | undefined;
  readonly disableConfigReporters?: boolean;
}

export interface MuirSirynPlaywrightConfigProject {
  readonly default: boolean;
  readonly expect?: { readonly timeout?: number | undefined } | undefined;
  readonly project: {
    readonly name: string;
    readonly timeout: number;
    readonly retries: number;
  };
  readonly baseURL?: string | undefined;
}

export interface MuirSirynPlaywrightConfigWebServer {
  readonly url?: string | undefined;
  /**
   * The port to check with a TCP connection instead of fetching the url, as Playwright's `checkPortOnly`
   * does: the config's port, or the url's port when the config sets a port that is not `undefined` next to
   * a url.
   */
  readonly port?: number | undefined;
  readonly ignoreHTTPSErrors: boolean;
  readonly reuseExistingServer: boolean;
  /** Whether its `env` sets NODE_OPTIONS, which Playwright puts over the runner's process.env. */
  readonly setsNodeOptions: boolean;
}

export interface MuirSirynPlaywrightInternalTestRunner {
  initialize(params: Record<string, never>): Promise<void>;
  loadConfig(): Promise<{
    readonly projects: readonly MuirSirynPlaywrightConfigProject[];
    readonly webServers: readonly MuirSirynPlaywrightConfigWebServer[];
  }>;
  // Resolves to undefined when Playwright throws, after printing the error to stderr.
  listTests(
    reporter: Reporter,
    params: { readonly projects?: readonly string[] },
  ): Promise<{ readonly status: Status } | undefined>;
  runGlobalSetup(
    reporters: readonly Reporter[],
  ): Promise<{ readonly status: Status }>;
  runGlobalTeardown(): Promise<void>;
  runTests(
    reporter: Reporter,
    params: MuirSirynPlaywrightRunTestsParams,
  ): Promise<{ readonly status: Status }>;
  stopTests(): Promise<void>;
}

export interface MuirSirynPlaywrightConfigHandles {
  /**
   * The live `_options` of the webServer plugin at `index` among the webServer plugins the last loadConfig()
   * created. Global setup starts that webServer from them.
   */
  webServerOptions(index: number): Record<string, unknown>;
  /** The CLI overrides Playwright merges over each project's use. */
  cliOverrides(): Record<string, unknown>;
}

export interface MuirSirynPlaywrightProjectSelection {
  projectsRun(
    names: readonly string[] | undefined,
  ): readonly MuirSirynPlaywrightConfigProject[];
}

export const muirSirynPlaywrightTestRunnerMethods = [
  'initialize',
  'loadConfig',
  'listTests',
  'runGlobalSetup',
  'runGlobalTeardown',
  'runTests',
  'stopTests',
] as const satisfies readonly (keyof MuirSirynPlaywrightInternalTestRunner)[];

export interface MuirSirynPlaywrightCoreBundleModule {
  readonly utils: {
    isURLAvailable(url: URL, ignoreHTTPSErrors: boolean): Promise<boolean>;
  };
}

export interface MuirSirynPlaywrightCommonModule {
  readonly configLoader: {
    resolveConfigLocation(configFile: string | undefined): unknown;
  };
}

export const muirSirynPlaywrightMinPlaywright: {
  readonly major: number;
  readonly minor: number;
} = { major: 1, minor: 63 };

export const muirSirynPlaywrightWorkerEntry =
  /[\\/]playwright[\\/]lib[\\/]worker[\\/]workerProcessEntry\.js$/;

/**
 * Turns off the aria snapshot Playwright takes of a failed test's page for its error prompt. On a page
 * stuck in a loop it waits out its 5 s timeout and pushes the run past Stryker's.
 */
export const muirSirynPlaywrightNoCopyPromptEnv = 'PLAYWRIGHT_NO_COPY_PROMPT';

export interface MuirSirynPlaywrightHookedFrame {
  evaluate(fn: (name: string) => unknown, name: string): Promise<unknown>;
  isDetached(): boolean;
}

export interface MuirSirynPlaywrightHookedPage {
  frames(): MuirSirynPlaywrightHookedFrame[];
  close(options?: unknown): Promise<void>;
}

export interface MuirSirynPlaywrightHookedBrowser {
  contexts(): MuirSirynPlaywrightHookedContext[];
  close(options?: unknown): Promise<void>;
}

export interface MuirSirynPlaywrightHookedContext {
  pages(): MuirSirynPlaywrightHookedPage[];
  browser(): MuirSirynPlaywrightHookedBrowser | null;
  on(
    event: 'page',
    handler: (page: MuirSirynPlaywrightHookedPage) => void,
  ): unknown;
  addInitScript(
    script:
      | ((settings: MuirSirynPlaywrightPageSettings) => void)
      | { readonly content: string },
    settings?: MuirSirynPlaywrightPageSettings,
  ): Promise<unknown>;
  route(
    url: (url: URL) => boolean,
    handler: (route: MuirSirynPlaywrightHookedRoute) => Promise<void>,
  ): Promise<unknown>;
}

export interface MuirSirynPlaywrightHookedRoute {
  request(): { headers(): Record<string, string> };
  fallback(options?: {
    readonly headers: Readonly<Record<string, string>>;
  }): Promise<void>;
}

export interface MuirSirynPlaywrightFetchOptions {
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly [option: string]: unknown;
}

export interface MuirSirynPlaywrightHookedRequestContext {
  readonly fetch: (
    target: string | { headers(): Record<string, string> },
    options?: MuirSirynPlaywrightFetchOptions,
  ) => Promise<unknown>;
}

export interface MuirSirynPlaywrightInstrumentation {
  addListener(listener: {
    runAfterCreateBrowserContext?(
      context: MuirSirynPlaywrightHookedContext,
    ): Promise<void>;
    runBeforeCloseBrowserContext?(
      context: MuirSirynPlaywrightHookedContext,
    ): Promise<void>;
    runAfterCreateRequestContext?(
      context: MuirSirynPlaywrightHookedRequestContext,
    ): Promise<void>;
  }): void;
}

export interface MuirSirynPlaywright {
  readonly version: string;
  createTestRunner(
    configFile: string | undefined,
    overrides: Record<string, unknown>,
  ): Promise<
    MuirSirynPlaywrightInternalTestRunner &
      MuirSirynPlaywrightConfigHandles &
      MuirSirynPlaywrightProjectSelection
  >;
  readonly isURLAvailable: MuirSirynPlaywrightCoreBundleModule['utils']['isURLAvailable'];
}

export function muirSirynPlaywrightSupportsPlaywright(
  version: string,
): boolean {
  const [major, minor = NaN] = version.split('.').map(Number);

  return (
    major === muirSirynPlaywrightMinPlaywright.major &&
    minor >= muirSirynPlaywrightMinPlaywright.minor
  );
}

export function muirSirynPlaywrightProbeInternals(
  version: string,
  modules: {
    runner: unknown;
    common: unknown;
    coreBundle: unknown;
  },
): MuirSirynPlaywright {
  const { runner, common, coreBundle } = modules;
  const TestRunner = muirSirynPlaywrightFieldOf(
    muirSirynPlaywrightFieldOf(runner, 'testRunner'),
    'TestRunner',
  );
  const projectUtils = muirSirynPlaywrightFieldOf(runner, 'projectUtils');
  const filterProjects = muirSirynPlaywrightFieldOf(
    projectUtils,
    'filterProjects',
  );
  const buildProjectsClosure = muirSirynPlaywrightFieldOf(
    projectUtils,
    'buildProjectsClosure',
  );
  const configLoader = muirSirynPlaywrightFieldOf(common, 'configLoader');
  const resolveConfigLocation = muirSirynPlaywrightFieldOf(
    configLoader,
    'resolveConfigLocation',
  );
  const isURLAvailable = muirSirynPlaywrightFieldOf(
    muirSirynPlaywrightFieldOf(coreBundle, 'utils'),
    'isURLAvailable',
  );

  const changed = () =>
    muirSirynPlaywrightInternalsChanged(
      version,
      `playwright/lib/runner TestRunner with ${muirSirynPlaywrightTestRunnerMethods.join(', ')}, and projectUtils filterProjects and buildProjectsClosure; playwright/lib/common configLoader; playwright-core coreBundle isURLAvailable`,
    );

  if (
    typeof TestRunner !== 'function' ||
    typeof filterProjects !== 'function' ||
    typeof buildProjectsClosure !== 'function' ||
    typeof resolveConfigLocation !== 'function' ||
    typeof isURLAvailable !== 'function'
  ) {
    throw changed();
  }

  const methodOf = (
    source: unknown,
    name: keyof MuirSirynPlaywrightInternalTestRunner,
  ) => {
    const method = muirSirynPlaywrightFieldOf(source, name);

    if (typeof method !== 'function') {
      throw changed();
    }

    return method;
  };
  const prototype: unknown = TestRunner.prototype;
  const methods = Object.fromEntries(
    muirSirynPlaywrightTestRunnerMethods.map((name) => [
      name,
      methodOf(prototype, name),
    ]),
  );

  return {
    version,
    async createTestRunner(configFile, overrides) {
      const configLocation: unknown = Reflect.apply(
        resolveConfigLocation,
        configLoader,
        [configFile],
      );
      const created: unknown = Reflect.construct(TestRunner, [
        configLocation,
        overrides,
      ]);
      const call = (
        name: keyof MuirSirynPlaywrightInternalTestRunner,
        args: readonly unknown[],
      ): unknown => Reflect.apply(methodOf(methods, name), created, args);
      const status = async (
        method: 'runGlobalSetup' | 'runTests',
        args: readonly unknown[],
      ) => parseStatus(await call(method, args), method, version);
      let loaded: unknown;
      const handlesChanged = () =>
        muirSirynPlaywrightInternalsChanged(
          version,
          `TestRunner._configCLIOverrides and loadConfig() resolving to plugins[].factory named ${webServerPluginName} with _options`,
        );
      const runner: MuirSirynPlaywrightInternalTestRunner &
        MuirSirynPlaywrightConfigHandles &
        MuirSirynPlaywrightProjectSelection = {
        async initialize(params) {
          await call('initialize', [params]);
        },
        async loadConfig() {
          loaded = await call('loadConfig', []);

          return parseConfig(loaded, version);
        },
        async listTests(reporter, params) {
          const result = await call('listTests', [reporter, params]);

          return result === undefined
            ? undefined
            : parseStatus(result, 'listTests', version);
        },
        runGlobalSetup: (reporters) => status('runGlobalSetup', [reporters]),
        async runGlobalTeardown() {
          await call('runGlobalTeardown', []);
        },
        runTests: (reporter, params) => status('runTests', [reporter, params]),
        async stopTests() {
          await call('stopTests', []);
        },
        webServerOptions(index) {
          const plugins = muirSirynPlaywrightFieldOf(loaded, 'plugins');

          if (!Array.isArray(plugins)) {
            throw handlesChanged();
          }

          const options = plugins.flatMap((plugin: unknown) => {
            const factory = muirSirynPlaywrightFieldOf(plugin, 'factory');
            const pluginOptions = muirSirynPlaywrightFieldOf(
              factory,
              '_options',
            );

            return muirSirynPlaywrightFieldOf(factory, 'name') ===
              webServerPluginName && muirSirynPlaywrightIsRecord(pluginOptions)
              ? [pluginOptions]
              : [];
          })[index];

          if (!options) {
            throw handlesChanged();
          }

          return options;
        },
        cliOverrides() {
          const overrides = muirSirynPlaywrightFieldOf(
            created,
            '_configCLIOverrides',
          );

          if (!muirSirynPlaywrightIsRecord(overrides)) {
            throw handlesChanged();
          }

          return overrides;
        },
        projectsRun(names) {
          const projects = muirSirynPlaywrightFieldOf(loaded, 'projects');

          if (!Array.isArray(projects)) {
            throw new Error(
              'The runner asked for the projects a run runs before it loaded the Playwright config.',
            );
          }

          // Like runTests, no names for an empty list: Playwright 1.63 then runs every project, 1.64 the default ones.
          const selected: unknown = Reflect.apply(
            filterProjects,
            projectUtils,
            [projects, names?.length ? names : undefined],
          );
          const closure: unknown = Reflect.apply(
            buildProjectsClosure,
            projectUtils,
            [selected],
          );

          if (!(closure instanceof Map)) {
            throw changed();
          }

          return projects
            .filter((project: unknown) => closure.has(project))
            .map((project: unknown) => parseProject(project, version));
        },
      };
      await runner.initialize({});

      return runner;
    },
    async isURLAvailable(url, ignoreHTTPSErrors) {
      const available: unknown = await Reflect.apply(
        isURLAvailable,
        undefined,
        [url, ignoreHTTPSErrors],
      );

      return available === true;
    },
  };
}

const statuses: readonly Status[] = [
  'passed',
  'failed',
  'timedout',
  'interrupted',
];

function parseStatus(
  value: unknown,
  method: string,
  version: string,
): { status: Status } {
  const status = muirSirynPlaywrightFieldOf(value, 'status');
  const known = statuses.find((candidate) => candidate === status);

  if (known === undefined) {
    throw muirSirynPlaywrightInternalsChanged(
      version,
      `TestRunner.${method}() resolving to a status of passed, failed, timedout or interrupted`,
    );
  }

  return { status: known };
}

const configChanged = (version: string) =>
  muirSirynPlaywrightInternalsChanged(
    version,
    'TestRunner.loadConfig() resolving to projects[].default, project.name, project.timeout, project.retries and ' +
      'expect.timeout, and webServers[].url, port and ignoreHTTPSErrors',
  );

function parseConfig(
  value: unknown,
  version: string,
): Awaited<ReturnType<MuirSirynPlaywrightInternalTestRunner['loadConfig']>> {
  const projects = muirSirynPlaywrightFieldOf(value, 'projects');
  const webServers = muirSirynPlaywrightFieldOf(value, 'webServers');

  if (!Array.isArray(projects) || !Array.isArray(webServers)) {
    throw configChanged(version);
  }

  return {
    projects: projects.map((project: unknown) =>
      parseProject(project, version),
    ),
    webServers: webServers.map(
      (server: unknown): MuirSirynPlaywrightConfigWebServer => {
        const configUrl =
          muirSirynPlaywrightFieldOf(server, 'url') || undefined;
        const url = configUrl instanceof URL ? configUrl.href : configUrl;
        const configPort = muirSirynPlaywrightFieldOf(server, 'port');
        const port = configPort || undefined;

        if (!muirSirynPlaywrightIsRecord(server)) {
          throw misconfigured('webServer', 'an object', server);
        }

        if (url !== undefined && typeof url !== 'string') {
          throw misconfigured('webServer.url', 'a string or a URL', url);
        }

        if (
          port !== undefined &&
          typeof port !== 'number' &&
          !(typeof port === 'string' && /^\d+$/.test(port))
        ) {
          throw misconfigured(
            'webServer.port',
            'a number or a string of digits',
            port,
          );
        }

        const checkedPort =
          url !== undefined && configPort !== undefined
            ? new URL(url).port
            : port;
        const env = server['env'];

        return {
          url,
          port: checkedPort === undefined ? undefined : Number(checkedPort),
          ignoreHTTPSErrors: !!server['ignoreHTTPSErrors'],
          reuseExistingServer: !!server['reuseExistingServer'],
          setsNodeOptions:
            muirSirynPlaywrightIsRecord(env) &&
            env['NODE_OPTIONS'] !== undefined,
        };
      },
    ),
  };
}

function parseProject(
  project: unknown,
  version: string,
): MuirSirynPlaywrightConfigProject {
  const settings = muirSirynPlaywrightFieldOf(project, 'project');
  const expect = muirSirynPlaywrightFieldOf(project, 'expect');
  const expectTimeout =
    muirSirynPlaywrightFieldOf(expect, 'timeout') ?? undefined;
  const retries = muirSirynPlaywrightFieldOf(settings, 'retries');
  const baseURL = muirSirynPlaywrightFieldOf(
    muirSirynPlaywrightFieldOf(settings, 'use'),
    'baseURL',
  );

  if (
    !muirSirynPlaywrightIsRecord(project) ||
    !muirSirynPlaywrightIsRecord(settings) ||
    typeof settings['name'] !== 'string' ||
    typeof settings['timeout'] !== 'number' ||
    typeof retries !== 'number' ||
    (expect !== undefined && !muirSirynPlaywrightIsRecord(expect)) ||
    (expectTimeout !== undefined && typeof expectTimeout !== 'number')
  ) {
    throw configChanged(version);
  }

  return {
    default: !!project['default'],
    expect: expect === undefined ? undefined : { timeout: expectTimeout },
    project: {
      name: settings['name'],
      timeout: settings['timeout'],
      retries,
    },
    ...(typeof baseURL === 'string' ? { baseURL } : {}),
  };
}

const webServerPluginName = 'playwright:webserver';

/**
 * Playwright's runTests sets retries to 0 for every project (playwright 1.64.1 lib/runner/index.js:7010). Its
 * dispatcher reads each test's retries from the TestCase objects that onBegin receives (lib/runner/index.js:6128,
 * set at lib/common/index.js:2060), so the runner raises them there. A test whose describe.configure({ retries })
 * set a number keeps it, unless that number is 0. Each project suite is titled with its project's name
 * (lib/runner/index.js:6614).
 */
export function muirSirynPlaywrightRaiseRetries(
  suite: unknown,
  retriesByProject: ReadonlyMap<string, number>,
): void {
  const projects = muirSirynPlaywrightFieldOf(suite, 'suites');

  if (!Array.isArray(projects)) {
    throw retriesChanged();
  }

  projects.forEach((project: unknown) => {
    const title = muirSirynPlaywrightFieldOf(project, 'title');
    const allTests = muirSirynPlaywrightFieldOf(project, 'allTests');
    const retries =
      typeof title === 'string' ? retriesByProject.get(title) : undefined;

    if (retries === undefined || typeof allTests !== 'function') {
      throw retriesChanged();
    }

    const tests: unknown = allTests.call(project);

    if (!Array.isArray(tests)) {
      throw retriesChanged();
    }

    tests.forEach((test: unknown) => {
      if (
        !muirSirynPlaywrightIsRecord(test) ||
        typeof test['retries'] !== 'number'
      ) {
        throw retriesChanged();
      }

      if (test['retries'] === 0) {
        test['retries'] = retries;
      }
    });
  });
}

function retriesChanged(): Error {
  return muirSirynPlaywrightInternalsChanged(
    undefined,
    'the root suite onBegin receives, with project suites and TestCase.retries',
  );
}

export function muirSirynPlaywrightVersion(
  playwrightRequire: (id: string) => unknown,
): string {
  const version = muirSirynPlaywrightFieldOf(
    playwrightRequire('playwright/package.json'),
    'version',
  );

  if (typeof version !== 'string') {
    throw muirSirynPlaywrightInternalsChanged(
      undefined,
      'playwright/package.json with a string version',
    );
  }

  return version;
}

export function muirSirynPlaywrightLoadPlaywright(
  configFile: string | undefined,
): MuirSirynPlaywright {
  const testRequire = createRequire(
    createRequire(configFile ?? `${process.cwd()}/package.json`).resolve(
      '@playwright/test',
    ),
  );
  // playwright-core is a dependency of playwright, not of @playwright/test, so resolve it from
  // playwright for layouts that do not hoist (pnpm).
  const playwrightRequire = createRequire(
    testRequire.resolve('playwright/package.json'),
  );
  const version = muirSirynPlaywrightVersion(playwrightRequire);

  if (!muirSirynPlaywrightSupportsPlaywright(version)) {
    throw new Error(
      `The Playwright test runner needs Playwright ${muirSirynPlaywrightMinPlaywright.major}.${muirSirynPlaywrightMinPlaywright.minor} or a later ${muirSirynPlaywrightMinPlaywright.major}.x release, found ${version}.`,
    );
  }

  return muirSirynPlaywrightProbeInternals(version, {
    runner: playwrightRequire('playwright/lib/runner'),
    common: playwrightRequire('playwright/lib/common'),
    coreBundle: playwrightRequire('playwright-core/lib/coreBundle'),
  });
}

export function muirSirynPlaywrightInstrumentationOf(
  core: unknown,
  version: string,
): MuirSirynPlaywrightInstrumentation {
  const instrumentation = muirSirynPlaywrightFieldOf(core, '_instrumentation');
  const addListener = muirSirynPlaywrightFieldOf(
    instrumentation,
    'addListener',
  );

  if (typeof addListener !== 'function') {
    throw muirSirynPlaywrightInternalsChanged(
      version,
      'playwright-core _instrumentation.addListener',
    );
  }

  return {
    addListener(listener) {
      Reflect.apply(addListener, instrumentation, [listener]);
    },
  };
}

/** What the timeout manager of Playwright 1.63 and 1.64 runs: the test body, hooks, worker teardown, modifiers. */
const slotTypes = [
  'test',
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
  'teardown',
  'skip',
  'slow',
  'fail',
  'fixme',
] as const;

export type MuirSirynPlaywrightSlotType = (typeof slotTypes)[number];

export interface MuirSirynPlaywrightRunningSlot {
  readonly type: MuirSirynPlaywrightSlotType;
  /** Whether a fixture of that slot is being set up or torn down. */
  readonly inFixture: boolean;
}

/**
 * What the timeout manager of a TestInfo runs now (TestInfo._timeoutManager._running.runnable).
 * Undefined when there is no TestInfo or its timeout manager runs nothing; throws when a TestInfo has
 * no timeout manager or it runs a type this runner does not know.
 */
export function muirSirynPlaywrightRunningSlotOf(
  testInfo: unknown,
  version: string,
): MuirSirynPlaywrightRunningSlot | undefined {
  if (!muirSirynPlaywrightIsRecord(testInfo)) {
    return undefined;
  }

  const manager = testInfo['_timeoutManager'];

  if (!muirSirynPlaywrightIsRecord(manager)) {
    throw timeoutManagerChanged(version);
  }

  const runnable = muirSirynPlaywrightFieldOf(manager['_running'], 'runnable');

  if (!muirSirynPlaywrightIsRecord(runnable)) {
    return undefined;
  }

  if (!isSlotType(runnable['type'])) {
    throw timeoutManagerChanged(version);
  }

  return {
    type: runnable['type'],
    inFixture: runnable['fixture'] !== undefined,
  };
}

function misconfigured(field: string, expected: string, value: unknown): Error {
  return new Error(
    `The Playwright config's ${field} must be ${expected}, got ${inspect(value)}.`,
  );
}

function timeoutManagerChanged(version: string): Error {
  return muirSirynPlaywrightInternalsChanged(
    version,
    'TestInfo._timeoutManager, which tells a test from the hooks and fixtures that serve a group',
  );
}

export function muirSirynPlaywrightInternalsChanged(
  version: string | undefined,
  what: string,
): Error {
  const playwright =
    version === undefined ? 'Playwright' : `Playwright ${version}`;

  return new Error(
    `${playwright} changed the internals this runner calls (${what}).`,
  );
}

function isSlotType(value: unknown): value is MuirSirynPlaywrightSlotType {
  return slotTypes.some((type) => type === value);
}

export function muirSirynPlaywrightIsSerialSuite(
  suite: unknown,
  version: string,
): boolean {
  const mode = muirSirynPlaywrightFieldOf(suite, '_parallelMode');

  if (typeof mode !== 'string') {
    throw muirSirynPlaywrightInternalsChanged(
      version,
      'Suite._parallelMode, which keeps describe.serial groups together',
    );
  }

  return mode === 'serial';
}
