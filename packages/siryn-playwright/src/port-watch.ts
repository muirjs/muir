import { setTimeout } from 'node:timers/promises';

import type { MuirSirynPlaywrightServerCheck } from './server-checks.ts';
import type { MuirSirynPlaywrightServerMove } from './server-ports.ts';
import {
  type MuirSirynPlaywrightServerMutate,
  MuirSirynPlaywrightServerSupportRefused,
} from './server-refusal.ts';

export interface MuirSirynPlaywrightMovedServers {
  readonly moves: readonly MuirSirynPlaywrightServerMove[];
  readonly configuredChecks: readonly (
    | MuirSirynPlaywrightServerCheck
    | undefined
  )[];
}

const boundPollMs = 250;

export async function muirSirynPlaywrightGlobalSetupWatchingConfiguredPorts(
  globalSetup: () => Promise<void>,
  moved: MuirSirynPlaywrightMovedServers,
  mutate: MuirSirynPlaywrightServerMutate,
): Promise<void> {
  const answering = new Set(await boundMoves(moved));
  const watched = {
    ...moved,
    moves: moved.moves.filter((move) => !answering.has(move)),
  };
  const setup = globalSetup();
  let watching = true;
  const watch = async () => {
    while (watching) {
      const [bound] = await boundMoves(watched);

      if (bound) {
        return bound;
      }

      // Stryker disable next-line NodeTimerDelay: the delay only paces the watch; 1 ms more or less changes no result
      await setTimeout(boundPollMs);
    }

    return undefined;
  };

  let early: MuirSirynPlaywrightServerMove | undefined;

  try {
    early = await Promise.race([setup.then(() => undefined), watch()]);
  } catch (error) {
    const [late] = await boundMoves(watched);

    if (late) {
      throw boundConfiguredPort(mutate, late, error);
    }

    const [held] =
      mutate === 'auto'
        ? await boundMoves({
            ...moved,
            // Stryker disable next-line MethodExpression: the late check just above found every watched move down, so only a port that comes up between the two checks, while watch() polls too, tells the lists apart
            moves: moved.moves.filter((move) => answering.has(move)),
          })
        : [];

    throw held ? heldConfiguredPort(held, error) : error;
  } finally {
    watching = false;
  }

  if (early) {
    const settled = setup.catch(() => undefined);

    if (mutate === 'auto') {
      await settled;
    }

    throw boundConfiguredPort(mutate, early, undefined);
  }
}

async function boundMoves({
  moves,
  configuredChecks,
}: MuirSirynPlaywrightMovedServers): Promise<MuirSirynPlaywrightServerMove[]> {
  const bound = await Promise.all(
    moves.map(async (move) =>
      (await configuredChecks[move.index]?.isUp()) ? [move] : [],
    ),
  );

  return bound.flat();
}

function boundConfiguredPort(
  mutate: MuirSirynPlaywrightServerMutate,
  { index, from, to }: MuirSirynPlaywrightServerMove,
  cause: unknown,
): MuirSirynPlaywrightServerSupportRefused {
  return movedPortRefusal(
    mutate,
    `the command of webServer ${index} bound port ${from} instead of ${to}`,
    cause,
  );
}

function heldConfiguredPort(
  { index, from }: MuirSirynPlaywrightServerMove,
  cause: unknown,
): MuirSirynPlaywrightServerSupportRefused {
  const setupError =
    cause instanceof Error ? cause.message.trim() : String(cause);

  return movedPortRefusal(
    'auto',
    `global setup failed (${setupError}) while another server answered on port ${from}, the configured ` +
      `port of webServer ${index}, such as the webServer of a process that turned server support off`,
    cause,
  );
}

function movedPortRefusal(
  mutate: MuirSirynPlaywrightServerMutate,
  problem: string,
  cause: unknown,
): MuirSirynPlaywrightServerSupportRefused {
  return new MuirSirynPlaywrightServerSupportRefused(
    mutate,
    "Stryker starts more than one test runner process, so each process's webServer " +
      `moves to a port of its own, and ${problem}. ` +
      "Make the command take its port from PORT, from the webServer's env, or from a --port in the command " +
      '(the runner moves all three), or run Stryker with concurrency 1 and no checker ' +
      '(see More than one Stryker process in the README).',
    cause === undefined ? undefined : { cause },
  );
}
