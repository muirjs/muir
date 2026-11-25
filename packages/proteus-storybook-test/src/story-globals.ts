import {
  muirMoiraStorybookFileNameOf,
  muirMoiraStorybookList,
  muirMoiraStorybookSitesOf,
  type MuirMoiraStorybookProven,
} from '@muirjs/moira-storybook';

import type { MuirProteusStorybookTestMutator } from './mutator.ts';
import {
  muirProteusStorybookTestPerFile,
  muirProteusStorybookTestReadStoryFileAt,
} from './story-file.ts';

export const muirProteusStorybookTestProofsBySite =
  muirProteusStorybookTestPerFile(
    (program): ReadonlyMap<unknown, readonly MuirMoiraStorybookProven[]> =>
      new Map(
        muirMoiraStorybookSitesOf(
          muirMoiraStorybookList(program.node.body),
          'globals',
          muirMoiraStorybookFileNameOf(program),
        ).map(({ node, proofs }) => [node, proofs]),
      ),
    new Map<unknown, readonly MuirMoiraStorybookProven[]>(),
  );

export function muirProteusStorybookTestStoryGlobalsMutator(): MuirProteusStorybookTestMutator & {
  readonly name: 'MuirProteusStorybookTestStoryGlobals';
} {
  return {
    name: 'MuirProteusStorybookTestStoryGlobals',
    sample: `export default { title: 'Sample' };\nexport const Story = {\n  globals: { viewport: { value: 'mobile1' } },\n  play: async () => {},\n};\n`,
    *mutate(path, t) {
      muirProteusStorybookTestReadStoryFileAt(
        path,
        muirProteusStorybookTestProofsBySite,
      );

      const { node } = path;

      if (node.type !== 'ObjectExpression') {
        return;
      }

      const proofs = muirProteusStorybookTestProofsBySite(path).get(node);

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
