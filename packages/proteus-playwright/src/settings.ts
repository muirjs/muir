import { inspect } from 'node:util';

import {
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsIsRecord,
} from '@muirjs/moira-mutators';

import { muirProteusPlaywrightPackageName } from './package-name.ts';

export interface MuirProteusPlaywrightMutatorSettings {
  readonly navigationFixtures?: readonly string[];
}

export interface MuirProteusPlaywrightResolvedSettings {
  readonly navigationFixtures: readonly string[];
}

const fixturesKey = 'navigationFixtures';
const identifier = /^[\p{ID_Start}$_][\p{ID_Continue}$\u{200C}\u{200D}]*$/u;

function isIdentifierList(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string' && identifier.test(entry))
  );
}

let current = muirProteusPlaywrightParseSettings(undefined);

/** The settings of the latest install call; every call replaces them. */
export function muirProteusPlaywrightUseSettings(
  settings: MuirProteusPlaywrightResolvedSettings,
): void {
  current = settings;
}

export function muirProteusPlaywrightNavigationFixtures(): readonly string[] {
  return current.navigationFixtures;
}

export function muirProteusPlaywrightParseSettings(
  settings: unknown,
): MuirProteusPlaywrightResolvedSettings {
  if (
    settings !== undefined &&
    (!muirMoiraMutatorsIsRecord(settings) || Array.isArray(settings))
  ) {
    throw new Error(
      `${muirProteusPlaywrightPackageName}: the settings must be an object, not ${inspect(settings)}.`,
    );
  }

  const extraKey = Object.keys(settings ?? {}).find(
    (key) => key !== fixturesKey,
  );

  if (extraKey !== undefined) {
    throw new Error(
      `${muirProteusPlaywrightPackageName}: the settings have no key ${extraKey}; the keys are ${fixturesKey}.`,
    );
  }

  const given = muirMoiraMutatorsFieldOf(settings, fixturesKey);
  const list = given === undefined ? ['navigate'] : given;

  if (!isIdentifierList(list)) {
    throw new Error(
      `${muirProteusPlaywrightPackageName}: ${fixturesKey} takes an array of identifier names, not ${inspect(list)}.`,
    );
  }

  return { navigationFixtures: list };
}
