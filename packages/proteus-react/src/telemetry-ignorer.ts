import {
  muirMoiraMutatorsBindingOf,
  muirMoiraMutatorsFieldOf,
} from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import { muirProteusReactListOption } from './list-option.ts';
import { muirProteusReactHideableCallee } from './statement-call.ts';

export const muirProteusReactTelemetryIgnorerName =
  'muir-proteus-react-telemetry';

const calleePattern = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

export const muirProteusReactTelemetrySchema = {
  type: 'object',
  additionalProperties: false,
  description: `Options of the ${muirProteusReactTelemetryIgnorerName} ignorer.`,
  properties: {
    calls: {
      type: 'array',
      items: { type: 'string', pattern: calleePattern.source },
      description:
        `Callees, such as track or analytics.track, added to the built-in ones. ${muirProteusReactTelemetryIgnorerName} hides the ` +
        'mutants of a statement that is just a call to one of them, unless an argument can act on the page.',
    },
  },
};

const analyticsReason = `${muirProteusReactTelemetryIgnorerName}: analytics call; DOM tests do not observe what it sends`;
const analyticsCalls: readonly unknown[] = [
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
];
const errorReason = `${muirProteusReactTelemetryIgnorerName}: error-monitoring call; DOM tests do not observe what it reports`;
const errorCalls: readonly unknown[] = [
  'Sentry.captureException',
  'Sentry.captureMessage',
  'Sentry.addBreadcrumb',
  'Sentry.setUser',
  'Sentry.setTag',
  'Sentry.setTags',
  'Sentry.setContext',
  'Sentry.setExtra',
  'Sentry.flush',
];
const sentryImportedFunctions: readonly unknown[] = [
  'captureException',
  'captureMessage',
];

const callsReason = `${muirProteusReactTelemetryIgnorerName}: telemetry call from muirProteusReactTelemetry.calls; DOM tests do not observe what it sends`;

export function muirProteusReactTelemetryIgnorer(options: object): Ignorer {
  const calls = muirProteusReactListOption(
    options,
    'muirProteusReactTelemetry',
    'calls',
    [],
    isCallee,
    'an array of callee names such as track or analytics.track',
  );
  const reasons = new Map<unknown, string>([
    ...calls.map((callee) => [callee, callsReason] as const),
    ...analyticsCalls.map((callee) => [callee, analyticsReason] as const),
    ...errorCalls.map((callee) => [callee, errorReason] as const),
  ]);

  return {
    shouldIgnore(path) {
      const callee = muirProteusReactHideableCallee(
        muirMoiraMutatorsFieldOf(path, 'node'),
      );

      return sentryImportedFunctions.includes(callee) &&
        importsFromSentry(path, callee)
        ? errorReason
        : reasons.get(callee);
    },
  };
}
muirProteusReactTelemetryIgnorer.inject = tokens(commonTokens.options);

function isCallee(name: unknown): name is string {
  return typeof name === 'string' && calleePattern.test(name);
}

function importsFromSentry(path: unknown, name: unknown): boolean {
  const declaration = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(muirMoiraMutatorsBindingOf(path, name), 'path'),
    'parent',
  );
  const source = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(declaration, 'source'),
    'value',
  );

  return typeof source === 'string' && source.startsWith('@sentry/');
}
