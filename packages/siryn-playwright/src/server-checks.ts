import net from 'node:net';

import type {
  MuirSirynPlaywrightConfigWebServer,
  MuirSirynPlaywright,
} from './playwright-internals.ts';

export interface MuirSirynPlaywrightServerCheck {
  readonly name: string;
  isUp(): Promise<boolean>;
}

export type MuirSirynPlaywrightServerTarget =
  | { readonly port: number }
  | { readonly url: string };

export function muirSirynPlaywrightServerTarget({
  url,
  port,
}: MuirSirynPlaywrightConfigWebServer):
  | MuirSirynPlaywrightServerTarget
  | undefined {
  if (port !== undefined) {
    return { port };
  }

  return url === undefined ? undefined : { url };
}

export function muirSirynPlaywrightServerCheck(
  server: MuirSirynPlaywrightConfigWebServer,
  isURLAvailable: MuirSirynPlaywright['isURLAvailable'],
): MuirSirynPlaywrightServerCheck | undefined {
  const target = muirSirynPlaywrightServerTarget(server);

  if (target === undefined) {
    return undefined;
  }

  if ('port' in target) {
    const { port } = target;

    return {
      name: server.url ?? `port ${port}`,
      isUp: () => muirSirynPlaywrightAcceptsConnections(port),
    };
  }

  const url = new URL(target.url);

  return {
    name: target.url,
    isUp: () => isURLAvailable(url, server.ignoreHTTPSErrors),
  };
}

// Playwright's own webServer port check tries both loopback addresses: localhost can resolve to only one of them.
const loopbackHosts = ['127.0.0.1', '::1'];

export interface MuirSirynPlaywrightConnectingSocket {
  once(event: 'connect' | 'error' | 'timeout', listener: () => void): unknown;
  destroy(): unknown;
}

export function muirSirynPlaywrightAcceptsConnections(
  port: number,
  connect: (
    options: net.TcpNetConnectOpts,
  ) => MuirSirynPlaywrightConnectingSocket = net.connect,
): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = 0;

    loopbackHosts.forEach((host) => {
      const socket = connect({ host, port, timeout: 5000 });
      const done = (ok: boolean) => {
        socket.destroy();
        answered += 1;

        if (ok || answered === loopbackHosts.length) {
          resolve(ok);
        }
      };
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
      socket.once('timeout', () => done(false));
    });
  });
}
