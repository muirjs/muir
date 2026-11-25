import type { MuirSirynPlaywrightWebServerOptions } from './muir-siryn-playwright-runner-options-with-stryker-options.ts';

export const muirSirynPlaywrightMutateOption =
  'muirSirynPlaywright.webServer.mutate';

export type MuirSirynPlaywrightServerMutate = Exclude<
  MuirSirynPlaywrightWebServerOptions['mutate'],
  false
>;

function describeRefusal(
  mutate: MuirSirynPlaywrightServerMutate,
  reason: string,
): string {
  return `${muirSirynPlaywrightMutateOption} is ${mutate === 'auto' ? "'auto'" : 'true'}, but ${reason}`;
}

export class MuirSirynPlaywrightServerSupportRefused extends Error {
  constructor(
    mutate: MuirSirynPlaywrightServerMutate,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(describeRefusal(mutate, reason), options);
  }
}
