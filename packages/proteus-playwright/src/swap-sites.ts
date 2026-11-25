import {
  argumentOf,
  fieldOf,
  firstArgumentSite,
  literalText,
  type Site,
} from '@muirjs/moira-mutators';

import { isNamedReceiver } from './ast.ts';

/** `Button/Primary` and `components/Button/Primary` name the same story. */
export function isSameStory(one: string, other: string): boolean {
  return (
    one === other || one.endsWith(`/${other}`) || other.endsWith(`/${one}`)
  );
}

export function mountStorySite(call: unknown): Site | undefined {
  const receiver = 'mount';
  const argument = argumentOf(call, 0);
  const value = literalText(argument);

  return isNamedReceiver(fieldOf(call, 'callee'), receiver) &&
    value !== undefined
    ? { key: receiver, value, node: argument }
    : undefined;
}

export const testIdSite = firstArgumentSite(['getByTestId']);

export const textSite = firstArgumentSite([
  'getByText',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
]);
