<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/shadowcat-telemetry

A StrykerJS ignorer for analytics and error-monitoring calls. Those calls send data that a DOM test does not see, so
the mutants in their arguments survive. The opt-in `muir-shadowcat-telemetry` ignorer reports them as Ignored, with a
reason. Ignored mutants stay in the report and are left out of the score.

The package is private and not on npm yet.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1.
- Node.js 22.18 or a later 22.x, 24.11 or a later 24.x, or 26.13 or a later 26.x.

It does not need a particular test runner, and it does not need the analytics or Sentry packages installed: it matches
callees by name.

## What it hides

It hides every mutant of a statement that is nothing but a call to one of these callees:

- Analytics: `gtag`, `window.gtag`, `fbq`, `ttq.track`, `dataLayer.push`, `window.dataLayer.push`,
  `analytics.track`, `analytics.page`, `analytics.identify`, `analytics.group`, `analytics.alias`,
  `analytics.screen`, `posthog.capture`, `posthog.identify`, `posthog.group`, `posthog.alias`,
  `posthog.register`, `posthog.reset`, `mixpanel.track`, `mixpanel.identify`, `mixpanel.register`,
  `mixpanel.people.set`, `plausible`, `window.plausible`, `umami.track`, `amplitude.track`,
  `amplitude.logEvent`, and `amplitude.identify`. Reason: "muir-shadowcat-telemetry: analytics call; DOM tests do not
  observe what it sends".
- Error monitoring: `Sentry.captureException`, `Sentry.captureMessage`, `Sentry.addBreadcrumb`,
  `Sentry.setUser`, `Sentry.setTag`, `Sentry.setTags`, `Sentry.setContext`, `Sentry.setExtra`, and
  `Sentry.flush`. A bare `captureException` or `captureMessage` counts when the name, where it is called,
  refers to an import under that name from a `@sentry/` package; a parameter or local of the same name does
  not count. Reason: "muir-shadowcat-telemetry: error-monitoring call; DOM tests do not observe what it reports".

The ignorer matches a callee by its name only, so an app's own object named `analytics` or `posthog` counts
too.

The statement can be an optional call, such as `window.gtag?.('event', name)`, and can sit under `await` or
`void`, such as `await Sentry.flush(2000)`. An optional call's own mutant, the one that removes the `?.`, is
hidden with the rest of the statement, though a test that runs without the library loaded could kill it. The
same holds for a `?.` inside an argument, such as `user?.id` in `analytics.track('Bought', { id: user?.id })`:
its mutant throws when `user` is undefined, but the ignorer hides it with the statement.

The ignorer keeps the mutants in every other case:

- An argument holds code that can act on the page: a function (arrow, function expression, object or class
  method), a call, a dynamic `import()`, `new`, a tagged template, a decorator, an assignment, an update such
  as `count++`, `await`, `yield`, `delete`, `throw`, and in JavaScript files a pipeline (`|>`). For example,
  the callback in `analytics.track('Clicked', {}, {}, () => navigate('/done'))` or the `eventCallback` in
  `dataLayer.push({ event: 'buy', eventCallback: () => setDone(true) })` runs in the page, and a DOM test can
  see what it does.
- The call is not a statement of its own, such as the body of `onClick={() => gtag('event', 'buy')}`.
- The code uses the call's result, such as `const id = analytics.track('signup')` or `return gtag(...)`.
- The callee is computed, such as `analytics['track'](...)`, or longer than the listed name, such as
  `lib.analytics.track(...)`.
- The callee is `Sentry.init`. Its options, such as `beforeSend`, decide what the app reports, and a unit
  test can check them.

## Turn it on

List the package in `appendPlugins` or `plugins`, then the ignorer. Add your project's own callees with
`muirShadowcatTelemetry.calls`. They add to the lists above. Reason: "muir-shadowcat-telemetry: telemetry call from
muirShadowcatTelemetry.calls; DOM tests do not observe what it sends". When `calls` repeats a built-in callee, such as
`gtag`, the statement keeps the built-in reason.

```ts
appendPlugins: ['@muirjs/shadowcat-telemetry'],
ignorers: ['muir-shadowcat-telemetry'],
muirShadowcatTelemetry: {
  calls: ['track', 'telemetry.send'],
},
```

`appendPlugins` keeps the plugins Stryker loads by default; `plugins` replaces them, so a checker such as
`@stryker-mutator/typescript-checker` then loads only when the list names it.

Each entry in `calls` must be an identifier or a dotted chain of identifiers, such as `track` or
`analytics.track`. Stryker checks it against the schema the package exports, and the ignorer throws when it
is created with any other value.

## When to leave it out

Leave `muir-shadowcat-telemetry` out when your tests check what the app sends, for example by intercepting the
analytics request with `page.route`.

## License

MIT
