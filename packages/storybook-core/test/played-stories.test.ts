import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from '@babel/parser';

import { csfFile, topLevelBindings } from '../src/csf.ts';
import { field, list } from '../src/node-field.ts';
import {
  isUnknownPlay,
  playedStories,
  unknownOverAPlay,
} from '../src/played-stories.ts';

function played(...lines: readonly string[]) {
  const body = list(
    field(
      parse(lines.join('\n'), {
        sourceType: 'module',
        plugins: ['typescript'],
      }),
      'program',
      'body',
    ),
  );
  const bindings = topLevelBindings(body);

  return playedStories(body, bindings, csfFile(body, bindings));
}

function namesOf(stories: ReturnType<typeof played>): readonly string[] {
  return stories.map(({ story }) => story.name);
}

describe('playedStories', () => {
  it('lists a story with its own play, and not one without a play or test', () => {
    assert.deepEqual(
      namesOf(
        played(
          "export default { title: 'a/b' };",
          'export const A = { play: async () => {} };',
          'export const B = {};',
        ),
      ),
      ['A'],
    );
  });

  it("lists a story under a meta whose '!test' tags have a string-literal key, which Storybook does not read", () => {
    assert.deepEqual(
      namesOf(
        played(
          "export default { title: 'a/b', 'tags': ['!test'] };",
          'export const A = { play: async () => {} };',
        ),
      ),
      ['A'],
    );
  });

  it("lists a story a meta's excludeStories with a string-literal key names, which Storybook does not read", () => {
    assert.deepEqual(
      namesOf(
        played(
          "export default { title: 'a/b', 'excludeStories': ['A'] };",
          'export const A = { play: async () => {} };',
        ),
      ),
      ['A'],
    );
  });

  it("lists no story under a meta whose '!test' tags have a computed key that names tags, which Storybook reads as tags", () => {
    assert.deepEqual(
      namesOf(
        played(
          "import { tags } from './keys';",
          "export default { title: 'a/b', [tags]: ['!test'] };",
          'export const A = { play: async () => {} };',
        ),
      ),
      [],
    );
  });

  it('lists none in a file with no meta object, which Storybook does not index', () => {
    assert.deepEqual(
      namesOf(played('export const A = { play: async () => {} };')),
      [],
    );
  });

  it('gives the last play assigned to the story, followed to the top-level function it names', () => {
    const [story] = played(
      "export default { title: 'a/b', play: () => {} };",
      'const assigned = async () => {};',
      'export const A = { play: () => {} };',
      'A.play = assigned;',
    );

    assert.equal(field(story?.play, 'async'), true);
  });

  it("gives the meta's play to a story without one, and a spread story's play to a story that spreads it", () => {
    const stories = played(
      "export default { title: 'a/b', play: () => {} };",
      'export const A = {};',
      'export const B = { play: async () => {} };',
      'export const C = { ...B };',
    );

    assert.deepEqual(
      stories.map(({ story, play }) => [story.name, field(play, 'async')]),
      [
        ['A', false],
        ['B', true],
        ['C', true],
      ],
    );
  });

  it('gives an unknown play to a story where a spread of an imported object may set play last, as only running the file tells', () => {
    const stories = played(
      "import { Shared } from './shared';",
      "export default { title: 'a/b' };",
      'export const A = { play: async () => {}, ...Shared };',
      'export const B = { ...Shared, play: async () => {} };',
    );

    assert.deepEqual(
      stories.map(({ story, play }) => [
        story.name,
        typeof play === 'string' ? play : field(play, 'type'),
      ]),
      [
        ['A', 'unknown over a play'],
        ['B', 'ArrowFunctionExpression'],
      ],
    );
  });

  it('gives an unknown play with no play under it to a story whose only play a spread of an imported object may set', () => {
    const [story] = played(
      "import { Shared } from './shared';",
      "export default { title: 'a/b' };",
      'export const A = { ...Shared };',
    );

    assert.equal(story?.play, 'unknown');
  });

  it('tells both unknown plays from a play the file reads', () => {
    assert.deepEqual(
      played(
        "import { Shared } from './shared';",
        "export default { title: 'a/b' };",
        'export const A = { ...Shared };',
        'export const B = { play: async () => {}, ...Shared };',
        'export const C = { play: async () => {} };',
      ).map(({ play }) => isUnknownPlay(play)),
      [true, true, false],
    );
  });

  it('gives the play assigned to a story whose own play a spread of an imported object may set', () => {
    const [story] = played(
      "import { Shared } from './shared';",
      "export default { title: 'a/b' };",
      'export const A = { ...Shared };',
      'A.play = async () => {};',
    );

    assert.equal(field(story?.play, 'type'), 'ArrowFunctionExpression');
  });

  it('gives an unknown play over a play to a story under a meta whose play a later spread of an imported object may replace', () => {
    const [story] = played(
      "import { Shared } from './shared';",
      "export default { title: 'a/b', play: async () => {}, ...Shared };",
      'export const A = {};',
    );

    assert.equal(story?.play, unknownOverAPlay);
  });

  it("gives an .extend() story its base story's play", () => {
    const stories = played(
      "import preview from '../.storybook/preview';",
      "const meta = preview.meta({ title: 'a/b' });",
      'export const A = meta.story({ play: async () => {} });',
      'export const B = A.extend({});',
    );

    assert.deepEqual(namesOf(stories), ['A', 'B']);
  });

  it('leaves out a story whose static tags end in !test, after the meta', () => {
    const stories = played(
      "export default { title: 'a/b', tags: ['!test'] };",
      'export const A = { play: async () => {} };',
      "export const B = { tags: ['test'], play: async () => {} };",
    );

    assert.deepEqual(namesOf(stories), ['B']);
  });

  it('gives the first indexed .test() call of each name, with its options and test function', () => {
    const [story] = played(
      "import preview from '../.storybook/preview';",
      "const meta = preview.meta({ title: 'a/b' });",
      'export const A = meta.story({});',
      "A.test('one', { args: {} }, async () => {});",
      "A.test('one', () => {});",
      "A.test('two', () => {});",
    );

    assert.deepEqual(
      story?.tests.map((test) => [
        field(test, 'options', 'type'),
        field(test, 'testFunction', 'async'),
      ]),
      [
        ['ObjectExpression', true],
        [undefined, false],
      ],
    );
  });

  it('lists no story whose only .test() call has a name and no other argument, which Storybook does not index', () => {
    assert.deepEqual(
      namesOf(
        played(
          "import preview from '../.storybook/preview';",
          "const meta = preview.meta({ title: 'a/b' });",
          'export const A = meta.story({});',
          "A.test('one');",
        ),
      ),
      [],
    );
  });

  it('gives .test() options named by a top-level constant as the name, for resolvedValues to follow', () => {
    const [story] = played(
      "import preview from '../.storybook/preview';",
      "const meta = preview.meta({ title: 'a/b' });",
      'export const A = meta.story({});',
      'const options = { args: {} };',
      "A.test('one', options, () => {});",
    );

    assert.deepEqual(
      story?.tests.map((test) => field(test, 'options', 'type')),
      ['Identifier'],
    );
  });
});
