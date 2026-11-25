import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { muirBansheeStorybookVitestSiteFindings } from '../src/stub-findings.ts';
import { project } from './support/storybook-project.ts';
import { untaggedPreviewTestTags } from './support/test-tags.ts';

describe('siteFindings', () => {
  it('gives a repaired stub inside a *Once stub no finding of its own', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export default {',
      "  args: { g: fn().mockReturnValueOnce(fn().mockReturnValue('x')) },",
      '};',
      'export const Primary = {};',
    ].join('\n');

    const findings = muirBansheeStorybookVitestSiteFindings(
      code,
      'Meta.stories.tsx',
      project('seen'),
      () => undefined,
    );

    assert.deepEqual(
      findings.map(({ line, verdict }) => [line, verdict]),
      [[3, 'once-not-rewritten']],
    );
  });

  it('gives a stub on a spy call that takes arguments the spy-arguments-not-rewritten finding, and the rewritten stub inside them none', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export default {',
      '  args: { g: fn(fn().mockReturnValue(2)).mockReturnValue(1) },',
      '};',
      'export const Primary = {};',
    ].join('\n');

    const findings = muirBansheeStorybookVitestSiteFindings(
      code,
      'Meta.stories.tsx',
      project('seen'),
      () => undefined,
    );

    assert.deepEqual(
      findings.map(({ line, verdict }) => [line, verdict]),
      [[3, 'spy-arguments-not-rewritten']],
    );
  });

  it('gives a stub after the first of a chain the chain-not-rewritten finding, and the rewritten first stub none', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export default {',
      '  args: { g: fn().mockReturnValue(1).mockReturnValue(2) },',
      '};',
      'export const Primary = {};',
    ].join('\n');

    const findings = muirBansheeStorybookVitestSiteFindings(
      code,
      'Meta.stories.tsx',
      project('seen'),
      () => undefined,
    );

    assert.deepEqual(
      findings.map(({ line, verdict }) => [line, verdict]),
      [[3, 'chain-not-rewritten']],
    );
  });

  it('gives a stub chained after a *Once stub the chain-not-rewritten finding, beside the *Once finding', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export default {',
      '  args: {',
      '    g: fn()',
      '      .mockResolvedValueOnce(1)',
      '      .mockResolvedValue(2),',
      '  },',
      '};',
      'export const Primary = {};',
    ].join('\n');

    const findings = muirBansheeStorybookVitestSiteFindings(
      code,
      'Meta.stories.tsx',
      project('seen'),
      () => undefined,
    );

    assert.deepEqual(
      findings.map(({ line, verdict }) => [line, verdict]),
      [
        [4, 'chain-not-rewritten'],
        [4, 'once-not-rewritten'],
      ],
    );
  });

  it('names the stub method of each finding as the story writes it', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export default {',
      '  args: { g: fn().mockResolvedValueOnce(1).mockResolvedValue(2) },',
      '};',
      'export const Primary = {};',
    ].join('\n');

    const findings = muirBansheeStorybookVitestSiteFindings(
      code,
      'Meta.stories.tsx',
      project('seen'),
      () => undefined,
    );

    assert.deepEqual(
      findings.map(({ method, verdict }) => [method, verdict]),
      [
        ['mockResolvedValue', 'chain-not-rewritten'],
        ['mockResolvedValueOnce', 'once-not-rewritten'],
      ],
    );
  });

  it('silences every stub of a chain under a Stryker disable comment', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export default {',
      '  args: {',
      '    // Stryker disable next-line all',
      '    g: fn().mockResolvedValueOnce(1).mockResolvedValue(2),',
      '  },',
      '};',
      'export const Primary = {};',
    ].join('\n');

    const findings = muirBansheeStorybookVitestSiteFindings(
      code,
      'Meta.stories.tsx',
      project('seen'),
      () => undefined,
    );

    assert.deepEqual(findings, []);
  });

  [
    { comment: '//Stryker disable next-line all', lines: [] },
    { comment: '// see Stryker disable next-line all', lines: [4] },
  ].forEach(({ comment, lines }) => {
    it(`reads the comment "${comment}" as Stryker does`, () => {
      const code = [
        "import { fn } from 'storybook/test';",
        'export default {',
        `  ${comment}`,
        '  args: { g: fn().mockReturnValueOnce(1) },',
        '};',
        'export const Primary = {};',
      ].join('\n');

      const findings = muirBansheeStorybookVitestSiteFindings(
        code,
        'Meta.stories.tsx',
        project('seen'),
        () => undefined,
      );

      assert.deepEqual(
        findings.map(({ line }) => line),
        lines,
      );
    });
  });

  it("counts only the stories that the project's tag filter tests", () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export default { parameters: { test: { restoreMocks: false } } };',
      'export const A = { parameters: { test: { mockReset: true } } };',
      "export const B = { tags: ['smoke'], args: { g: fn().mockReturnValue(1) } };",
    ].join('\n');

    const findings = muirBansheeStorybookVitestSiteFindings(
      code,
      'Tags.stories.tsx',
      project('not-seen', { ...untaggedPreviewTestTags, include: ['smoke'] }),
      () => undefined,
    );

    assert.deepEqual(findings, []);
  });
});
