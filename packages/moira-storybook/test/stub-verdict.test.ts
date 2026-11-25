import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { muirMoiraStorybookProject } from '../src/storybook-project.ts';
import {
  muirMoiraStorybookDescribeVerdict,
  muirMoiraStorybookSpyStubReason,
  muirMoiraStorybookStubIgnores,
  muirMoiraStorybookUnrewrittenChainReason,
} from '../src/stub-verdict.ts';
import { storyFile } from './support/reset-setting.ts';

const pluginName = 'muir-example-plugin';

const fixtures = fileURLToPath(new URL('fixtures/', import.meta.url));

const allDefault = readFileSync(
  join(fixtures, 'reset-cases', 'F01AllDefault.stories.tsx.txt'),
  'utf8',
);

/** Each ignore as its covers, its reason and the stub call's source. */
function ignoresOf(fixture: 'no-main' | 'transformer', code: string) {
  const project = muirMoiraStorybookProject(
    '@muirjs/example-package',
    join(fixtures, fixture, '.storybook'),
    { info: () => undefined, warn: () => undefined },
  );
  const fileName = join(fixtures, fixture, 'src', 'Stub.stories.tsx');

  return muirMoiraStorybookStubIgnores(
    storyFile(code, fileName),
    project,
    pluginName,
  ).map(({ start, end, covers, reason }) => ({
    covers,
    reason,
    call: code.slice(start, end),
  }));
}

describe('stubIgnores', () => {
  it('ignores the whole call of a stub the reset erases', () => {
    assert.deepEqual(ignoresOf('no-main', allDefault), [
      {
        covers: 'call',
        reason: muirMoiraStorybookSpyStubReason('erased', pluginName),
        call: "fn().mockReturnValue('stubbed')",
      },
      {
        covers: 'call',
        reason: muirMoiraStorybookSpyStubReason('erased', pluginName),
        call: "fn().mockReturnValue('stubbed')",
      },
    ]);
  });

  it('ignores only the arguments of a stub on a spy call that takes arguments', () => {
    assert.deepEqual(
      ignoresOf(
        'no-main',
        allDefault.replace(
          'fn().mockReturnValue(',
          "fn(() => 'own').mockReturnValue(",
        ),
      ).map(({ covers }) => covers),
      ['arguments', 'call'],
    );
  });

  it('ignores no stub that the mock transformer rewrites', () => {
    assert.deepEqual(ignoresOf('transformer', allDefault), []);
  });

  it('ignores only the arguments of a stub whose rewritten first stub of its chain is kept', () => {
    assert.deepEqual(
      ignoresOf(
        'transformer',
        allDefault.replace(
          "mockReturnValue('stubbed')",
          "mockReturnValue('first').mockReturnValue('second')",
        ),
      ),
      [
        {
          covers: 'arguments',
          reason: muirMoiraStorybookSpyStubReason(
            'chain-not-rewritten',
            pluginName,
          ),
          call: "fn().mockReturnValue('first').mockReturnValue('second')",
        },
      ],
    );
  });

  it('gives a stub whose chain holds other verdicts the reason for the whole chain, and the stub before it its own', () => {
    assert.deepEqual(
      ignoresOf(
        'transformer',
        allDefault.replace(
          "mockReturnValue('stubbed')",
          "mockReturnValueOnce('first').mockReturnValue('second')",
        ),
      ).map(({ covers, reason }) => ({ covers, reason })),
      [
        {
          covers: 'call',
          reason: muirMoiraStorybookUnrewrittenChainReason(pluginName),
        },
        {
          covers: 'call',
          reason: muirMoiraStorybookSpyStubReason(
            'once-not-rewritten',
            pluginName,
          ),
        },
      ],
    );
  });

  it('gives every stub of a chain with one verdict that verdict', () => {
    assert.deepEqual(
      ignoresOf(
        'transformer',
        allDefault.replace(
          "mockReturnValue('stubbed')",
          "mockReturnValueOnce('first').mockReturnValueOnce('second')",
        ),
      ).map(({ covers, reason }) => ({ covers, reason })),
      [
        {
          covers: 'call',
          reason: muirMoiraStorybookSpyStubReason(
            'once-not-rewritten',
            pluginName,
          ),
        },
        {
          covers: 'call',
          reason: muirMoiraStorybookSpyStubReason(
            'once-not-rewritten',
            pluginName,
          ),
        },
      ],
    );
  });
});

const fix =
  'pass the implementation to fn(), as in fn(() => value), or return the value from the function fn() already takes, or set the stub in beforeEach';

describe('spyStubReason', () => {
  it('names the given ignorer, the erased verdict, the reason and the fix', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('erased', pluginName),
      `${pluginName}: erased: the mock reset runs before the story renders, so this stub never takes effect; ${fix}`,
    );
  });

  it('says why an order-dependent stub is erased only in some orders', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('order-dependent', pluginName),
      `${pluginName}: order-dependent: another story in this file resets mocks before it renders, which erases this stub when that story renders first; ${fix}`,
    );
  });

  it('says why an unknown verdict could not be read', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('unknown', pluginName),
      `${pluginName}: unknown: the file's parameters.test cannot be read without running it, so whether the mock reset erases this stub is unknown; ${fix}`,
    );
  });

  it('says why a *Once stub stays erased with the mock transformer on', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('once-not-rewritten', pluginName),
      `${pluginName}: once-not-rewritten: the mock transformer does not rewrite *Once stubs, so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('says why a stub after the first of a chain stays erased with the mock transformer on', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('chain-not-rewritten', pluginName),
      `${pluginName}: chain-not-rewritten: the mock transformer rewrites a stub only when it is the first of its chain, so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('says why a stub on a spy call that takes arguments stays erased with the mock transformer on, and how to fix it there', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason(
        'spy-arguments-not-rewritten',
        pluginName,
      ),
      `${pluginName}: spy-arguments-not-rewritten: the mock transformer does not rewrite a stub whose spy call takes arguments, as in fn(impl), since the rewrite would replace them, so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('gives every finding the same fix, which also fits a spy that already takes a function', () => {
    assert.equal(
      muirMoiraStorybookDescribeVerdict('spy-arguments-not-rewritten').fix,
      fix,
    );
    assert.equal(muirMoiraStorybookDescribeVerdict('erased').fix, fix);
  });

  it('says why every stub of a chain that the mock transformer leaves whole stays erased', () => {
    assert.equal(
      muirMoiraStorybookUnrewrittenChainReason(pluginName),
      `${pluginName}: chain-not-rewritten: the mock transformer rewrites none of the stubs of this chain, so the mock reset still erases every one of them; ${fix}`,
    );
  });
});
