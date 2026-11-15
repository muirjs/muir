import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { spyStubReason, unrewrittenChainReason } from '../src/stub-verdict.ts';

const fix =
  'pass the implementation to fn(), as in fn(() => value), or set the stub in beforeEach';

describe('spyStubReason', () => {
  it('names the ignorer, the erased verdict, the reason and the fix', () => {
    assert.equal(
      spyStubReason('erased'),
      `lz-storybook: erased: the mock reset runs before the story renders, so this stub never takes effect; ${fix}`,
    );
  });

  it('says why an order-dependent stub is erased only in some orders', () => {
    assert.equal(
      spyStubReason('order-dependent'),
      `lz-storybook: order-dependent: another story in this file resets mocks before it renders, which erases this stub when that story renders first; ${fix}`,
    );
  });

  it('says why an unknown verdict could not be read', () => {
    assert.equal(
      spyStubReason('unknown'),
      `lz-storybook: unknown: the file's parameters.test cannot be read without running it, so whether the mock reset erases this stub is unknown; ${fix}`,
    );
  });

  it('says why a *Once stub stays erased with the mock transformer on', () => {
    assert.equal(
      spyStubReason('once-not-rewritten'),
      `lz-storybook: once-not-rewritten: the mock transformer does not rewrite *Once stubs, so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('says why a stub after the first of a chain stays erased with the mock transformer on', () => {
    assert.equal(
      spyStubReason('chain-not-rewritten'),
      `lz-storybook: chain-not-rewritten: the mock transformer rewrites a stub only when it is the first of its chain, so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('says why a stub on a spy call that takes an implementation stays erased with the mock transformer on', () => {
    assert.equal(
      spyStubReason('implementation-not-rewritten'),
      `lz-storybook: implementation-not-rewritten: the mock transformer does not rewrite a stub whose spy call takes an implementation, as in fn(impl), so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('says why every stub of a chain that the mock transformer leaves whole stays erased', () => {
    assert.equal(
      unrewrittenChainReason,
      `lz-storybook: chain-not-rewritten: the mock transformer rewrites no stub of this chain, as none is a stub it rewrites (the first of its chain, not a *Once stub, on a spy call that takes no implementation), so the mock reset still erases every stub of this chain; ${fix}`,
    );
  });
});
