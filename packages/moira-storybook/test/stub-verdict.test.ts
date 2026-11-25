import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  muirMoiraStorybookDescribeVerdict,
  muirMoiraStorybookSpyStubReason,
  muirMoiraStorybookUnrewrittenChainReason,
} from '../src/stub-verdict.ts';

const fix =
  'pass the implementation to fn(), as in fn(() => value), or return the value from the function fn() already takes, or set the stub in beforeEach';

describe('spyStubReason', () => {
  it('names the ignorer, the erased verdict, the reason and the fix', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('erased'),
      `muir-shadowcat-storybook: erased: the mock reset runs before the story renders, so this stub never takes effect; ${fix}`,
    );
  });

  it('says why an order-dependent stub is erased only in some orders', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('order-dependent'),
      `muir-shadowcat-storybook: order-dependent: another story in this file resets mocks before it renders, which erases this stub when that story renders first; ${fix}`,
    );
  });

  it('says why an unknown verdict could not be read', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('unknown'),
      `muir-shadowcat-storybook: unknown: the file's parameters.test cannot be read without running it, so whether the mock reset erases this stub is unknown; ${fix}`,
    );
  });

  it('says why a *Once stub stays erased with the mock transformer on', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('once-not-rewritten'),
      `muir-shadowcat-storybook: once-not-rewritten: the mock transformer does not rewrite *Once stubs, so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('says why a stub after the first of a chain stays erased with the mock transformer on', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('chain-not-rewritten'),
      `muir-shadowcat-storybook: chain-not-rewritten: the mock transformer rewrites a stub only when it is the first of its chain, so the mock reset still erases this stub; ${fix}`,
    );
  });

  it('says why a stub on a spy call that takes arguments stays erased with the mock transformer on, and how to fix it there', () => {
    assert.equal(
      muirMoiraStorybookSpyStubReason('spy-arguments-not-rewritten'),
      `muir-shadowcat-storybook: spy-arguments-not-rewritten: the mock transformer does not rewrite a stub whose spy call takes arguments, as in fn(impl), since the rewrite would replace them, so the mock reset still erases this stub; ${fix}`,
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
      muirMoiraStorybookUnrewrittenChainReason,
      `muir-shadowcat-storybook: chain-not-rewritten: the mock transformer rewrites none of the stubs of this chain, so the mock reset still erases every one of them; ${fix}`,
    );
  });
});
