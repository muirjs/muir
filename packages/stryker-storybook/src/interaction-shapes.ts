import {
  field,
  type Interaction,
  list,
  type StoryInteractions,
} from '@layzee/storybook-core';

export const interactionShapes = [
  'negative-only',
  'click-before-type',
  'cleared-later',
] as const;

export type InteractionShape = (typeof interactionShapes)[number];

/** Every shape that holds for `interaction`, one of `interactions`. */
export function shapesOf(
  interaction: Interaction,
  interactions: StoryInteractions,
): readonly InteractionShape[] {
  return interactionShapes.filter((shape) =>
    hasShape[shape](interaction, interactions),
  );
}

const hasShape: Readonly<
  Record<
    InteractionShape,
    (interaction: Interaction, interactions: StoryInteractions) => boolean
  >
> = {
  'negative-only': isNegativeOnly,
  'click-before-type': isClickBeforeType,
  'cleared-later': isClearedLater,
};

/** At least one following check, every one of them negative, and a window that no interaction may or may not end. */
function isNegativeOnly({ following: { checks, end } }: Interaction): boolean {
  return (
    checks.length > 0 &&
    checks.every((check) => check.negative) &&
    end.by !== 'maybe'
  );
}

/** A user-event click or hover directly before a user-event 14 `type` of an equivalent target that keeps the click. */
function isClickBeforeType(
  interaction: Interaction,
  interactions: StoryInteractions,
): boolean {
  const { end } = interaction.following;
  const next =
    end.by === 'interaction' && end.adjacent && end.sameTarget
      ? interactions.at(end.node)
      : undefined;

  return (
    interaction.kind === 'userEvent' &&
    ['click', 'hover'].includes(interaction.method ?? '') &&
    next?.kind === 'userEvent' &&
    next.method === 'type' &&
    next.origin === 'userEvent14' &&
    !maySkipClick(next.args[2])
  );
}

/** A `type` or `clear` with no following check, whose window ends at a `clear` of an equivalent target in its own block. */
function isClearedLater(
  interaction: Interaction,
  interactions: StoryInteractions,
): boolean {
  const { checks, end } = interaction.following;
  const later =
    end.by === 'interaction' && end.sameList && end.sameTarget
      ? interactions.at(end.node)
      : undefined;

  return (
    ['type', 'clear'].includes(methodOf(interaction) ?? '') &&
    methodOf(later) === 'clear' &&
    checks.length === 0
  );
}

function methodOf(interaction: Interaction | undefined): string | undefined {
  return interaction?.kind === 'userEvent' || interaction?.kind === 'fireEvent'
    ? interaction.method
    : undefined;
}

/**
 * Unless the options are absent, or an object literal with no spread, computed key or `__proto__` whose `skipClick` is
 * absent or `false`.
 */
function maySkipClick(options: unknown): boolean {
  if (options !== undefined && field(options, 'type') !== 'ObjectExpression') {
    return true;
  }

  return list(field(options, 'properties')).some(
    (property) =>
      field(property, 'type') === 'SpreadElement' ||
      field(property, 'computed') === true ||
      keyName(property) === '__proto__' ||
      (keyName(property) === 'skipClick' &&
        !(
          field(property, 'value', 'type') === 'BooleanLiteral' &&
          field(property, 'value', 'value') === false
        )),
  );
}

/** The name of a property's identifier or string-literal key, when it is not computed. */
function keyName(property: unknown): string | undefined {
  const key = field(property, 'key');
  const name =
    field(key, 'type') === 'Identifier'
      ? field(key, 'name')
      : field(key, 'value');

  return field(property, 'computed') !== true && typeof name === 'string'
    ? name
    : undefined;
}
