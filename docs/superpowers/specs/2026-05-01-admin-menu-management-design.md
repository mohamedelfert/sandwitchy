# Admin Menu Management — Design Spec

**Date:** 2026-05-01
**Phase:** 1 of 4 (Menu Management Foundation)
**Status:** Approved (pending user review of this written spec)

## Summary

Give the admin full control over the app's menu data — vendors, items, bread types, and drinks — through a new **"إعدادات القائمة"** tab in the admin dashboard. No code changes should be required to add a new vendor, change a price, or hide an item.

## Context

This is Phase 1 of a four-phase plan to make the admin dashboard the source of truth for all configurable data:

- **Phase 1 (this spec)** — Vendors, items, bread types, drinks (flat)
- **Phase 2** — Drink categorization + restaurant hours UI
- **Phase 3** — Global site settings (default delivery, banner, branding)
- **Phase 4** — User management (view/suspend, per-user history)

### Existing plumbing we are reusing

- Settings live in the `app_settings` (key, value) table; values are JSON-encoded.
- `GET /api/settings` returns all settings; `POST /api/settings { key, value }` writes one (admin-only).
- The frontend already calls `api.getSettings()` on boot and reads `bread_types`, `rests`, `drinks` from the response (see [src/screens/UserApp.jsx](src/screens/UserApp.jsx) lines ~92–96).
- Admin auth uses the cookie-based `requireAdmin` middleware in [server.js](server.js).
- Default values are hardcoded in [server.js](server.js) (`DEFAULT_BREAD_TYPES`, `DEFAULT_RESTS`, `DEFAULT_DRINKS`) and serve as a fallback when the DB has no row for that key.

### What is missing today

1. No admin UI to edit any of these — admins currently have to edit the DB or `server.js` defaults.
2. No server-side validation on settings writes — the endpoint trusts whatever JSON it receives.
3. No "soft delete" mechanism — deleting a vendor that is in an active session would break the session.
4. No way to hide a single item without removing it (e.g. "out of stock today").

## Audience and framing

The app is **not** a single restaurant — it is a group-ordering tool used by employees, students, or any group ordering from multiple nearby vendors. The code identifier `rests` is kept (renaming would touch ~50 files for no benefit), but user-facing copy uses **"الأماكن"** or **"المطاعم"** depending on what reads naturally per screen.

## Non-goals (explicitly out of scope for Phase 1)

These are deferred to keep the phase shippable:

- **File uploads.** Vendor images are URL-only. A real upload pipeline (storage backend, validation, resizing) is its own project.
- **Drag-to-reorder.** Display order = insertion order. Adds significant UI complexity for a small UX win.
- **Drink categories.** The drinks list stays flat in Phase 1. Phase 2 refactors this.
- **Restaurant hours editor.** The endpoint exists; the UI is Phase 2.
- **Bulk import/export.** Admins edit one row at a time.
- **Audit log.** No history of who changed what.
- **Concurrent-edit locking.** Last write wins at the entity level (per-entity endpoints, see Architecture). Two admins editing the same field at the same time is rare enough not to design around.

## Architecture

### UI

A new tab is added to [src/admin/AdminPage.jsx](src/admin/AdminPage.jsx) titled **"إعدادات القائمة"** alongside the existing tabs (Analytics, Order Status, Promo Codes). The tab is implemented as a new component `MenuSettingsTab.jsx` in `src/admin/`.

Layout: a single scrollable page with three collapsible sections (each is a `<details>` element or equivalent stateful collapse):

1. **المطاعم / الأماكن** — list of vendor cards. Each card shows the vendor's editable fields and an embedded list of its items. New items get added via an "إضافة صنف" button at the bottom of the card.
2. **أنواع العيش** — flat list of bread types.
3. **المشروبات** — flat list of drinks.

Each section ends with an **"إضافة"** button that appends a new blank row in edit mode with focus on the name field.

### Data model

All three settings remain JSON arrays in `app_settings`. **No schema migrations.** Two new fields are added to existing object shapes (both default-true, so older clients tolerate them):

**Vendor (`rests[]`):**

```js
{
  id: string,           // server-assigned UUID; never edited by admin
  name: string,         // 1–60 chars, required
  emoji: string,        // optional
  bg: string,           // #RRGGBB
  hasBread: boolean,
  delivery: number,     // ≥ 0
  image: string,        // https:// URL, or empty
  available: boolean,   // NEW — when false, hidden from user UI but kept in DB
  items: [{
    id: string,         // server-assigned UUID
    name: string,       // 1–60 chars, required
    price: number,      // ≥ 0
    available: boolean, // NEW — single-item hide
  }]
}
```

**Bread (`bread_types[]`):** `{ id, ar, color, light, available }` — adds `available` (default `true`) for soft-delete consistency with vendors/items.

**Drink (`drinks[]`):** `{ id, name, emoji, available }` — adds `available` (default `true`). Otherwise unchanged in Phase 1; refactored in Phase 2.

### Endpoints

The bulk-write endpoint `POST /api/settings { key, value }` stays for compatibility, but the admin UI does **not** use it for menu CRUD. Two admins editing simultaneously would last-write-wins clobber each other if the whole array were round-tripped. Instead, per-entity endpoints let the server merge:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/admin/menu/vendor` | Create one vendor; body has the vendor without `id`. Returns `{ ok, vendor, rests }`. |
| `PUT` | `/api/admin/menu/vendor/:id` | Patch a vendor (partial body merged into the existing record). Returns the patched vendor. |
| `DELETE` | `/api/admin/menu/vendor/:id` | Delete or soft-delete (see "Delete safety" below). |
| `POST` | `/api/admin/menu/vendor/:vid/item` | Create an item inside a vendor. |
| `PUT` | `/api/admin/menu/vendor/:vid/item/:iid` | Patch an item. |
| `DELETE` | `/api/admin/menu/vendor/:vid/item/:iid` | Delete or soft-delete an item. |
| `POST` | `/api/admin/menu/bread` | Create. |
| `PUT` | `/api/admin/menu/bread/:id` | Patch. |
| `DELETE` | `/api/admin/menu/bread/:id` | Delete. |
| `POST` | `/api/admin/menu/drink` | Create. |
| `PUT` | `/api/admin/menu/drink/:id` | Patch. |
| `DELETE` | `/api/admin/menu/drink/:id` | Delete. |

All endpoints are guarded by `requireAdmin`.

**Propagation to connected user clients.** `broadcast(sid)` sends a session's *order* payload over SSE — not global menu settings, which user clients fetch once on boot via `api.getSettings()`. For Phase 1 we accept that users in an active session won't see a price/item change until they reload. Real-time menu push is a deliberate non-goal here; it can be added in a follow-up by piggybacking a `settings` field onto the SSE payload or adding a dedicated `/events/settings` channel.

### Validation (server-side)

Validation lives in `server.js` next to the new route handlers. A failed validation returns `400 { ok: false, error: 'validation', field, message }`.

- **Vendor name / item name / drink name / bread `ar`:** trimmed length 1–60.
- **Prices and delivery:** parsed as numbers, must be `≥ 0` and `≤ 99999`.
- **Color (`bg`, `color`, `light`):** must match `/^#[0-9A-Fa-f]{6}$/`.
- **Image URL:** empty string OR matches `/^https:\/\/.+/`.
- **Booleans:** coerced from JS truthiness.
- **IDs:** server-assigned via `crypto.randomUUID()`. Any client-supplied `id` on POST is ignored.

### Delete safety

Hard delete would corrupt any open session that references the deleted entity (the user UI looks up vendor/item by id when rendering submitted orders).

Before any delete, the server queries open sessions for references:

- **Vendor / item delete:** scan all sessions where `status='open'` and any `orders.lines[].rid === vendorId` (or `iid === itemId`).
- **Bread / drink delete:** scan all open `orders.lines[].bt` / `orders.drinks` keys.

If references exist, the endpoint returns `409 { ok: false, error: 'in_use', sessions: [<sid>...] }`. The UI then prompts the admin: "Used in N open sessions. Hide instead?" → calls `PUT` with `available: false`.

If no references exist, the entity is removed from the array and saved.

User clients filter `available === false` entities out of menus, but **already-submitted orders continue to render historic items normally** because the line carries its own `iname`/`price` snapshot at submission time.

### UX details

- **Inline editing.** Click a field, edit, blur to save. Saves are debounced 400 ms per field. The field shows a brief "✓ تم الحفظ" indicator on success.
- **Optimistic updates.** UI updates immediately; on server error, the field reverts and a toast shows the error message.
- **Add buttons** create the entity on the server first (so it gets a real id), then put the row into edit mode with focus on the name field.
- **Delete** is the only action that prompts for confirmation. Edits never prompt.
- **No drag handles.** Items render in insertion order.

### Files touched

**New files:**

- `src/admin/MenuSettingsTab.jsx` — the tab component, ~400 LOC.
- `src/admin/menu/VendorCard.jsx` — single vendor's editable card with embedded items list, ~150 LOC.
- `src/admin/menu/InlineField.jsx` — small reusable component for debounced inline-editable fields, ~60 LOC.

**Edited:**

- `server.js` — add 12 endpoints, validation helpers, delete-safety helper. Roughly +250 LOC. Keep new code in a single `// ── Admin Menu CRUD ──` section near the existing admin routes.
- `src/admin/AdminPage.jsx` — register the new tab.
- `src/api/client.js` — add the 12 new wrappers under a `// Menu management` block.
- `src/screens/UserApp.jsx` and any user screens that filter `rests`/`drinks` — apply `available !== false` filter when rendering menus (already-submitted lines bypass this filter, see "Delete safety").

### Error handling and edge cases

- **DB unavailable (Vercel / fallback path):** the server already keeps an in-memory mirror. Menu writes update the in-memory settings the same way the existing `POST /api/settings` does. No change needed beyond following that pattern.
- **Duplicate names:** allowed. Names are not unique keys; `id` is.
- **Empty menu:** the user UI already tolerates an empty `rests` array (shows "no vendors yet"). No new handling required.
- **Concurrent edits to the same field:** last write wins. Acceptable for this scale.
- **A vendor's `image` URL 404s:** the user-side UI must already tolerate broken image URLs (Phase 1 does not change image rendering).

## Testing

There is no test runner in this repo and the user has not asked us to set one up. Verification is manual:

1. Open the admin tab; create a vendor; refresh; vendor persists.
2. Add an item to that vendor; check it appears in a fresh user session.
3. Submit an order with that item, then attempt to delete the vendor; expect the "hide instead?" prompt.
4. Hide the vendor; reload a user session; vendor no longer appears in the menu.
5. Open the original session that referenced the now-hidden vendor; the submitted line still renders correctly.
6. Edit a price; reload a user tab; price reflects the change. (Live SSE push for menu changes is a non-goal in this phase.)
7. Try a malformed color (`'red'`) → expect a 400 with a useful message.

## Open questions

None. All decisions made above are firm unless the user pushes back during the spec review.

## Migration / rollout

No DB migrations. No backfill. The two new fields (`available` on vendors and items) default to `true` when reading legacy rows that lack them — handled in the read path, not the data layer.

The first time the admin opens the new tab, they will see whatever is currently in `app_settings` (or the hardcoded defaults). Existing sessions are unaffected.
