import {
  muirMoiraMutatorsArgumentOf,
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsFirstArgumentSite,
  muirMoiraMutatorsLiteralText,
  type MuirMoiraMutatorsSite,
} from '@muirjs/moira-mutators';

import { muirProteusPlaywrightIsNamedReceiver } from './ast.ts';

/** `Button/Primary` and `components/Button/Primary` name the same story. */
export function muirProteusPlaywrightIsSameStory(
  one: string,
  other: string,
): boolean {
  return (
    one === other || one.endsWith(`/${other}`) || other.endsWith(`/${one}`)
  );
}

export function muirProteusPlaywrightMountStorySite(
  call: unknown,
): MuirMoiraMutatorsSite | undefined {
  const receiver = 'mount';
  const argument = muirMoiraMutatorsArgumentOf(call, 0);
  const value = muirMoiraMutatorsLiteralText(argument);

  return muirProteusPlaywrightIsNamedReceiver(
    muirMoiraMutatorsFieldOf(call, 'callee'),
    receiver,
  ) && value !== undefined
    ? { key: receiver, value, node: argument }
    : undefined;
}

export const muirProteusPlaywrightTestIdSite =
  muirMoiraMutatorsFirstArgumentSite(['getByTestId']);

export const muirProteusPlaywrightTextSite = muirMoiraMutatorsFirstArgumentSite(
  ['getByText', 'getByLabel', 'getByPlaceholder', 'getByAltText', 'getByTitle'],
);
