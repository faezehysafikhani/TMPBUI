# Deployment Configuration — UI

What to set when installing this frontend at a new site (e.g. a bank environment). None of these
steps touch source code, and **none require rebuilding the frontend** — the same `npm run build`
output can be deployed at any host by changing only server-side environment configuration and
restarting.

## Why this doesn't need a rebuild

`npm run build` produces a static `dist/` folder plus `dist/server.cjs`, a small Node/Express
server that serves it. That server exposes `GET /runtime-config.js`, which is generated **fresh
on every request from the server's own process environment** — never baked into the built JS by
Vite. `index.html` loads that script before the app bundle, so the app reads the backend's
address from `window.__RUNTIME_CONFIG__` at page-load time, not from anything decided at build
time. Changing the deployment's backend address is therefore a server restart, not a rebuild.

(There is still a Vite build-time `VITE_API_BASE_URL` fallback for the plain `vite`/`vite
preview` dev workflow, where `server.ts` isn't in play — see `.env.example`. A real deployment
should not rely on it; use the runtime variable below instead.)

## 1. Set the backend's address

Set this environment variable for the Node process that runs `dist/server.cjs` (a `.env` file
next to it, an IIS/iisnode `web.config` `<environmentVariables>` entry, a systemd unit, etc.):

```
API_BASE_URL=https://<bank-host-or-ip>:<backend-port>
```

Leave it empty (or unset) for same-origin: the app then calls whatever host/port served the page
itself — the simplest and most robust setup when a reverse proxy serves the frontend and the API
under one public address. In that case there's nothing to set here at all.

This same value is what the app's SignalR connection uses too (`{API_BASE_URL}/hubs/...`, or a
same-origin relative URL) — there's no separate SignalR address to configure anywhere.

## 2. Set the port this server listens on (if not 3030)

```
PORT=3030
```

## 3. Register this origin with the backend

The backend's `Cors:AllowedOrigins` must include the exact origin this frontend is served from
(scheme + host + port) — see the backend repo's own `DEPLOYMENT-CONFIG.md`. Same-origin
deployments don't need this either.

## 4. Start/restart

```
npm run build   # only once, when the source itself changes - NOT per deployment
npm run start   # runs dist/server.cjs
```

Changing `API_BASE_URL`/`PORT` afterward only needs a process restart — not `npm run build`
again.

## 5. Verify

Open the app, open the browser's Network tab, and confirm requests go to the address set above
(or to the page's own origin, if left empty). `GET /runtime-config.js` on the running server
should echo the value currently set.

---

### What NOT to do
- Don't rely on `VITE_API_BASE_URL` for a real deployment — it's baked into the JS bundle at
  build time, so changing it does nothing until a rebuild. Use `API_BASE_URL` (above) instead.
- Don't hardcode a host/domain anywhere in source for this purpose — `index.html`'s link-preview
  meta tags use a placeholder (`app.invalid`) that `server.ts` already rewrites to the current
  request's own host automatically; nothing to configure there.
