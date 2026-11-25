import {
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsMemberNameOf,
} from '@muirjs/moira-mutators';

import {
  muirProteusPlaywrightAncestors,
  muirProteusPlaywrightIsCall,
  muirProteusPlaywrightIsFunctionNode,
  muirProteusPlaywrightIsNamedReceiver,
  muirProteusPlaywrightIsRequestContext,
  muirProteusPlaywrightIsTestCallee,
  muirProteusPlaywrightRowOf,
} from './ast.ts';
import type { MuirProteusPlaywrightMutator } from './mutators.ts';
import { muirProteusPlaywrightNavigationFixtures } from './settings.ts';

export interface MuirProteusPlaywrightRemovalRow {
  readonly mutator: string;
  /**
   * Whether the method's receiver counts, or absent when any receiver does. No row takes a call on an input device or
   * a test runner global.
   */
  readonly receiver?: (path: unknown, object: unknown) => boolean;
  /** The positions that make no mutant: teardown, or setup hooks and `finally` blocks as well. */
  readonly skip: 'teardown' | 'setupAndTeardown';
}

export const muirProteusPlaywrightClickAction =
  'MuirProteusPlaywrightClickAction';
export const muirProteusPlaywrightInputAction =
  'MuirProteusPlaywrightInputAction';
export const muirProteusPlaywrightFocusAction =
  'MuirProteusPlaywrightFocusAction';
export const muirProteusPlaywrightNavigationAction =
  'MuirProteusPlaywrightNavigationAction';
export const muirProteusPlaywrightSleepWait = 'MuirProteusPlaywrightSleepWait';
export const muirProteusPlaywrightStateWait = 'MuirProteusPlaywrightStateWait';
export const muirProteusPlaywrightNetworkWait =
  'MuirProteusPlaywrightNetworkWait';
export const muirProteusPlaywrightClock = 'MuirProteusPlaywrightClock';

function row(mutator: string): MuirProteusPlaywrightRemovalRow {
  return { mutator, skip: 'teardown' };
}

const navigationRow = row(muirProteusPlaywrightNavigationAction);
const requestRow: MuirProteusPlaywrightRemovalRow = {
  mutator: muirProteusPlaywrightInputAction,
  receiver: muirProteusPlaywrightIsRequestContext,
  skip: 'setupAndTeardown',
};
const clockRow: MuirProteusPlaywrightRemovalRow = {
  mutator: muirProteusPlaywrightClock,
  receiver: (_path, object) =>
    muirProteusPlaywrightIsNamedReceiver(object, 'clock'),
  skip: 'teardown',
};

/** The method an awaited call statement ends in, mapped to the one mutator that removes the statement. */
export const muirProteusPlaywrightStatementRemovals: Readonly<
  Record<string, MuirProteusPlaywrightRemovalRow>
> = {
  click: row(muirProteusPlaywrightClickAction),
  dblclick: row(muirProteusPlaywrightClickAction),
  tap: row(muirProteusPlaywrightClickAction),
  dragTo: row(muirProteusPlaywrightClickAction),
  dispatchEvent: row(muirProteusPlaywrightClickAction),
  dragAndDrop: row(muirProteusPlaywrightClickAction),
  fill: row(muirProteusPlaywrightInputAction),
  clear: row(muirProteusPlaywrightInputAction),
  press: row(muirProteusPlaywrightInputAction),
  pressSequentially: row(muirProteusPlaywrightInputAction),
  type: row(muirProteusPlaywrightInputAction),
  selectOption: row(muirProteusPlaywrightInputAction),
  selectText: row(muirProteusPlaywrightInputAction),
  setInputFiles: row(muirProteusPlaywrightInputAction),
  drop: row(muirProteusPlaywrightInputAction),
  check: row(muirProteusPlaywrightInputAction),
  uncheck: row(muirProteusPlaywrightInputAction),
  setChecked: row(muirProteusPlaywrightInputAction),
  focus: row(muirProteusPlaywrightFocusAction),
  blur: row(muirProteusPlaywrightFocusAction),
  hover: row(muirProteusPlaywrightFocusAction),
  goto: navigationRow,
  reload: navigationRow,
  goBack: navigationRow,
  goForward: navigationRow,
  delete: requestRow,
  fetch: requestRow,
  get: requestRow,
  head: requestRow,
  patch: requestRow,
  post: requestRow,
  put: requestRow,
  waitForTimeout: row(muirProteusPlaywrightSleepWait),
  waitForLoadState: row(muirProteusPlaywrightStateWait),
  waitForURL: row(muirProteusPlaywrightStateWait),
  waitFor: row(muirProteusPlaywrightStateWait),
  waitForSelector: row(muirProteusPlaywrightStateWait),
  waitForFunction: row(muirProteusPlaywrightStateWait),
  waitForResponse: row(muirProteusPlaywrightNetworkWait),
  waitForRequest: row(muirProteusPlaywrightNetworkWait),
  runFor: clockRow,
  fastForward: clockRow,
};

const teardownHooks: readonly unknown[] = ['afterEach', 'afterAll'];
const setupHooks: readonly unknown[] = ['beforeEach', 'beforeAll'];

interface SkipPolicy {
  readonly hooks: readonly unknown[];
  readonly finallyBlocks: boolean;
}

const skipPolicies: Readonly<
  Record<MuirProteusPlaywrightRemovalRow['skip'], SkipPolicy>
> = {
  teardown: { hooks: teardownHooks, finallyBlocks: false },
  setupAndTeardown: {
    hooks: [...teardownHooks, ...setupHooks],
    finallyBlocks: true,
  },
};

const inputDevices: readonly unknown[] = ['keyboard', 'mouse', 'touchscreen'];
// The globals of Vitest and Jest, whose waitFor and friends share Playwright's method names.
const testRunners: readonly unknown[] = ['vi', 'jest'];

export function muirProteusPlaywrightRemovalMutator<const TName extends string>(
  name: TName,
  sample: string,
): MuirProteusPlaywrightMutator & { readonly name: TName } {
  return {
    name,
    sample,
    *mutate(path, t) {
      const removal = removalOf(path);

      if (removal?.mutator === name && !isSkipped(path, removal.skip)) {
        yield t.emptyStatement();
      }
    },
  };
}

function removalOf(path: unknown): MuirProteusPlaywrightRemovalRow | undefined {
  const callee = muirMoiraMutatorsFieldOf(
    awaitedCall(muirMoiraMutatorsFieldOf(path, 'node')),
    'callee',
  );

  if (muirMoiraMutatorsFieldOf(callee, 'type') === 'Identifier') {
    return isNavigationFixture(path, muirMoiraMutatorsFieldOf(callee, 'name'))
      ? navigationRow
      : undefined;
  }

  const found = muirProteusPlaywrightRowOf(
    muirProteusPlaywrightStatementRemovals,
    awaitedMethod(callee),
  );

  return found?.receiver === undefined ||
    found.receiver(path, muirMoiraMutatorsFieldOf(callee, 'object'))
    ? found
    : undefined;
}

/** The call of an `await <call>;` statement. */
function awaitedCall(node: unknown): unknown {
  if (muirMoiraMutatorsFieldOf(node, 'type') !== 'ExpressionStatement') {
    return undefined;
  }

  const awaited = muirMoiraMutatorsFieldOf(node, 'expression');
  const call = muirMoiraMutatorsFieldOf(awaited, 'argument');

  return muirMoiraMutatorsFieldOf(awaited, 'type') === 'AwaitExpression' &&
    muirProteusPlaywrightIsCall(call)
    ? call
    : undefined;
}

/** The last member of the callee, when it is a member of something that is neither an input device nor a test runner. */
function awaitedMethod(callee: unknown): unknown {
  const object = muirMoiraMutatorsFieldOf(callee, 'object');

  return !inputDevices.includes(muirMoiraMutatorsMemberNameOf(object)) &&
    !testRunners.includes(muirMoiraMutatorsFieldOf(object, 'name'))
    ? muirMoiraMutatorsMemberNameOf(callee)
    : undefined;
}

/** `name` is in the navigation fixture list and a test, hook or fixture function around `path` destructures it. */
function isNavigationFixture(path: unknown, name: unknown): boolean {
  if (
    typeof name !== 'string' ||
    !muirProteusPlaywrightNavigationFixtures().includes(name)
  ) {
    return false;
  }

  return [...muirProteusPlaywrightAncestors(path)].some(
    (ancestor) =>
      isFixtureFunction(ancestor) &&
      destructures(
        muirMoiraMutatorsFieldOf(
          muirMoiraMutatorsFieldOf(ancestor, 'node'),
          'params',
        ),
        name,
      ),
  );
}

/** The first of a function's `params` is an object pattern that binds `name`. */
function destructures(params: unknown, name: string): boolean {
  const pattern: unknown = Array.isArray(params) ? params[0] : undefined;
  const properties = muirMoiraMutatorsFieldOf(pattern, 'properties');

  return (
    Array.isArray(properties) &&
    properties.some(
      (property) =>
        muirMoiraMutatorsFieldOf(
          muirMoiraMutatorsFieldOf(property, 'value'),
          'name',
        ) === name,
    )
  );
}

/** A function that Playwright calls with fixtures: an argument of `test(...)` or `test.<x>(...)`, or a `test.extend` fixture. */
function isFixtureFunction(path: unknown): boolean {
  const owner = muirMoiraMutatorsFieldOf(path, 'parent');
  const ownerPath = muirMoiraMutatorsFieldOf(path, 'parentPath');

  if (muirProteusPlaywrightIsCall(owner)) {
    return muirProteusPlaywrightIsTestCallee(
      muirMoiraMutatorsFieldOf(owner, 'callee'),
    );
  }

  const objectPath =
    muirMoiraMutatorsFieldOf(owner, 'type') === 'ObjectProperty'
      ? muirMoiraMutatorsFieldOf(ownerPath, 'parentPath')
      : ownerPath;

  return (
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(objectPath, 'node'),
      'type',
    ) === 'ObjectExpression' &&
    isExtendCall(muirMoiraMutatorsFieldOf(objectPath, 'parent'))
  );
}

function isExtendCall(node: unknown): boolean {
  return (
    muirProteusPlaywrightIsCall(node) &&
    muirMoiraMutatorsMemberNameOf(muirMoiraMutatorsFieldOf(node, 'callee')) ===
      'extend'
  );
}

function isSkipped(
  path: unknown,
  skip: MuirProteusPlaywrightRemovalRow['skip'],
): boolean {
  const { hooks, finallyBlocks } = skipPolicies[skip];
  const chain = [path, ...muirProteusPlaywrightAncestors(path)];

  return chain.slice(1).some((current, index) => {
    const child = muirMoiraMutatorsFieldOf(chain[index], 'node');

    return (
      isHookCall(muirMoiraMutatorsFieldOf(current, 'node'), hooks) ||
      followsUse(current, child) ||
      (finallyBlocks && isFinalizer(current, child))
    );
  });
}

function isHookCall(node: unknown, hooks: readonly unknown[]): boolean {
  return (
    muirProteusPlaywrightIsCall(node) &&
    hooks.includes(
      muirMoiraMutatorsMemberNameOf(muirMoiraMutatorsFieldOf(node, 'callee')),
    )
  );
}

/** `child` is the `finally` block of the try statement at `tryPath`. */
function isFinalizer(tryPath: unknown, child: unknown): boolean {
  return (
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(tryPath, 'node'),
      'finalizer',
    ) === child
  );
}

/** `child` sits in a function body, after a statement of that body that is `await use(...)`. */
function followsUse(blockPath: unknown, child: unknown): boolean {
  const block = muirMoiraMutatorsFieldOf(blockPath, 'node');
  const body = muirMoiraMutatorsFieldOf(block, 'body');

  return (
    Array.isArray(body) &&
    muirProteusPlaywrightIsFunctionNode(
      muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(blockPath, 'parentPath'),
        'node',
      ),
    ) &&
    body.slice(0, body.indexOf(child)).some(isAwaitedUse)
  );
}

function isAwaitedUse(statement: unknown): boolean {
  const awaited = muirMoiraMutatorsFieldOf(statement, 'expression');
  const call = muirMoiraMutatorsFieldOf(awaited, 'argument');

  return (
    muirMoiraMutatorsFieldOf(awaited, 'type') === 'AwaitExpression' &&
    muirProteusPlaywrightIsCall(call) &&
    muirMoiraMutatorsFieldOf(
      muirMoiraMutatorsFieldOf(call, 'callee'),
      'name',
    ) === 'use'
  );
}
