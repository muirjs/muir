import { clearedLaterHintCases } from './cleared-later-hint-cases.ts';
import { clickBeforeTypeHintCases } from './click-before-type-hint-cases.ts';
import { hintLineCases } from './hint-line-cases.ts';
import { negativeOnlyHintCases } from './negative-only-hint-cases.ts';
import type { InteractionHintCase } from './support/interaction-hint-case.ts';
import { userEventOriginHintCases } from './user-event-origin-hint-cases.ts';

export const interactionHintCases: readonly InteractionHintCase[] = [
  ...negativeOnlyHintCases,
  ...clickBeforeTypeHintCases,
  ...userEventOriginHintCases,
  ...clearedLaterHintCases,
  ...hintLineCases,
];
