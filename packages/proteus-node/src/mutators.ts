import {
  muirMoiraMutatorsAllMutators,
  type MuirMoiraMutatorsBabelMutator,
  type MuirMoiraMutatorsMutatorSets,
} from '@muirjs/moira-mutators';
import { muirProteusNodeAssertStatement } from './node-assert-statement.ts';
import { muirProteusNodeAwaitStatement } from './node-await-statement.ts';
import { muirProteusNodeByteLength } from './node-byte-length.ts';
import { muirProteusNodeCallbackError } from './node-callback-error.ts';
import { muirProteusNodeEventName } from './node-event-name.ts';
import { muirProteusNodeExitCode } from './node-exit-code.ts';
import { muirProteusNodeListenerOnce } from './node-listener-once.ts';
import { muirProteusNodeReturnAwait } from './node-return-await.ts';
import { muirProteusNodeTimerDelay } from './node-timer-delay.ts';

export const muirProteusNodeMutatorSets = {
  defaults: [
    muirProteusNodeTimerDelay,
    muirProteusNodeEventName,
    muirProteusNodeAwaitStatement,
    muirProteusNodeReturnAwait,
    muirProteusNodeExitCode,
  ],
  optIn: [muirProteusNodeAssertStatement, muirProteusNodeListenerOnce],
  experimental: [muirProteusNodeByteLength, muirProteusNodeCallbackError],
} satisfies MuirMoiraMutatorsMutatorSets<MuirMoiraMutatorsBabelMutator>;

export const muirProteusNodeMutators =
  muirMoiraMutatorsAllMutators<MuirMoiraMutatorsBabelMutator>(
    muirProteusNodeMutatorSets,
  );
