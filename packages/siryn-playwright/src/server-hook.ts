import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import diagnosticsChannel from 'node:diagnostics_channel';
import fs from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import path from 'node:path';

import {
  muirSirynPlaywrightFieldOf,
  muirSirynPlaywrightIsRecord,
} from './is-record.ts';
import {
  muirSirynPlaywrightGlobalNamespace,
  muirSirynPlaywrightMarkInstrumentedReads,
} from './namespace.ts';
import {
  muirSirynPlaywrightReadHookTestNamespace,
  muirSirynPlaywrightSnapshotSuffix,
} from './protocol.ts';
import {
  muirSirynPlaywrightHookedPrefix,
  muirSirynPlaywrightHostKey,
  muirSirynPlaywrightServerDirEnv,
  muirSirynPlaywrightServerSnapshotPrefix,
  muirSirynPlaywrightTestIdHeader,
  muirSirynPlaywrightUntaggedKey,
} from './server-protocol.ts';
import { muirSirynPlaywrightRunSwitch } from './server-run-switch.ts';

interface RequestTag {
  readonly testId: string | undefined;
  readonly arrivedAt: number;
}

const serverDir = process.env[muirSirynPlaywrightServerDirEnv];
// `Symbol.for`, so a second copy of this package in the process leaves the server to the first.
const installed: unique symbol = Symbol.for(
  '@muirjs/siryn-playwright/server-hook',
);

if (serverDir !== undefined && !(installed in globalThis)) {
  Reflect.set(globalThis, installed, installed);
  muirSirynPlaywrightInstallServerHook(
    serverDir,
    muirSirynPlaywrightReadHookTestNamespace(process.env),
  );
}

/**
 * Switches the active mutant per request from the control file the runner writes before each run, and
 * writes the coverage of each request to that run's folder before its response ends.
 */
export function muirSirynPlaywrightInstallServerHook(
  dir: string,
  ns: string,
  now: () => number = Date.now,
): void {
  const namespace = muirSirynPlaywrightGlobalNamespace(ns);
  muirSirynPlaywrightMarkInstrumentedReads(namespace);
  const requests = new AsyncLocalStorage<RequestTag>();
  const run = muirSirynPlaywrightRunSwitch(
    dir,
    namespace,
    `${muirSirynPlaywrightServerSnapshotPrefix}${process.pid}-${randomUUID()}${muirSirynPlaywrightSnapshotSuffix}`,
  );
  let marked = false;
  let moduleScopeRunning = false;

  // The instrumenter's preamble reads this global once per module, as the module starts to run
  // (`instrumentationBabelHeader` in @stryker-mutator/instrumenter's src/util/syntax-helpers.ts, 10.1.1), so the
  // hits until the next microtask are module scope and count as static. The preamble never assigns it once it
  // exists; the setter drops other assignments so they neither throw nor remove the getter.
  Object.defineProperty(globalThis, ns, {
    get: () => {
      if (!moduleScopeRunning) {
        moduleScopeRunning = true;
        queueMicrotask(() => {
          moduleScopeRunning = false;
        });
      }

      return namespace;
    },
    set: () => undefined,
  });

  Object.defineProperty(namespace, 'currentTestId', {
    get: () => {
      const tag = requests.getStore();

      if (moduleScopeRunning || !run.control()?.perTest || tag === undefined) {
        return undefined;
      }

      return tag.testId ?? muirSirynPlaywrightUntaggedKey(tag.arrivedAt);
    },
  });

  function markHooked() {
    if (marked) {
      return;
    }

    marked = true;
    const file = path.join(
      dir,
      `${muirSirynPlaywrightHookedPrefix}${process.pid}`,
    );
    // Stryker disable next-line StringLiteral: the runner reads only the names of the hooked files
    fs.writeFileSync(file, '');
  }

  [
    http.Server.prototype,
    https.Server.prototype,
    Reflect.getPrototypeOf(http2.createServer()),
    Reflect.getPrototypeOf(http2.createSecureServer()),
  ]
    .filter((prototype) => prototype !== null)
    .forEach((prototype) => {
      const emit: unknown = Reflect.get(prototype, 'emit');

      if (typeof emit !== 'function') {
        return;
      }

      Object.defineProperty(prototype, 'emit', {
        configurable: true,
        writable: true,
        value: function emitWithStryker(
          this: unknown,
          event: unknown,
          ...args: unknown[]
        ): unknown {
          const [request, response] = args;
          const original = (): unknown =>
            Reflect.apply(emit, this, [event, ...args]);

          if (event === 'listening') {
            markHooked();
          }

          if (
            !(
              (request instanceof http.IncomingMessage &&
                response instanceof http.ServerResponse) ||
              (request instanceof http2.Http2ServerRequest &&
                response instanceof http2.Http2ServerResponse)
            )
          ) {
            return original();
          }

          run.startRequest();
          flushBeforeEnd(response, run.flush);
          const header = request.headers[muirSirynPlaywrightTestIdHeader];

          return requests.run(
            {
              testId:
                typeof header === 'string' && run.isIssued(header)
                  ? header
                  : undefined,
              arrivedAt: now(),
            },
            original,
          );
        },
      });
    });

  function testIdFor(target: URL): string | undefined {
    const testId = requests.getStore()?.testId;

    return run
      .control()
      ?.testIdHosts?.includes(muirSirynPlaywrightHostKey(target))
      ? testId
      : undefined;
  }

  // Each hop of a fetch, redirects included, creates its own undici request with its own origin.
  diagnosticsChannel.subscribe('undici:request:create', (message) => {
    const request = muirSirynPlaywrightIsRecord(message)
      ? message['request']
      : undefined;

    if (!muirSirynPlaywrightIsRecord(request)) {
      return;
    }

    const { origin, headers, addHeader } = request;
    const testId =
      typeof origin === 'string' ? testIdFor(new URL(origin)) : undefined;

    if (
      typeof addHeader === 'function' &&
      Array.isArray(headers) &&
      !hasUndiciHeader(headers, muirSirynPlaywrightTestIdHeader)
    ) {
      Reflect.apply(addHeader, request, [
        muirSirynPlaywrightTestIdHeader,
        testId,
      ]);
    }
  });

  // The agent gets the host and port a ClientRequest connects to; the request itself keeps no port, and its
  // Host header is the caller's to set.
  const addRequest: unknown = Reflect.get(http.Agent.prototype, 'addRequest');

  if (typeof addRequest === 'function') {
    Object.defineProperty(http.Agent.prototype, 'addRequest', {
      configurable: true,
      writable: true,
      value: function addRequestWithStryker(
        this: unknown,
        request: unknown,
        options: unknown,
        ...rest: unknown[]
      ): unknown {
        const target = agentTarget(options);
        const testId = target === undefined ? undefined : testIdFor(target);

        if (
          testId !== undefined &&
          request instanceof http.ClientRequest &&
          !request.headersSent &&
          !request.hasHeader(muirSirynPlaywrightTestIdHeader)
        ) {
          request.setHeader(muirSirynPlaywrightTestIdHeader, testId);
        }

        return Reflect.apply(addRequest, this, [request, options, ...rest]);
      },
    });
  }

  process.on('exit', run.flush);
}

function agentTarget(options: unknown): URL | undefined {
  const host = muirSirynPlaywrightFieldOf(options, 'host');

  if (typeof host !== 'string') {
    return undefined;
  }

  const port = String(muirSirynPlaywrightFieldOf(options, 'port'));
  const url = `http://${host.includes(':') ? `[${host}]` : host}:${port}`;

  return URL.canParse(url) ? new URL(url) : undefined;
}

/** undici keeps a request's headers as [name, value, name, value, ...]. */
function hasUndiciHeader(headers: readonly unknown[], name: string): boolean {
  return headers.some(
    (entry, index) =>
      index % 2 === 0 &&
      typeof entry === 'string' &&
      entry.toLowerCase() === name,
  );
}

// Before end, not on 'finish': the client may have the response, and the runner may read the run's folder,
// before 'finish' fires.
function flushBeforeEnd(
  response: http.ServerResponse | http2.Http2ServerResponse,
  flush: () => void,
) {
  const { end } = response;

  Object.defineProperty(response, 'end', {
    configurable: true,
    writable: true,
    value: (...args: unknown[]): unknown => {
      flush();

      return Reflect.apply(end, response, args);
    },
  });
}
