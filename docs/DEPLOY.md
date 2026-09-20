# Deploying

The app is a static site. Nothing runs on a server: the host only has to hand
over the built files, and every word, note and Journal Entry stays in the
browser it was written in.

**Nothing in this repository has been deployed.** Deploying needs an account
that is yours, so the build, the host configuration and the rewrite rules are
committed here and the remaining steps — the ones that need you to be signed in
— are below.

## What is already configured

| File | What it does |
|---|---|
| `vite.config.ts` | `base: '/'` — served from the root of its own host. `src/App.tsx` reads this back as the router's `basename`. |
| `public/_redirects` | The catch-all rewrite. Read by Netlify and by Cloudflare Pages. |
| `netlify.toml` | Build command, publish directory, Node version, and cache headers. |
| `.github/workflows/ci.yml` | Lint, build and test on every push. Does not deploy. |

## The one thing a host must do

`src/App.tsx` uses `BrowserRouter`, so `/vocabulary` and `/journal/<id>` are real
URLs the browser asks the host for. A static host that does not know about them
returns 404 and no JavaScript ever runs — the app is broken on every reload,
bookmark and shared link, while the home page looks fine.

The fix is one rule: **serve `index.html` for any path that is not a file**, with
status 200 rather than a redirect. That rule is `public/_redirects`, and it is
why the hosts below are recommended in the order they are.

## Netlify — the recommended route

Free, honours `_redirects`, builds straight from the repository, and needs no
secrets stored in GitHub.

1. Push this branch and merge it to `master`.
2. Sign in at [app.netlify.com](https://app.netlify.com) with the GitHub account
   that owns `ntlyaraujo/n-stan-app`.
3. **Add new site → Import an existing project → GitHub**, authorise Netlify for
   that repository, and pick it.
4. Netlify reads `netlify.toml`, so the build command (`npm run build`), the
   publish directory (`dist`) and the Node version are already filled in. Leave
   them. Set the production branch to `master`.
5. **Deploy**. The first build takes a couple of minutes.
6. **Site configuration → Change site name** to something you will remember; the
   URL becomes `https://<name>.netlify.app`.

Every later push to `master` rebuilds and redeploys on its own.

### Check it worked

In a desktop browser, before touching the phone:

- Open `https://<name>.netlify.app/vocabulary` **directly**, by typing it in.
  If that loads the app rather than a 404 page, the rewrite is working. This is
  the check worth doing; the home page loading proves nothing.
- Reload while on a deep link. Same thing, from the other direction.
- Open dev tools → Application → Service Workers and confirm one is registered.

### Install it on the phone

1. Open the URL in Safari (iOS) or Chrome (Android).
2. **Share → Add to Home Screen** on iOS, or **⋮ → Install app** on Android.
3. Open it from the home screen. It runs without browser chrome, and the shell
   loads with no network.
4. Go to **Settings** in the app and check the **Storage** section says
   persistent storage was granted. If it did not, that is not something to fix —
   it is a reason to use **Export** regularly. The app will remind you.

Data does not travel with the install. Each browser holds its own database, so
moving to a new phone means Export on the old one and Import on the new one.

## Cloudflare Pages — the same shape

Also free, and also reads `public/_redirects` from the build output, so the
routing works identically. `netlify.toml` is ignored, so set the build by hand:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION` = `22`

The cache headers in `netlify.toml` would need restating in a `public/_headers`
file. Without them the app still works; it may just take one extra visit to pick
up a new version.

## GitHub Pages — possible, with a caveat

GitHub Pages cannot rewrite. Two ways round it, and both cost something:

1. **Copy `index.html` to `404.html` in the build.** Pages serves `404.html` for
   any unknown path, so the app boots and the router reads the URL correctly.
   The response carries a 404 status, which browsers do not mind but crawlers
   and some link previews do.
2. **Switch to `HashRouter`.** In `src/App.tsx`, change the import and the one
   element from `BrowserRouter` to `HashRouter` and drop the `basename` prop.
   URLs become `https://…/#/vocabulary`. Nothing else in the app changes.

**Neither has been done.** The app is on `BrowserRouter` with clean URLs, which
is why a host that can rewrite is the recommendation.

If you use Pages anyway, the app is served from `/n-stan-app/` rather than the
root, so also set `base: '/n-stan-app/'` in `vite.config.ts`, and change
`start_url` and `scope` in the PWA manifest there to match. `basename` follows
`base` on its own.

## Deploying under a subpath, on any host

Set `base` in `vite.config.ts` to the subpath, with both slashes:

```ts
base: '/n-stan-app/',
```

Then update `start_url` and `scope` in the `VitePWA` manifest in the same file.
`src/App.tsx` needs no change — it reads `import.meta.env.BASE_URL`.

## Notes

- **HTTPS is required**, not optional. A service worker will not register over
  plain HTTP, and neither Netlify nor Cloudflare will serve you plain HTTP.
- **The Dictionary is a live API.** Lookups go to Språkbanken's Karp API at
  `spraakbanken4.it.gu.se` from the browser. There is nothing to configure and
  no key to hold, but it means Auto-fill needs a network. Words already looked
  up are cached in IndexedDB and keep working offline, and capture never needed
  the network in the first place.
- **The service worker caches the app shell only.** It does not cache Dictionary
  responses; that cache lives in IndexedDB, in one place, on purpose.
