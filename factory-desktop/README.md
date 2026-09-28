# Factory Desktop App (Electron)

A Windows desktop version of the factory system. It runs its own copy of the
API on this machine against a local PostgreSQL database, and loads the same
client the website uses from `http://127.0.0.1:<PORT>`, so it looks and behaves
like the website.

## Requirements

- PostgreSQL running on the machine, with the factory database (default `factory_db`).

## Settings

On first launch the app creates a settings file:

```
%APPDATA%\Factory Desktop\config.env
```

Set `DB_PASSWORD` (and change `DB_NAME`, `DB_USER`, `PORT` if needed), then
restart the app. A random `JWT_SECRET` is generated for you. No secrets are
bundled in the installer.

Other per-user folders next to it:

- `uploads\` — uploaded files (payment evidence, HR documents, QC photos)
- `logs\backend.log` — API log; the app points you here if the server fails to start

If the app can't start the API, it shows a message with buttons to open the
settings file and the log.

## Development

```
cd factory-client && npm run build
cd ../factory-desktop && npm start
```

In development the API reads `factory-api/.env` and keeps uploads in
`factory-api/uploads`.

## Building the installer

```
cd factory-desktop
npm run dist
```

This builds the client, stages only the API's runtime files (`src`,
`migrations`, production dependencies pinned to the versions installed in the
repo) into `.stage/`, and produces `dist\Factory Desktop Setup <version>.exe`.
The staging step refuses to package `.env` files, dumps or spreadsheets.
