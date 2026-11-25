import {
  muirMoiraStorybookField,
  type MuirMoiraStorybookInteraction,
  muirMoiraStorybookList,
  muirMoiraStorybookPropertyKey,
  type MuirMoiraStorybookStoryInteractions,
} from '@muirjs/moira-storybook';

export const muirShadowcatStorybookInteractionShapes = [
  'negative-only',
  'click-before-type',
  'cleared-later',
] as const;

export type MuirShadowcatStorybookInteractionShape =
  (typeof muirShadowcatStorybookInteractionShapes)[number];

/** Every shape that holds for `interaction`, one of `interactions`. */
export function muirShadowcatStorybookShapesOf(
  interaction: MuirMoiraStorybookInteraction,
  interactions: MuirMoiraStorybookStoryInteractions,
): readonly MuirShadowcatStorybookInteractionShape[] {
  return muirShadowcatStorybookInteractionShapes.filter((shape) =>
    hasShape[shape](interaction, interactions),
  );
}

const hasShape: Readonly<
  Record<
    MuirShadowcatStorybookInteractionShape,
    (
      interaction: MuirMoiraStorybookInteraction,
      interactions: MuirMoiraStorybookStoryInteractions,
    ) => boolean
  >
> = {
  'negative-only': isNegativeOnly,
  'click-before-type': isClickBeforeType,
  'cleared-later': isClearedLater,
};

/** At least one following check, every one of them negative, and a window that no interaction may or may not end. */
function isNegativeOnly({
  following: { checks, end },
}: MuirMoiraStorybookInteraction): boolean {
  return (
    checks.length > 0 &&
    checks.every((check) => check.negative) &&
    end.by !== 'maybe'
  );
}

const clickOrHover: ReadonlySet<string | undefined> = new Set([
  'click',
  'hover',
]);

const typeOrClear: ReadonlySet<string | undefined> = new Set(['type', 'clear']);

/** A user-event click or hover directly before a user-event 14 `type` of an equivalent target that keeps the click. */
function isClickBeforeType(
  interaction: MuirMoiraStorybookInteraction,
  interactions: MuirMoiraStorybookStoryInteractions,
): boolean {
  const { end } = interaction.following;
  const next =
    end.by === 'interaction' && end.adjacent && end.sameTarget
      ? interactions.at(end.node)
      : undefined;

  return (
    interaction.kind === 'userEvent' &&
    clickOrHover.has(interaction.method) &&
    next?.kind === 'userEvent' &&
    next.method === 'type' &&
    next.origin === 'userEvent14' &&
    !maySkipClick(next.args[2])
  );
}

/** A `type` or `clear` with no following check, whose window ends at a `clear` of an equivalent target in its own block. */
function isClearedLater(
  interaction: MuirMoiraStorybookInteraction,
  interactions: MuirMoiraStorybookStoryInteractions,
): boolean {
  const { checks, end } = interaction.following;
  const later =
    end.by === 'interaction' && end.sameList && end.sameTarget
      ? interactions.at(end.node)
      : undefined;

  return (
    typeOrClear.has(interaction.method) &&
    later?.method === 'clear' &&
    checks.length === 0
  );
}

/**
 * Unless the options are absent, or an object literal with no spread, computed key or `__proto__` whose `skipClick` is
 * absent or `false`.
 */
function maySkipClick(options: unknown): boolean {
  if (
    options !== undefined &&
    muirMoiraStorybookField(options, 'type') !== 'ObjectExpression'
  ) {
    return true;
  }

  return muirMoiraStorybookList(
    muirMoiraStorybookField(options, 'properties'),
  ).some(
    (property) =>
      muirMoiraStorybookField(property, 'type') === 'SpreadElement' ||
      muirMoiraStorybookField(property, 'computed') === true ||
      muirMoiraStorybookPropertyKey(property) === '__proto__' ||
      // Only a boolean literal has a value field that is false.
      (muirMoiraStorybookPropertyKey(property) === 'skipClick' &&
        muirMoiraStorybookField(property, 'value', 'value') !== false),
  );
}
