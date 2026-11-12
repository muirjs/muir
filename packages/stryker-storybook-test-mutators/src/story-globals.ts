import { list, sitesOf, type Proven } from '@layzee/storybook-csf';

import type { LzStorybookTestMutator } from './mutator.ts';
import { perFile, readStoryFileAt } from './story-file.ts';

export const proofsBySite = perFile(
  (program): ReadonlyMap<unknown, readonly Proven[]> =>
    new Map(
      sitesOf(list(program.body), 'globals').map(({ node, proofs }) => [
        node,
        proofs,
      ]),
    ),
  new Map<unknown, readonly Proven[]>(),
);

export function storyGlobalsMutator(): LzStorybookTestMutator & {
  readonly name: 'LzStorybookStoryGlobals';
} {
  return {
    name: 'LzStorybookStoryGlobals',
    sample: `export default { title: 'Sample' };\nexport const Story = {\n  globals: { viewport: { value: 'mobile1' } },\n  play: async () => {},\n};\n`,
    *mutate(path, t) {
      readStoryFileAt(path, proofsBySite);

      const { node } = path;

      if (node.type !== 'ObjectExpression') {
        return;
      }

      const proofs = proofsBySite(path).get(node);

      if (proofs === undefined) {
        return;
      }

      yield* node.properties
        .filter(
          (property) => !proofs.some((proof) => proof.property === property),
        )
        .map((removed) =>
          t.objectExpression(
            node.properties
              .filter((property) => property !== removed)
              .map((property) => t.cloneNode(property)),
          ),
        );
    },
  };
}
