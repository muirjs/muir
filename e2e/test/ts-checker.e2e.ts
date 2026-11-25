import assert from 'node:assert/strict';
import { it } from 'node:test';

import {
  muirFixture,
  muirLeftover,
  muirMutant,
  muirMutants,
} from '../src/fixture.ts';

const run = await (await muirFixture('ts-checker')).stryker();

it('reports the mutants the TypeScript checker rejects as compile errors and kills the rest', () => {
  assert.deepEqual(muirMutants(run, 'src/math.ts'), [
    '1:51 BlockStatement {} CompileError',
    '2:10 ArithmeticOperator a - b Killed',
    '5:44 BlockStatement {} CompileError',
    '6:10 ArithmeticOperator n * 2 Killed',
    '6:10 ConditionalExpression false Killed',
    '6:10 ConditionalExpression true Killed',
    '6:10 EqualityOperator n % 2 !== 0 Killed',
  ]);
});

it('kills the timer delay mutants of the installed mutators when a test mocks the timers', () => {
  assert.deepEqual(muirMutants(run, 'src/later.ts'), [
    '3:61 BlockStatement {} CompileError',
    '4:27 MuirProteusNodeTimerDelay 10 + 1 Killed',
    '4:27 MuirProteusNodeTimerDelay 10 - 1 Killed',
  ]);
});

it('ends a mutant whose test grows past maxMemoryMB as a timeout that names the limit', () => {
  const mutant = muirMutant(run, {
    at: 'src/grow.ts:2:10',
    replacement: 'true',
  });

  assert.equal(mutant.status, 'Timeout');
  assert.match(mutant.statusReason, /^Memory limit reached \(\d+\/300 MB\)$/);
});

it('leaves nothing in its temporary directory', () => {
  assert.deepEqual(muirLeftover(run), []);
});
