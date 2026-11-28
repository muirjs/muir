<p align="center">
  <img src="https://raw.githubusercontent.com/muirjs/muir/main/docs/images/muirjs-badge-small.png" alt="Muir logo" width="200">
</p>

# @muirjs/proteus-msw

StrykerJS mutators for the responses that msw request handlers send. A handler is test code: it plays the server
for the code under test. `MuirProteusMswResponse` empties the body of a response that a handler builds, or turns the
response into a network error. When the tests still pass, no test outcome depends on that response. The mutators
work with any test runner and are not tied to Storybook.

The package keeps Stryker's 17 built-in mutators on and adds 1 of its own: 1 runs by default, 0 are opt-in and 0 are
experimental. The package is private and not on npm yet.

## Requirements

- `@stryker-mutator/core` 10.1, tested on 10.1.1. The install patches internals of that version's instrumenter, and
  warns when `@stryker-mutator/instrumenter` is a version other than 10.1.1.
- Handlers written for msw 2 or msw 3 with its `http`, `graphql` and `HttpResponse` exports, imported from `msw`,
  `msw/http` or `msw/graphql`. The mutator reads the handler files as source and imports nothing from msw. It states the range as an optional
  `msw` peer dependency (`^2.0.0 || ^3.0.0`), so an install with another msw version fails.
- Node.js 22.18 or a later 22.x, 24.11 or a later 24.x, or 26.13 or a later 26.x.

## Turn the mutators on

List the files that hold your handlers in the `mutate` of a Stryker configuration for test code. Call
`muirProteusMswMutators` at the top of the Stryker configuration file and await it:

```ts
// stryker.test-code.config.mjs
import { muirProteusMswMutators } from '@muirjs/proteus-msw';

await muirProteusMswMutators();

export default {
  testRunner: 'vitest',
  mutate: ['src/mocks/**/*.ts'],
  reporters: ['clear-text', 'html'],
};
```

Await the call, so that an error in the install stops the run. The configuration file must be a JavaScript or
TypeScript ES module, because a JSON configuration cannot import a module.

The call prints one line:

```text
@muirjs/proteus-msw: 1 MuirProteusMsw mutators on, beside Stryker's built-in mutators.
```

The call checks that each mutator it installs makes a mutant of a sample, and stops the run when one does not. It
names the instrumenter's folder and version when an internal it patches is missing. A second call replaces the
mutators of the first.

The package has no opt-in or experimental mutators, so the call takes no options. It throws on any argument other
than `undefined` or an object whose every value is `undefined`, such as `{}`:

```text
@muirjs/proteus-msw: the package has no opt-in or experimental mutators yet, so muirProteusMswMutators() takes no options. Turn a mutator off with mutator.excludedMutations.
```

### Handlers next to Storybook or Playwright test code

`muirProteusStorybookTestMutators()` and `muirProteusPlaywrightMutators()` turn Stryker's built-in mutators off for
every file in the run. In a configuration that installs either of them, the handlers get the `MuirProteusMswResponse`
mutants and no built-in mutants. Mutate the handlers in a configuration of their own to keep the built-ins.

Handlers in a story's `parameters.msw` are story test code. With `@muirjs/shadowcat-storybook`, the CSF ignorer
reports their mutants as Ignored unless its play mode is `mutate`, so mutate them in the Storybook test-code
configuration.
The ignorer hides only the value of `parameters.msw`. A handler that the story file declares elsewhere and
`parameters.msw` names still gets mutants in the components configuration.

## The mutators

Each mutator's name is the mutator name in Stryker's reports.

### Default mutators

These run on `await muirProteusMswMutators()`.

| Mutator                  | What it changes                                                                                                            | Example                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `MuirProteusMswResponse` | In a handler callback, empties the body of a response and, in a second mutant, replaces the response with a network error. | `HttpResponse.json({ items: [1] })` becomes `HttpResponse.json({})` in one mutant and `HttpResponse.error()` in another. |

### Opt-in mutators

None.

### Experimental mutators

None.

## What MuirProteusMswResponse mutates

A handler callback is a function written as an argument of `http.<method>(...)` (`all`, `get`, `post`, `put`,
`patch`, `delete`, `head` or `options`) or `graphql.<operation>(...)` (`query`, `mutation` or `operation`), where
`http` or `graphql` is imported from `msw`. A response inside it is one of these:

- `HttpResponse.json(...)`, `text`, `xml`, `html`, `arrayBuffer` or `formData`, with `HttpResponse` imported from
  `msw`.
- One of those six factories through a name destructured from `HttpResponse`, as in
  `const { json } = HttpResponse`.
- `new HttpResponse(...)`.
- `new Response(...)` of the global `Response`.

Each response gets two mutants:

- The body mutant empties the first argument by its kind: `{}`, `[]`, `''`, or else `null`. It keeps the second
  argument, such as `{ status: 201 }`. A response with no body, or an empty one, gets no body mutant.
- The outcome mutant replaces the response with `HttpResponse.error()`, or with `Response.error()` for a
  `new Response(...)`, so the request fails as on a network error.

`passthrough()` and `bypass()` build no response and get no mutant.

## Stryker's built-in mutators stay on

A handler behaves like app code for the code under test: it decides what the server answers. An analysis of 130
built-in mutants sampled from one open-source repository's msw handlers and other test doubles turned no built-in
off. It kept nine of them and left the rest undecided, most for lack of test outcomes. `MuirProteusMswResponse` adds
two changes that no built-in makes: a network error, and a body emptied by its kind instead of every object literal
emptied.

## Turn a mutator off

For the whole run, list the mutator in `mutator.excludedMutations`. The names are case sensitive, and Stryker does
not check them, so a misspelt name excludes nothing and logs nothing. Stryker still reports an excluded mutant, as
Ignored.

For one mutant, put a Stryker disable comment with a reason on the line before the response:

```ts
http.get('https://api.pwnedpasswords.com/range/:prefix', () =>
  // Stryker disable next-line MuirProteusMswResponse: the app treats a failed breach check as no breach
  HttpResponse.text(''),
);
```

For a block, use `// Stryker disable <name>: <reason>` and `// Stryker restore <name>`.

## Survivors to expect and limits

On two open-source repositories, 7 of the 10 `MuirProteusMswResponse` survivors pointed at a test that does not check
what the response changes, such as a test that also passes before any response arrives, or one that cannot tell an error
status from a network error. Read a survivor as a missing check first. These survive without one:

- An outcome mutant survives when the app catches the failed request and the page looks the same. Such a mutant is
  equivalent, not a test gap. Disable it with a comment that says so.
- A body mutant survives on a response whose body the code does not read, such as an error response the code reads
  only the status of.
- Both mutants survive in a handler that exists only to keep an unhandled request from failing the test, when
  nothing reads its response.

What the mutator does not see:

- A handler callback declared elsewhere and passed by name, such as `http.get('/a', getUser)`, gets no mutant.
- A response built outside the handler callback, such as in a function the callback calls, gets no mutant.
- An `http` or `graphql` that is not imported from `msw` makes no handler.

A Storybook project with msw can fail Stryker's dry run in a way that has nothing to do with this package. See the
`import.meta` crash under
[Survivors to expect and limits](../shadowcat-storybook/README.md#survivors-to-expect-and-limits) in the
`@muirjs/shadowcat-storybook` README.

## License

MIT
