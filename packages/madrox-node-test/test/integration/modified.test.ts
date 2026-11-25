import { describe, it } from 'node:test';

import { report } from '../reported.fixtures.ts';
import { muirTestEach } from '../../src/test-each.ts';
import { muirTestFor } from '../../src/test-for.ts';

describe('the modifiers of muirTestEach and muirTestFor', () => {
  it('skips, marks todo, and inverts the outcome, composed in any order', async (t) => {
    await t.assert.reports(() => {
      muirTestEach.skip([1])('skip %s', report);
      muirTestFor.todo([1])('todo %s', () => {});
      muirTestEach.fails([1, 2])('fails %s', (n) => {
        if (n === 1) {
          throw new Error('one');
        }
      });
      muirTestFor.fails([1])('fails async %s', () =>
        Promise.reject(new Error('rejects')),
      );
      muirTestEach.todo.fails([1])('todo fails %s', () => {});
      muirTestEach.fails.todo([1])('fails todo %s', () => {});
    }, [
      { name: 'skip 1', outcome: 'pass', skip: true },
      { name: 'todo 1', outcome: 'pass', todo: true },
      { name: 'fails 1', outcome: 'pass' },
      {
        name: 'fails 2',
        outcome: 'fail',
        error: 'The test passed, but it is marked to fail.',
      },
      { name: 'fails async 1', outcome: 'pass' },
      {
        name: 'todo fails 1',
        outcome: 'fail',
        todo: true,
        error: 'The test passed, but it is marked to fail.',
      },
      {
        name: 'fails todo 1',
        outcome: 'fail',
        todo: true,
        error: 'The test passed, but it is marked to fail.',
      },
    ]);
  });

  it('skips with skipIf a truthy condition and with runIf a falsy one, keeping a skip on either side', async (t) => {
    await t.assert.reports(() => {
      muirTestEach.skipIf(1)([1])('skipIf truthy %s', () => {});
      muirTestEach.skipIf(0)([1])('skipIf falsy %s', () => {});
      muirTestFor.runIf('')([1])('runIf falsy %s', () => {});
      muirTestFor.runIf('yes')([1])('runIf truthy %s', () => {});
      muirTestEach.skip.skipIf(0)([1])('skip then skipIf falsy %s', () => {});
      muirTestFor.skip.runIf('yes')([1])('skip then runIf truthy %s', () => {});
      muirTestEach.skipIf(0).skip([1])('skipIf falsy then skip %s', () => {});
      muirTestEach.skipIf(0).fails([1])('then fails %s', report);
    }, [
      { name: 'skipIf truthy 1', outcome: 'pass', skip: true },
      { name: 'skipIf falsy 1', outcome: 'pass' },
      { name: 'runIf falsy 1', outcome: 'pass', skip: true },
      { name: 'runIf truthy 1', outcome: 'pass' },
      { name: 'skip then skipIf falsy 1', outcome: 'pass', skip: true },
      { name: 'skip then runIf truthy 1', outcome: 'pass', skip: true },
      { name: 'skipIf falsy then skip 1', outcome: 'pass', skip: true },
      { name: 'then fails 1', outcome: 'pass' },
    ]);
  });

  it('runs only the tests marked only when node:test runs only those', async (t) => {
    await t.assert.reports(
      () => {
        muirTestEach.only([1])('only %s', () => {});
        muirTestFor([2])('other %s', () => {});
      },
      [{ name: 'only 1', outcome: 'pass' }],
      { only: true },
    );
  });
});
