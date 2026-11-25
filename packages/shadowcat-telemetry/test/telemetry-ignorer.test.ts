import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirAssertEveryOutcome,
  muirIgnorerOutcomes,
  muirValidateOptions,
} from '@muirjs/test-util-ignorer-packages';

import { strykerValidationSchema } from '../src/index.ts';
import {
  muirShadowcatTelemetrySchema,
  muirShadowcatTelemetryIgnorer,
} from '../src/telemetry-ignorer.ts';

const analyticsReason =
  'muir-shadowcat-telemetry: analytics call; DOM tests do not observe what it sends';
const callsReason =
  'muir-shadowcat-telemetry: telemetry call from muirShadowcatTelemetry.calls; DOM tests do not observe what it sends';
const errorReason =
  'muir-shadowcat-telemetry: error-monitoring call; DOM tests do not observe what it reports';

const assertEvery = (code: string, outcome: string, options: object = {}) =>
  muirAssertEveryOutcome(muirShadowcatTelemetryIgnorer(options), code, outcome);

describe('muir-shadowcat-telemetry', () => {
  [
    'gtag',
    'window.gtag',
    'fbq',
    'ttq.track',
    'dataLayer.push',
    'window.dataLayer.push',
    'analytics.track',
    'analytics.page',
    'analytics.identify',
    'analytics.group',
    'analytics.alias',
    'analytics.screen',
    'posthog.capture',
    'posthog.identify',
    'posthog.group',
    'posthog.alias',
    'posthog.register',
    'posthog.reset',
    'mixpanel.track',
    'mixpanel.identify',
    'mixpanel.register',
    'mixpanel.people.set',
    'plausible',
    'window.plausible',
    'umami.track',
    'amplitude.track',
    'amplitude.logEvent',
    'amplitude.identify',
  ].forEach((callee) => {
    it(`ignores every mutant of a ${callee} call statement, with the analytics reason`, async () => {
      await assertEvery(
        `${callee}('event', { plan: on ? 'a' : 'b' });`,
        analyticsReason,
      );
    });
  });

  [
    'Sentry.captureException',
    'Sentry.captureMessage',
    'Sentry.addBreadcrumb',
    'Sentry.setUser',
    'Sentry.setTag',
    'Sentry.setTags',
    'Sentry.setContext',
    'Sentry.setExtra',
    'Sentry.flush',
  ].forEach((callee) => {
    it(`ignores every mutant of a ${callee} call statement, with the error-monitoring reason`, async () => {
      await assertEvery(
        `${callee}(on ? 'a' : 'b', { level: 'warning' });`,
        errorReason,
      );
    });
  });

  ['captureException', 'captureMessage'].forEach((name) => {
    it(`ignores every mutant of a ${name} call statement when ${name} comes from a @sentry package`, async () => {
      await assertEvery(
        `import { ${name} } from '@sentry/react-router';\n${name}(on ? 'a' : 'b');`,
        errorReason,
      );
    });
  });

  it('ignores every mutant of a captureException call statement when its @sentry import also names other functions', async () => {
    await assertEvery(
      "import { captureException, captureMessage } from '@sentry/node';\ncaptureException(on ? 'a' : 'b');",
      errorReason,
    );
  });

  [
    '',
    "import { captureException } from './errors';\n",
    "import { captureException } from 'sentry';\n",
    "import { captureMessage } from '@sentry/node';\n",
    "import { captureException as report } from '@sentry/node';\n",
    "export { captureException } from '@sentry/node';\n",
  ].forEach((imports) => {
    it(`keeps the mutants of a bare captureException call statement after ${JSON.stringify(imports)}`, async () => {
      await assertEvery(
        `${imports}captureException(on ? 'a' : 'b');`,
        'placed',
      );
    });
  });

  it('keeps the mutants of a call to a parameter that shadows a captureException imported from @sentry', async () => {
    await assertEvery(
      "import { captureException } from '@sentry/node';\nexport function f(captureException) { captureException(on ? 'a' : 'b'); }",
      'placed',
    );
  });

  [
    'window.gtag?.',
    'window.dataLayer?.push',
    'window?.dataLayer?.push',
  ].forEach((callee) => {
    it(`ignores every mutant of an optional call statement ${callee}()`, async () => {
      await assertEvery(
        `${callee}('event', { plan: on ? 'a' : 'b' });`,
        analyticsReason,
      );
    });
  });

  ['await', 'void'].forEach((operator) => {
    it(`ignores every mutant of a telemetry call statement under ${operator}`, async () => {
      await assertEvery(
        `${operator} Sentry.flush(on ? 2000 : 0, 'a');`,
        errorReason,
      );
    });
  });

  it('keeps the mutants of Sentry.init, whose options unit tests can check', async () => {
    await assertEvery(
      "Sentry.init({ dsn: on ? 'a' : 'b', beforeSend: (event) => (on ? null : event) });",
      'placed',
    );
  });

  [
    "export const id = analytics.track('event', on ? 'a' : 'b');",
    "export function f() { return gtag('event', on ? 'a' : 'b'); }",
    "sent = posthog.capture('event', on ? 'a' : 'b');",
    "track(analytics.track('event', on ? 'a' : 'b'));",
  ].forEach((code) => {
    it(`keeps the mutants of a telemetry call whose result is used: ${code}`, async () => {
      await assertEvery(code, 'placed');
    });
  });

  [
    'new gtag',
    'new analytics.track',
    "analytics['track']",
    'lib.analytics.track',
    'analytics.track.call',
  ].forEach((callee) => {
    it(`keeps the mutants of a ${callee} statement, whose callee is constructed, computed or not a listed name`, async () => {
      await assertEvery(`${callee}('event', on ? 'a' : 'b');`, 'placed');
    });
  });

  ['track', 'telemetry.send'].forEach((callee) => {
    it(`ignores every mutant of a ${callee} call statement listed in muirShadowcatTelemetry.calls, with the calls reason`, async () => {
      await assertEvery(`${callee}('event', on ? 'a' : 'b');`, callsReason, {
        muirShadowcatTelemetry: { calls: ['track', 'telemetry.send'] },
      });
    });
  });

  (
    [
      ['gtag', analyticsReason],
      ['Sentry.flush', errorReason],
    ] as const
  ).forEach(([callee, reason]) => {
    it(`gives a ${callee} call statement its built-in reason when muirShadowcatTelemetry.calls lists it too`, async () => {
      await assertEvery(`${callee}('event', on ? 'a' : 'b');`, reason, {
        muirShadowcatTelemetry: { calls: [callee] },
      });
    });
  });

  [
    'track',
    null,
    {},
    [1],
    [''],
    ['a b'],
    ['a.'],
    ['.a'],
    ['a..b'],
    ['a-b'],
    ['a[0]'],
    ['a()'],
    ['track', null],
  ].forEach((calls) => {
    it(`refuses calls ${JSON.stringify(calls)} when it is created`, () => {
      assert.throws(
        () =>
          muirShadowcatTelemetryIgnorer({
            muirShadowcatTelemetry: { calls },
          }),
        {
          message: `@muirjs/shadowcat-telemetry: muirShadowcatTelemetry.calls must be an array of callee names such as track or analytics.track, not ${JSON.stringify(calls)}.`,
        },
      );
    });
  });

  [
    {},
    { muirShadowcatTelemetry: {} },
    { muirShadowcatTelemetry: { calls: [] } },
    { muirShadowcatTelemetry: { calls: ['$track', '_t.send', 'a1.b2.c3'] } },
  ].forEach((options) => {
    it(`accepts the options ${JSON.stringify(options)}`, () => {
      assert.doesNotThrow(() => muirShadowcatTelemetryIgnorer(options));
    });
  });

  it('keeps the mutants of a telemetry call statement whose arguments hold an arrow function, as the function can act on the page', async () => {
    await assertEvery(
      "analytics.track('Clicked', {}, {}, () => { navigate(on ? '/a' : '/b'); });",
      'placed',
    );
  });

  it('keeps the mutants of a telemetry call statement whose object argument holds a callback property', async () => {
    await assertEvery(
      "window.dataLayer.push({ event: 'x', eventCallback: () => { setDone(on && ok); } });",
      'placed',
    );
  });

  it('keeps the mutants of the statement beside an ignored telemetry call statement', async () => {
    assert.deepEqual(
      new Set(
        await muirIgnorerOutcomes(
          muirShadowcatTelemetryIgnorer({}),
          "gtag('event', on ? 'a' : 'b');\nsetOpen(on ? 1 : 2);",
        ),
      ),
      new Set([analyticsReason, 'placed']),
    );
  });

  it('keeps the mutants of a telemetry call that is the body of an arrow function, as it is no statement', async () => {
    await assertEvery(
      "export const view = <button onClick={() => gtag('event', on ? 'a' : 'b')}>Buy</button>;",
      'placed',
    );
  });

  it('keeps the mutants of a call statement to an unknown callee', async () => {
    await assertEvery("format('a', on ? 'b' : 'c');", 'placed');
  });
});

describe('the muir-shadowcat-telemetry options schema', () => {
  it('describes muirShadowcatTelemetry.calls as a list of callee names', () => {
    assert.deepEqual(muirShadowcatTelemetrySchema, {
      type: 'object',
      additionalProperties: false,
      description: 'Options of the muir-shadowcat-telemetry ignorer.',
      properties: {
        calls: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^[A-Za-z_$][\\w$]*(\\.[A-Za-z_$][\\w$]*)*$',
          },
          description:
            'Callees, such as track or analytics.track, added to the built-in ones. muir-shadowcat-telemetry hides the ' +
            'mutants of a statement that is just a call to one of them, unless an argument can act on the page.',
        },
      },
    });
  });

  it('lets core accept muirShadowcatTelemetry without an unknown-option warning', async () => {
    assert.deepEqual(
      await muirValidateOptions(
        { muirShadowcatTelemetry: { calls: ['track'] } },
        [strykerValidationSchema],
      ),
      { valid: true, log: [] },
    );
  });

  [
    { calls: 'track' },
    { calls: [1] },
    { calls: ['a b'] },
    { callees: ['track'] },
    [],
  ].forEach((muirShadowcatTelemetry) => {
    it(`lets core refuse muirShadowcatTelemetry ${JSON.stringify(muirShadowcatTelemetry)}`, async () => {
      const { valid, log } = await muirValidateOptions(
        { muirShadowcatTelemetry },
        [strykerValidationSchema],
      );

      assert.equal(valid, false);
      assert.ok(
        log.some(
          (line) =>
            line.startsWith('error') && line.includes('muirShadowcatTelemetry'),
        ),
        log.join('\n'),
      );
    });
  });
});
