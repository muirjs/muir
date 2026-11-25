export interface Case {
  readonly id: string;
  readonly title: string;
  /** A module that defines msw handlers. */
  readonly source: string;
  /** The mutants this package's mutators make: [mutator name, replacement]. */
  readonly expect: readonly (readonly [string, string])[];
}

const response = 'MuirProteusMswResponse';

export const cases: readonly Case[] = [
  {
    id: 'no-body',
    title: 'a response with no body only becomes a network error',
    source: inHandler('return HttpResponse.json();'),
    expect: [[response, 'HttpResponse.error()']],
  },
  {
    id: 'object-body',
    title: 'an object body is emptied to {}, keeping the init',
    source: inHandler('return HttpResponse.json({ a: 1 }, { status: 201 });'),
    expect: [
      [response, 'HttpResponse.json({}, { status: 201 })'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'array-body',
    title: 'an array body is emptied to []',
    source: inHandler('return HttpResponse.json([1]);'),
    expect: [
      [response, 'HttpResponse.json([])'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'string-body',
    title: "a string body is emptied to ''",
    source: inHandler("return HttpResponse.json('a');"),
    expect: [
      [response, 'HttpResponse.json("")'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'template-body',
    title: "a template literal body is a string body, emptied to ''",
    source: inHandler('return HttpResponse.text(`Hello ${name}`);'),
    expect: [
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'other-body',
    title: 'any other body becomes null',
    source: inHandler('return HttpResponse.json(user.emails);'),
    expect: [
      [response, 'HttpResponse.json(null)'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'empty-object-body',
    title: 'an empty object body gets no body mutant',
    source: inHandler('return HttpResponse.json({});'),
    expect: [[response, 'HttpResponse.error()']],
  },
  {
    id: 'empty-array-body',
    title: 'an empty array body gets no body mutant',
    source: inHandler('return HttpResponse.json([]);'),
    expect: [[response, 'HttpResponse.error()']],
  },
  {
    id: 'empty-string-body',
    title: 'an empty string body gets no body mutant',
    source: inHandler("return HttpResponse.json('');"),
    expect: [[response, 'HttpResponse.error()']],
  },
  {
    id: 'null-body',
    title: 'a null body gets no body mutant',
    source: inHandler('return HttpResponse.json(null, { status: 201 });'),
    expect: [[response, 'HttpResponse.error()']],
  },
  {
    id: 'text-factory',
    title: 'a text response is a site as a json one is',
    source: inHandler("return HttpResponse.text('a');"),
    expect: [
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'other-factories',
    title: 'xml, html, arrayBuffer and formData responses are sites',
    source: inHandler(
      "if (a) return HttpResponse.xml('<a/>');",
      "if (b) return HttpResponse.html('<p>a</p>');",
      'if (c) return HttpResponse.arrayBuffer(buffer);',
      'return HttpResponse.formData(form);',
    ),
    expect: [
      [response, 'HttpResponse.xml("")'],
      [response, 'HttpResponse.html("")'],
      [response, 'HttpResponse.arrayBuffer(null)'],
      [response, 'HttpResponse.formData(null)'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'not-a-factory',
    title:
      'an HttpResponse method that is not one of the six factories is no site',
    source: inHandler(
      "if (a) return HttpResponse.redirect('/b');",
      'return HttpResponse.error();',
    ),
    expect: [],
  },
  {
    id: 'local-http-response',
    title: 'an HttpResponse that is not imported from msw is no site',
    source:
      "import { http } from 'msw';\n" +
      "import { HttpResponse } from './responses';\n" +
      "export const handlers = [http.get('/a', () => HttpResponse.json({ a: 1 }))];\n",
    expect: [],
  },
  {
    id: 'renamed-import',
    title:
      'HttpResponse imported under another name makes the error with that name',
    source:
      "import { http, HttpResponse as Reply } from 'msw';\n" +
      "export const handlers = [http.get('/a', () => Reply.json({ a: 1 }))];\n",
    expect: [
      [response, 'Reply.json({})'],
      [response, 'Reply.error()'],
    ],
  },
  {
    id: 'outside-handler',
    title: 'a response built outside a handler callback is no site',
    source:
      "import { HttpResponse } from 'msw';\n" +
      'export function notFound() {\n' +
      "  return HttpResponse.text('Not Found', { status: 404 });\n" +
      '}\n',
    expect: [],
  },
  {
    id: 'local-http',
    title:
      'a callback of an http that is not imported from msw is no handler callback',
    source:
      "import { HttpResponse } from 'msw';\n" +
      "import { http } from './router';\n" +
      "export const routes = [http.get('/a', () => HttpResponse.json({ a: 1 }))];\n",
    expect: [],
  },
  {
    id: 'graphql-handler',
    title: 'a response in a graphql.query callback is a site',
    source:
      "import { graphql, HttpResponse } from 'msw';\n" +
      "export const handlers = [graphql.query('User', () => HttpResponse.json({ data: { a: 1 } }))];\n",
    expect: [
      [response, 'HttpResponse.json({})'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'new-http-response',
    title: 'new HttpResponse(body, init) is a site',
    source: inHandler(
      "return new HttpResponse('Unauthorized', { status: 401 });",
    ),
    expect: [
      [response, 'new HttpResponse("", { status: 401 })'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'destructured-factory',
    title:
      'a factory destructured from HttpResponse is a site, and the error comes from HttpResponse',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      'const { json } = HttpResponse;\n' +
      "export const handlers = [http.get('/a', () => json({ a: 1 }))];\n",
    expect: [
      [response, 'json({})'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'local-json',
    title:
      'a local json that is not destructured from HttpResponse is no factory, though one is in the file',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      'const { json } = HttpResponse;\n' +
      "export const handlers = [http.get('/a', async () => {\n" +
      '  const json = await readJson();\n' +
      '  return json(1);\n' +
      '})];\n',
    expect: [],
  },
  {
    id: 'destructured-other-key',
    title:
      'a destructured HttpResponse member that is not a factory is no site',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      'const { redirect } = HttpResponse;\n' +
      "export const handlers = [http.get('/a', () => redirect('/b'))];\n",
    expect: [],
  },
  {
    id: 'new-response',
    title:
      'new Response(body, init) of the global Response is a site, and its error comes from Response',
    source: inHandler("return new Response('Not Found', { status: 404 });"),
    expect: [
      [response, 'new Response("", { status: 404 })'],
      [response, 'Response.error()'],
    ],
  },
  {
    id: 'local-response',
    title: 'new Response of a local Response binding is no site',
    source:
      "import { http } from 'msw';\n" +
      "import { Response } from './fake-fetch';\n" +
      "export const handlers = [http.get('/a', () => new Response('a'))];\n",
    expect: [],
  },
  {
    id: 'passthrough-bypass',
    title: 'passthrough() and bypass() are no responses',
    source:
      "import { http, passthrough, bypass } from 'msw';\n" +
      'export const handlers = [\n' +
      "  http.get('/a', () => passthrough()),\n" +
      "  http.get('/b', ({ request }) => fetch(bypass(request))),\n" +
      '];\n',
    expect: [],
  },
  {
    id: 'nested-function',
    title:
      'a response in a function nested in a handler callback is lexically inside it, so a site',
    source: inHandler(
      'return load().then((items) => HttpResponse.json(items));',
    ),
    expect: [
      [response, 'HttpResponse.json(null)'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'named-resolver',
    title:
      'a response in a resolver declared apart and passed by name is not lexically in a handler callback',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      'const resolver = () => HttpResponse.json({ a: 1 });\n' +
      "export const handlers = [http.get('/a', resolver)];\n",
    expect: [],
  },
  {
    id: 'other-http-methods',
    title:
      'a response in an all, post, put, patch, delete, head or options callback is a site',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      'export const handlers = [\n' +
      "  http.all('/a', () => HttpResponse.text('g')),\n" +
      "  http.post('/a', () => HttpResponse.text('a')),\n" +
      "  http.put('/a', () => HttpResponse.text('b')),\n" +
      "  http.patch('/a', () => HttpResponse.text('c')),\n" +
      "  http.delete('/a', () => HttpResponse.text('d')),\n" +
      "  http.head('/a', () => HttpResponse.text('e')),\n" +
      "  http.options('/a', () => HttpResponse.text('f')),\n" +
      '];\n',
    expect: [
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.text("")'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'other-graphql-operations',
    title:
      'a response in a graphql.mutation or graphql.operation callback is a site',
    source:
      "import { graphql, HttpResponse } from 'msw';\n" +
      'export const handlers = [\n' +
      "  graphql.mutation('Save', () => HttpResponse.json({ data: { a: 1 } })),\n" +
      '  graphql.operation(() => HttpResponse.json({ data: { b: 1 } })),\n' +
      '];\n',
    expect: [
      [response, 'HttpResponse.json({})'],
      [response, 'HttpResponse.json({})'],
      [response, 'HttpResponse.error()'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'computed-factory',
    title:
      'a computed HttpResponse member is no site, though the key is a variable named after a factory',
    source: inHandler(
      "const json = 'redirect';",
      'return HttpResponse[json]({ a: 1 });',
    ),
    expect: [],
  },
  {
    id: 'new-other-global',
    title: 'new of a global class that is not Response is no site',
    source: inHandler("return new Blob(['a']);"),
    expect: [],
  },
  {
    id: 'destructured-beside-other-key',
    title:
      'of a factory and a member that is no factory destructured together, only the factory is a site',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      'const { json, redirect } = HttpResponse;\n' +
      'export const handlers = [\n' +
      "  http.get('/a', () => json({ a: 1 })),\n" +
      "  http.get('/b', () => redirect('/c')),\n" +
      '];\n',
    expect: [
      [response, 'json({})'],
      [response, 'HttpResponse.error()'],
    ],
  },
  {
    id: 'constructed-handler',
    title:
      'a callback passed to new http.get(...) is no handler callback, as msw calls its handler functions',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      "export const handlers = [new http.get('/a', () => HttpResponse.json({ a: 1 }))];\n",
    expect: [],
  },
  {
    id: 'computed-handler-method',
    title:
      'a callback of a computed http member is no handler callback, though the key is a variable named after a method',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      "const get = 'listen';\n" +
      "export const handlers = [http[get]('/a', () => HttpResponse.json({ a: 1 }))];\n",
    expect: [],
  },
  {
    id: 'other-http-member',
    title:
      'a callback of an http member that is no handler method is no handler callback',
    source:
      "import { http, HttpResponse } from 'msw';\n" +
      "export const handlers = [http.listen('/a', () => HttpResponse.json({ a: 1 }))];\n",
    expect: [],
  },
  {
    id: 'other-msw-import',
    title:
      'another msw export imported under the name HttpResponse is no HttpResponse',
    source:
      "import { http, bypass as HttpResponse } from 'msw';\n" +
      "export const handlers = [http.get('/a', () => HttpResponse.json({ a: 1 }))];\n",
    expect: [],
  },
];

function inHandler(...statements: readonly string[]): string {
  return (
    "import { http, HttpResponse } from 'msw';\n" +
    `export const handlers = [\n  http.get('/a', () => {\n    ${statements.join('\n    ')}\n  }),\n];\n`
  );
}
