# Connect767 Marketing & Growth Center

## Architecture audit

Connect767 is a headless application with:

- a React/Vite public frontend;
- the custom `Connect767 CMS` WordPress plugin and `connect767/v1` REST API;
- WordPress users and JWT-backed frontend authentication;
- a `listing` custom post type and `listing_category` taxonomy;
- WooCommerce as a soft dependency for shop and checkout;
- a `community_update` post type plus dedicated reaction, follow, repost, bookmark, notification, report, and poll tables;
- existing hooks for completed registrations (`c767_user_registered`) and listing submissions (`c767_listing_submitted`).

The Growth Center extends these components. It does not replace accounts, listings, WooCommerce, or Community Feed behavior. Theme files are not modified.

The repository cannot reveal which plugins or Google properties are active on the production WordPress installation. Phase 1 therefore reports their connection state honestly and does not expose configuration fields that imply a working integration. Google data can be added only after an administrator authorizes the relevant property and credential flow.

## Delivery plan

1. **Phase 1 — analytics foundation:** administrator dashboard, first-party visitor/source measurement, registration and listing funnels, profile completion, category/listing performance, Community Feed engagement, UTM campaign reporting, exports, retention, and access controls.
2. **Phase 2 — SEO and content recommendations:** review-only suggestions for pages and listings, duplicate/missing data checks, structured-data validation, and administrator approval workflow.
3. **Phase 3 — social content and calendar:** branded drafts and an approval calendar; platform publishing only through authorized official APIs.
4. **Phase 4 — registration campaigns:** audience/category landing content, UTM templates, funnel comparison, and approved campaign drafts.
5. **Phase 5 — consent-based email:** welcome/profile reminders, unsubscribe and suppression handling, and an authorized provider adapter.
6. **Phase 6 — controlled optimization:** campaigns, A/B tests, reports, alerts, audit logs, and pause controls.

Each phase must be tested and accepted before the next begins.

## Phase 1 definitions

- **Website visitor:** a unique opaque, server-hashed browser identifier. Raw identifiers and IP addresses are not stored.
- **Session:** 30 minutes of browser activity identified by an opaque, server-hashed session ID.
- **Returning visitor:** a visitor observed before the selected reporting period and during it.
- **Completed profile:** a published listing containing at least seven of eight core fields: name, description, category, location, email, phone or website, logo, and cover.
- **Listing conversion:** business accounts that own at least one listing divided by all business accounts.
- **Campaign:** a visit containing a `utm_campaign` value. Campaign numbers are actual recorded visits, not forecasts.

Analytics events are allow-listed and rate-limited. Data is retained for 395 days and cleaned daily. The frontend honors browser Do Not Track. Dashboard access and CSV exports require the WordPress `manage_options` capability, and exports require a WordPress nonce.

## Production verification

1. Install/upgrade Connect767 CMS 2.3.0 and reactivate it so the analytics table is created.
2. Deploy the matching frontend build.
3. Visit several public routes with and without UTM parameters.
4. Complete a test registration and listing submission.
5. In WordPress, open **Connect767 → Marketing & Growth** and verify the real events.
6. Confirm a non-administrator cannot open the screen or export URL.
7. Confirm that no raw visitor ID, IP address, email address, or Google credential is stored in the analytics table.
8. Verify the 7/30/90-day filters and CSV export.

GA4 and Search Console remain visibly **Not connected** until their production authorization is completed. Their absence never causes invented numbers to appear.
