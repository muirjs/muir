import net from 'node:net';

import { muirSirynPlaywrightIsRecord } from './is-record.ts';
import type {
  MuirSirynPlaywrightConfigHandles,
  MuirSirynPlaywrightConfigProject,
  MuirSirynPlaywrightConfigWebServer,
} from './playwright-internals.ts';
import {
  muirSirynPlaywrightEnvOf,
  muirSirynPlaywrightSetEnv,
} from './process-env.ts';
import { muirSirynPlaywrightHostKey } from './server-protocol.ts';
import {
  type MuirSirynPlaywrightServerMutate,
  MuirSirynPlaywrightServerSupportRefused,
} from './server-refusal.ts';

export interface MuirSirynPlaywrightServerMove {
  readonly index: number;
  readonly from: number;
  readonly to: number;
}

export interface MuirSirynPlaywrightServersApart {
  readonly moves: readonly MuirSirynPlaywrightServerMove[];
  readonly webServers: readonly MuirSirynPlaywrightConfigWebServer[];
  readonly baseURL: string | undefined;
  readonly env: Readonly<Record<string, string>>;
}

const baseUrlEnv = 'PLAYWRIGHT_TEST_BASE_URL';

export async function muirSirynPlaywrightMoveServersApart(
  config: {
    readonly projects: readonly MuirSirynPlaywrightConfigProject[];
    readonly webServers: readonly MuirSirynPlaywrightConfigWebServer[];
  },
  env: NodeJS.ProcessEnv,
  mutate: MuirSirynPlaywrightServerMutate,
  nextPort: () => Promise<number> = muirSirynPlaywrightFreePort,
): Promise<MuirSirynPlaywrightServersApart | undefined> {
  const planned = await Promise.all(
    config.webServers.map((server, index) => planMove(server, index, nextPort)),
  );
  const moves = planned.flatMap(({ move }) => (move ? [move] : []));
  const [first] = moves;

  if (!first) {
    return undefined;
  }

  const baseUrls = config.projects.flatMap(({ baseURL: url }) =>
    url === undefined ? [] : [url],
  );
  const movedUrl = (url: string): string | undefined => {
    const to = URL.canParse(url)
      ? moves.find(
          ({ host }) => host === muirSirynPlaywrightHostKey(new URL(url)),
        )?.to
      : undefined;

    return to === undefined ? undefined : withPort(url, to);
  };
  const unmoved = baseUrls.filter((url) => movedUrl(url) === undefined);

  if (unmoved.length > 0) {
    throw cannotMove(
      mutate,
      `the baseURL ${unmoved.join(', ')} points at no webServer`,
    );
  }

  if (
    new Set(baseUrls.map((url) => muirSirynPlaywrightHostKey(new URL(url))))
      .size > 1
  ) {
    throw cannotMove(
      mutate,
      `the projects' baseURLs point at different webServers (${baseUrls.join(', ')})`,
    );
  }

  if (new Set(baseUrls.map(withHostKey)).size > 1) {
    throw cannotMove(
      mutate,
      `the projects' baseURLs differ in more than the loopback host name (${baseUrls.join(', ')})`,
    );
  }

  const [baseURL] = baseUrls;
  const testBaseUrl = env[baseUrlEnv];
  const movedTestBaseUrl =
    // Stryker disable next-line ConditionalExpression: equivalent, as movedUrl moves no URL it cannot parse, and undefined is one
    testBaseUrl === undefined ? undefined : movedUrl(testBaseUrl);

  return {
    moves: moves.map(({ index, from, to }) => ({ index, from, to })),
    webServers: planned.map(({ server }) => server),
    baseURL: baseURL === undefined ? undefined : movedUrl(baseURL),
    env: {
      ...(moves.length === 1 ? { PORT: String(first.to) } : {}),
      ...(movedTestBaseUrl === undefined
        ? {}
        : { [baseUrlEnv]: movedTestBaseUrl }),
    },
  };
}

async function planMove(
  server: MuirSirynPlaywrightConfigWebServer,
  index: number,
  nextPort: () => Promise<number>,
) {
  const waitsFor =
    server.url ??
    (server.port === undefined ? undefined : `http://localhost:${server.port}`);

  if (waitsFor === undefined) {
    return { server, move: undefined };
  }

  const url = new URL(waitsFor);
  const to = await nextPort();

  return {
    server: {
      ...server,
      ...(server.url === undefined ? {} : { url: withPort(server.url, to) }),
      ...(server.port === undefined ? {} : { port: to }),
    },
    move: {
      index,
      from: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      to,
      host: muirSirynPlaywrightHostKey(url),
    },
  };
}

function cannotMove(
  mutate: MuirSirynPlaywrightServerMutate,
  reason: string,
): MuirSirynPlaywrightServerSupportRefused {
  return new MuirSirynPlaywrightServerSupportRefused(
    mutate,
    'Stryker starts more than one test runner process, so each process ' +
      `needs a webServer port of its own, and the runner cannot move the projects' baseURL along: ${reason}. ` +
      'Point the baseURL of every project that runs at the url or port of the same webServer, or leave it unset, ' +
      'or run Stryker with concurrency 1 and no checker (see More than one Stryker process in the README).',
  );
}

function withHostKey(url: string): string {
  const keyed = new URL(url);
  keyed.host = muirSirynPlaywrightHostKey(keyed);

  return keyed.href;
}

function withPort(url: string, port: number): string {
  const moved = new URL(url);
  moved.port = String(port);

  return moved.href;
}

export function muirSirynPlaywrightMoveApart(
  playwright: MuirSirynPlaywrightConfigHandles,
  apart: MuirSirynPlaywrightServersApart,
): () => void {
  const previousEnv = muirSirynPlaywrightEnvOf(Object.keys(apart.env));
  muirSirynPlaywrightMoveWebServers(playwright, apart.moves, apart.baseURL);
  muirSirynPlaywrightSetEnv(apart.env);

  return () => {
    muirSirynPlaywrightSetEnv(previousEnv);
  };
}

export function muirSirynPlaywrightMoveWebServers(
  playwright: MuirSirynPlaywrightConfigHandles,
  moves: readonly MuirSirynPlaywrightServerMove[],
  baseURL: string | undefined,
): void {
  const overrides = playwright.cliOverrides();
  moves.forEach(({ index, from, to }) => {
    muirSirynPlaywrightMoveWebServerOptions(
      playwright.webServerOptions(index),
      from,
      to,
    );
  });

  if (baseURL !== undefined) {
    const use = overrides['use'];
    overrides['use'] = {
      ...(muirSirynPlaywrightIsRecord(use) ? use : {}),
      baseURL,
    };
  }
}

export function muirSirynPlaywrightMoveWebServerOptions(
  options: Record<string, unknown>,
  from: number,
  to: number,
): void {
  const { url, env, command } = options;

  if (typeof url === 'string') {
    options['url'] = withPort(url, to);
  }

  if (muirSirynPlaywrightIsRecord(env)) {
    options['env'] = Object.fromEntries(
      Object.entries(env).map(([name, value]) => [
        name,
        value === from || value === String(from) ? String(to) : value,
      ]),
    );
  }

  if (typeof command === 'string') {
    options['command'] = command.replaceAll(
      new RegExp(`\\b${from}\\b`, 'g'),
      String(to),
    );
  }
}

// ponytail: another process may take the port before the webServer binds it; Playwright then reports the bind error.
export function muirSirynPlaywrightFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address !== null) {
          resolve(address.port);
        } else {
          reject(new Error(`Port 0 bound to ${String(address)}.`));
        }
      });
    });
  });
}

export function muirSirynPlaywrightStartsMoreRunners(
  options: {
    readonly concurrency?: number | string | undefined;
    readonly checkers?: readonly string[] | undefined;
  },
  parallelism: number,
): boolean {
  return (
    (options.checkers?.length ?? 0) > 0 ||
    concurrencyOf(options.concurrency, parallelism) > 1
  );
}

function concurrencyOf(
  option: number | string | undefined,
  parallelism: number,
): number {
  // Stryker's options schema admits only whole percentages from 0% to 100% as a string.
  if (typeof option === 'string') {
    return Math.round((parallelism * Number.parseInt(option, 10)) / 100);
  }

  if (typeof option === 'number') {
    return option;
  }

  // ponytail: Stryker's default takes one less above 4 cores, which is above 1 all the same.
  return parallelism;
}
