=== Connect767 Frontend Loader ===
Contributors: connect767
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
License: GPLv2 or later

Serves the built Connect767 React app as this WordPress site's actual
front-end — no separate hosting, no iframe, same domain.

== Description ==

This is a small, focused plugin with one job: take a `npm run build` output
from the Connect767 React app and serve it at this site's root domain, so
`https://yoursite.com/shop`, `/listings/some-business`, etc. all render the
real app instead of a 404 or a separate WordPress theme page.

It's deliberately separate from `connect767-cms` (which handles content,
REST API, auth, and checkout) — this plugin only cares about *serving the
built frontend*. Use one, both, or neither; they don't depend on each other.

== How it works ==

1. Upload a zipped `dist/` build (zip the *contents*, not the folder itself)
   under **Connect767 Frontend** in the admin sidebar.
2. The plugin extracts it into its own `dist/` folder and rewrites the
   root-absolute asset paths Vite emits (`src="/assets/..."`) to point at
   that folder's real, already-web-accessible URL — no special Vite `base`
   config needed on the frontend side.
3. Flip on "SPA takeover." From then on, every front-end request that
   isn't `/wp-admin`, `/wp-json`, `/wp-login.php`, `/xmlrpc.php`, or
   `/wp-content` gets answered with the app's `index.html`, and React
   Router takes it from there.

Takeover is off by default and stays off until you explicitly turn it on —
installing or activating this plugin alone can never break an existing
site.

== Reserved paths ==

If you need WordPress to keep serving something else at the root (e.g. a
`/blog` handled by a different system, or a custom sitemap), add it via the
`c767f_reserved_prefixes` filter:

    add_filter('c767f_reserved_prefixes', function ($prefixes) {
        $prefixes[] = '/legacy-blog';
        return $prefixes;
    });

== Updating the build ==

Re-upload a new zip any time — it replaces the old build immediately with
no need to toggle takeover off and back on.
