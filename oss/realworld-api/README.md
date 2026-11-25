# RealWorld API double

An in-memory RealWorld ("Conduit") backend with no dependencies, for the Playwright suite of the Angular/Nx
RealWorld app. Mutation runs use it instead of the third-party Heroku API. Node runs the TypeScript directly, by
type stripping, so the file uses erasable syntax only. `ENDPOINTS.md` lists what is implemented and who calls it.

The server needs Node 24.2 or later. It starts only when `import.meta.main` is true. Older Node versions do not set
it, so there `node server.ts` exits at once without listening.

## Run

From the root of this repo:

```sh
node oss/realworld-api/server.ts
```

| Variable     | Default | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`       | `3100`  | Listen port. API base is `http://localhost:<PORT>/api`.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `STATE_FILE` | unset   | Path to a JSON file. When set, the server loads the state and the token secret from it on start, or the seed data when the file does not exist. After every successful request other than GET it writes the whole state to a temp file in the same folder and renames that over the file. Users, tokens, articles, comments, favorites and follows survive a restart. Delete the file to reset. When unset, the state lives in memory only and resets on every start. |
| `DEBUG`      | unset   | Log one line per request.                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Check: `node --test oss/realworld-api/server.test.ts`

Use `localhost`, not `127.0.0.1`, everywhere. Auth is a `jwt` cookie, since the app sends no `Authorization`
header, and the app and `localhost:3100` share the cookie only when both use the same host name.

The double listens on loopback only. It answers only requests whose `Host` is a loopback name, and refuses any
request whose `Origin` is not an `http://` origin on a loopback name. It grants CORS with credentials only to those
origins. The state file holds the token secret and the seeded passwords. On POSIX the server writes it with
mode 0600. Windows ignores the mode, and the folder's ACL decides who can read the file. This repo's
`.gitignore` lists `oss/realworld-api/state.json`.

## Use it from a disposable copy of the app

Run `node oss/realworld/prepare.ts <copy>`. The script makes every change the copy needs and writes its Stryker config.
`oss/README.md` describes the whole procedure. Do not apply these changes to the original clone.

The script points the app and the request functions in the e2e `helpers` folder at this double. It adds the
double as the first `webServer`, started with `node server.ts` from this folder. It sets `STATE_FILE` to
`.stryker-api-state.json` in the copy and adds that file to the copy's `.gitignore`. With `STATE_FILE` set, the
user that the `setup` project registers stays valid, with its cookie, when the API process restarts.
