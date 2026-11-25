import {
  muirMoiraMutatorsFieldOf,
  muirMoiraMutatorsIsRecord,
} from '@muirjs/moira-mutators';
import type { Ignorer } from '@stryker-mutator/api/ignore';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';

import { muirProteusJsxListOption } from './list-option.ts';
import { muirProteusJsxTypeOf } from './type-of.ts';

export const muirProteusJsxStylingIgnorerName = 'muir-proteus-jsx-styling';

const classNamePattern = /^\S+$/;

export const muirProteusJsxStylingSchema = {
  type: 'object',
  additionalProperties: false,
  description: `Options of the ${muirProteusJsxStylingIgnorerName} ignorer.`,
  properties: {
    visibilityClasses: {
      type: 'array',
      items: { type: 'string', pattern: classNamePattern.source },
      description:
        `Class names that hide an element, added to the built-in ones. ${muirProteusJsxStylingIgnorerName} keeps the mutants of ` +
        'a class expression that holds one of them.',
    },
  },
};

const classReason = `${muirProteusJsxStylingIgnorerName}: class names only style the element; DOM tests do not observe them`;
const builderReason = `${muirProteusJsxStylingIgnorerName}: class-name builder call; DOM tests do not observe class names`;
const styleReason = `${muirProteusJsxStylingIgnorerName}: inline styles only style the element; DOM tests do not observe them`;
const visibilityClasses = [
  'hidden',
  'invisible',
  'collapse',
  'sr-only',
  'not-sr-only',
  'd-none',
  'visually-hidden',
  'is-hidden',
];
const classBuilders: readonly unknown[] = [
  'cn',
  'clsx',
  'classnames',
  'classNames',
  'cx',
  'twMerge',
  'cva',
  'tv',
];
const classValueTypes: readonly unknown[] = [
  'StringLiteral',
  'TemplateLiteral',
  'ObjectExpression',
];
// Keys that change only how an element is painted. Any other key can change its box, position or visibility, which
// Playwright's visibility, viewport and click checks and the app's own layout measurements read.
const paintKeys: readonly string[] = [
  'color',
  'background',
  'backgroundColor',
  'backgroundImage',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRadius',
  'outlineColor',
  'boxShadow',
  'textShadow',
  'textDecorationColor',
  'accentColor',
  'caretColor',
  'cursor',
  'fill',
  'stroke',
];

export function muirProteusJsxStylingIgnorer(options: object): Ignorer {
  const hiding = new Set([
    ...visibilityClasses,
    ...muirProteusJsxListOption(
      options,
      'muirProteusJsxStyling',
      'visibilityClasses',
      [],
      isClassName,
      'an array of class names, each without whitespace',
    ),
  ]);
  const hides = (node: unknown): boolean =>
    classTexts(node)
      .flatMap((text) => text.split(/\s/))
      .some((token) => hiding.has(token.slice(token.lastIndexOf(':') + 1)));

  return {
    shouldIgnore(path) {
      const node = muirMoiraMutatorsFieldOf(path, 'node');

      if (isPlainStyleAttribute(node)) {
        return styleReason;
      }

      if (isClassAttribute(node) || isClassVariable(node)) {
        return hides(node) ? undefined : classReason;
      }

      if (isClassBuilderCall(node) && !insideClassAttribute(path)) {
        return hides(node) ? undefined : builderReason;
      }

      return undefined;
    },
  };
}
muirProteusJsxStylingIgnorer.inject = tokens(commonTokens.options);

function isClassName(name: unknown): name is string {
  return typeof name === 'string' && classNamePattern.test(name);
}

function isClassAttribute(node: unknown): boolean {
  const name = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(node, 'name'),
    'name',
  );

  return (
    (name === 'className' ||
      name === 'class' ||
      (typeof name === 'string' && name.endsWith('ClassName'))) &&
    muirProteusJsxTypeOf(muirMoiraMutatorsFieldOf(node, 'value')) ===
      'JSXExpressionContainer'
  );
}

function isPlainStyleAttribute(node: unknown): boolean {
  const value = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(node, 'value'),
    'expression',
  );
  const properties = muirMoiraMutatorsFieldOf(value, 'properties');

  return (
    muirMoiraMutatorsFieldOf(muirMoiraMutatorsFieldOf(node, 'name'), 'name') ===
      'style' &&
    Array.isArray(properties) &&
    properties.every(isPlainStyleProperty)
  );
}

function isPlainStyleProperty(property: unknown): boolean {
  const key = muirMoiraMutatorsFieldOf(property, 'key');
  const name =
    muirMoiraMutatorsFieldOf(key, 'name') ??
    muirMoiraMutatorsFieldOf(key, 'value');

  return (
    muirMoiraMutatorsFieldOf(property, 'computed') === false &&
    typeof name === 'string' &&
    paintKeys.includes(
      name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    )
  );
}

function isClassVariable(node: unknown): boolean {
  const name = muirMoiraMutatorsFieldOf(
    muirMoiraMutatorsFieldOf(node, 'id'),
    'name',
  );

  return (
    typeof name === 'string' &&
    (name.endsWith('ClassName') || name.endsWith('Classes')) &&
    classValueTypes.includes(
      muirProteusJsxTypeOf(muirMoiraMutatorsFieldOf(node, 'init')),
    )
  );
}

function isClassBuilderCall(node: unknown): boolean {
  return (
    muirProteusJsxTypeOf(node) === 'CallExpression' &&
    classBuilders.includes(
      muirMoiraMutatorsFieldOf(
        muirMoiraMutatorsFieldOf(node, 'callee'),
        'name',
      ),
    )
  );
}

function insideClassAttribute(path: unknown): boolean {
  const parent = muirMoiraMutatorsFieldOf(path, 'parentPath');

  return (
    muirMoiraMutatorsIsRecord(parent) &&
    (isClassAttribute(parent['node']) || insideClassAttribute(parent))
  );
}

/** The strings in a subtree that can hold class names: string literals, template parts, and object keys. */
function classTexts(node: unknown): string[] {
  if (!muirMoiraMutatorsIsRecord(node)) {
    return [];
  }

  const own = [
    muirProteusJsxTypeOf(node) === 'StringLiteral' ? node['value'] : undefined,
    muirMoiraMutatorsFieldOf(node['value'], 'cooked'),
    node['computed'] === false
      ? muirMoiraMutatorsFieldOf(node['key'], 'name')
      : undefined,
  ].filter((text) => typeof text === 'string');

  return [...own, ...Object.values(node).flatMap(classTexts)];
}
