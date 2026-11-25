# msw mutators

Mutators that change the responses msw request handlers send, so that a surviving mutant shows a mocked response that
no test outcome depends on. They work in any test code that defines msw handlers, whatever the test runner, and are
not tied to Storybook. Install, tier and built-in mutator terms belong to the Mutator install context.

## Language

**MuirProteusMsw mutator**:
One of this package's mutators, named `MuirProteusMsw` plus what it changes, such as `MuirProteusMswResponse`.
_Avoid_: msw operator, MswResponse mutator

### Responses

**Handler callback**:
A function written as an argument of `http.<method>(...)` or `graphql.<operation>(...)`, where `http` or `graphql` is
imported from `msw`. A function declared elsewhere and passed by name is none.
_Avoid_: resolver (msw's word for any such function, wherever it is declared), handler (msw's word for the whole
`http.get(...)` call)

**Response site**:
A response built lexically inside a handler callback: an `HttpResponse` factory call (`json`, `text`, `xml`, `html`,
`arrayBuffer`, `formData`) through msw's `HttpResponse` or a name destructured from it, `new HttpResponse(...)`, or
`new Response(...)` of the global `Response`. `passthrough()` and `bypass()` build none.
_Avoid_: mocked response, response call

**Body mutant**:
A response site with its body emptied to the empty value of its kind (`{}`, `[]`, `''`, else `null`) and its init
kept. A site without a body, or with an empty one, gets none.
_Avoid_: empty-body mutant

**Outcome mutant**:
A response site replaced by a network error: `HttpResponse.error()`, or `Response.error()` for a `new Response(...)`.
_Avoid_: error mutant
