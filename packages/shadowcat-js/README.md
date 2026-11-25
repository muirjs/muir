<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/shadowcat-js

A StrykerJS ignorer for console output in any JavaScript or TypeScript code. Console output does not reach the DOM or
a test's assertions, so the mutants in a `console.log` call's arguments survive. The opt-in
`muir-shadowcat-js-console` ignorer reports them as Ignored, with a reason. Ignored mutants stay in the report and are
left out of the score.

The package also exports the call matcher and the option reader that `@muirjs/shadowcat-telemetry` and
`@muirjs/shadowcat-react` build on.

The package is private and not on npm yet.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1.
- Node.js 22 or later.

It does not need a particular test runner.

## What it hides

The ignorer hides every mutant of a statement that is just a call to one of the listed `console` methods. Reason:
"muir-shadowcat-js-console: console output; DOM tests do not observe it".

By default it hides `console.log`, `console.debug`, `console.info`, and `console.trace`. It keeps the
mutants of `console.warn` and `console.error` unless you list them.

The statement can be an optional call, such as `console.log?.(message)`, whose `?.` mutant is hidden with the
statement, and can sit under `await` or `void`. The ignorer keeps the mutants of:

- a console call whose result the code uses, such as `ok || console.log(message)`;
- a computed callee, such as `console['log'](message)`;
- a call whose argument can act on the page: a function, a call, a dynamic `import()`, `new`, a tagged template, a
  decorator, an assignment, an update, `await`, `yield`, `delete`, `throw`, and in JavaScript files a pipeline
  (`|>`). So `console.log(count++)` and `console.log(queue.shift())` keep their mutants.

## Turn it on

List the package in `appendPlugins` or `plugins`, then the ignorer. Set `muirShadowcatJsConsole.methods` to choose the
methods. Your list replaces the default list:

```ts
appendPlugins: ['@muirjs/shadowcat-js'],
ignorers: ['muir-shadowcat-js-console'],
muirShadowcatJsConsole: {
  methods: ['log', 'debug', 'info', 'trace', 'warn'],
},
```

`appendPlugins` keeps the plugins Stryker loads by default; `plugins` replaces them, so a checker such as
`@stryker-mutator/typescript-checker` then loads only when the list names it.

`methods` takes the names of the `console` methods: `assert`, `clear`, `count`, `countReset`, `debug`,
`dir`, `dirxml`, `error`, `group`, `groupCollapsed`, `groupEnd`, `info`, `log`, `table`, `time`,
`timeEnd`, `timeLog`, `trace`, and `warn`. Stryker checks it against the schema the package exports, and the
ignorer throws when it is created with any other value, such as the typo `lgo`.

## When to leave it out

Leave `muir-shadowcat-js-console` out when your tests check console output, for example with Playwright's
`page.on('console')` or a spy on `console` in a unit test.

## Exports

- `strykerPlugins`: the `muir-shadowcat-js-console` ignorer.
- `strykerValidationSchema`: the schema of `muirShadowcatJsConsole`.
- `muirShadowcatJsHideableCallee`: takes a Babel statement node and returns the callee's dotted name when the
  statement is just a call whose arguments cannot act on the page, else `undefined`.
- `muirShadowcatJsListOption`: reads a list option of an ignorer, and throws with the package's name when it is not
  a list of the expected items.
- `muirShadowcatJsTypeOf`: returns the `type` field of a Babel node, read without trusting the value's shape.

## License

MIT
