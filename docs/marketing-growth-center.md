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
2. **Phase 2 — AI strategy and recommendations:** evidence-based strategy drafts, objective/audience targeting, saved history, transparent evidence, effort and success measures, and administrator approval. SEO/content-specific audits remain the next Phase 2 increment.
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

## AI Marketing Strategy

Connect767 CMS 2.4.0 adds the strategy workspace directly below the Growth
Center dashboard. Administrators choose an objective, audience, and optional
geographic focus. Each saved draft contains:

- the aggregate 7/30/90-day evidence snapshot used to create it;
- an explanation and actual evidence for every recommended action;
- expected benefit, effort, and a measurable success criterion;
- draft, approved, and archived states;
- guardrails that prevent the plan from implying automatic publishing,
  outreach, or advertising spend.

The rules-based evidence engine always works and does not invent missing data.
For AI-enhanced drafts, define the server-side secret in `wp-config.php` or the
hosting environment (never in frontend JavaScript or the WordPress database):

```php
define('C767_OPENAI_API_KEY', 'server-secret');
// Optional. Defaults to gpt-4.1-mini.
define('C767_OPENAI_TEXT_MODEL', 'gpt-4.1-mini');
```

Only aggregate counts and the administrator's strategy context are sent to the
AI provider. Visitor hashes, session hashes, user details, listing contacts,
and credentials are excluded. If the provider is unavailable, the system saves
a clearly labelled data-driven baseline instead of failing or fabricating a
response. Generated plans remain drafts until an administrator approves them.

## Campaign Workspace

Connect767 CMS 2.10.0 adds a manual execution workspace for approved
strategies. Select **Create campaign workspace** on an approved strategy to:

- convert each evidence-based recommendation into an execution task;
- assign task owners, channels, due dates, and progress states;
- record campaign dates, an owner, notes, and a planning-only budget cap;
- build a consistent UTM-tagged destination link;
- add manual tasks and export the complete execution plan as CSV.

A workspace never publishes content, sends messages, creates advertisements,
or spends money. Its approved and active states are internal authorization and
tracking records only. Administrators must still execute approved work through
the relevant website, email provider, partner, or advertising platform.
