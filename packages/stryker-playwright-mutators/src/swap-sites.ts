import {
  fieldOf,
  literalText,
  literalValue,
  type Site,
  type SiteReader,
} from '@layzee/stryker-mutator-install';

import {
  argumentOf,
  findProperty,
  isNamedReceiver,
  memberNameOf,
} from './ast.ts';

export function roleSite(call: unknown): Site | undefined {
  const role = argumentOf(call, 0);
  const name = fieldOf(findProperty(argumentOf(call, 1), 'name'), 'value');
  const value = literalValue(name);

  return memberNameOf(fieldOf(call, 'callee')) === 'getByRole' &&
    fieldOf(role, 'type') === 'StringLiteral' &&
    value !== undefined
    ? { key: `getByRole:${literalValue(role)}`, value, node: name }
    : undefined;
}

/** The first argument of a call to one of the methods; the method is the key. */
function firstArgumentSite(methods: readonly string[]): SiteReader {
  return (call) => {
    const method = memberNameOf(fieldOf(call, 'callee'));
    const argument = argumentOf(call, 0);
    const value = literalValue(argument);

    return typeof method === 'string' &&
      methods.includes(method) &&
      value !== undefined
      ? { key: method, value, node: argument }
      : undefined;
  };
}

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
