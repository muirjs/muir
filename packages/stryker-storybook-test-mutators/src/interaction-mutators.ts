import {
  isInteractionBody,
  isInteractionStatement,
  isSkipped,
} from './interactions.ts';
import type { LzStorybookTestMutator } from './mutator.ts';

function sampleOf(statement: string): string {
  return `export const Story = {\n  play: async ({ canvas, userEvent }) => {\n    ${statement}\n  },\n};\n`;
}

export function interactionMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookInteraction';
} {
  return {
    name: 'LzStorybookInteraction',
    sample: sampleOf("await userEvent.click(canvas.getByRole('button'));"),
    *mutate(path, t) {
      if (isInteractionStatement(path) && !isSkipped(path, t)) {
        yield t.emptyStatement();
      } else if (isInteractionBody(path) && !isSkipped(path, t)) {
        yield t.identifier('undefined');
      }
    },
  };
}
