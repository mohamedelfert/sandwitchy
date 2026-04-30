# Admin Menu Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 admin menu management UI + per-entity CRUD endpoints so the admin can manage vendors, items, bread types, and drinks from the dashboard without editing code or the database.

**Architecture:** A new "إعدادات القائمة" tab in the React admin dashboard, backed by 12 new Express endpoints under `/api/admin/menu/*`. Each entity write hits one endpoint (no bulk array round-trip), inputs are validated server-side, and deletions check open-session references and soft-delete via an `available` flag when the entity is in use. The existing hidden settings modal in `AdminPage.jsx` is removed in the cleanup task.

**Tech Stack:** Node.js, Express, better-sqlite3 (with in-memory fallback), React 18 (JSX, no TypeScript), Vite, lucide-react icons, inline styles. **No test runner exists in this repo** — verification is manual via `curl` for endpoints and a browser for UI. Each task includes explicit verification commands and expected output.

**Spec:** [docs/superpowers/specs/2026-05-01-admin-menu-management-design.md](../specs/2026-05-01-admin-menu-management-design.md)

---

## Setup (do this once before Task 1)

- [ ] **S1: Start the dev server in one terminal**

```bash
npm install
npm run dev
```

Expected: server listening on `http://localhost:3000`, log line `SQLite: enabled`.

- [ ] **S2: Get an admin cookie for curl tests**

```bash
curl -s -c /tmp/admin-cookie.txt -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456789"}'
```

Expected: `{"ok":true,"username":"admin"}` and `/tmp/admin-cookie.txt` contains a `sandwitchy_admin` cookie.

For the rest of the plan, every admin curl uses `-b /tmp/admin-cookie.txt`. The variable `$ADMIN` below is shorthand for that flag.

```bash
ADMIN='-b /tmp/admin-cookie.txt'
```

- [ ] **S3: Confirm the existing settings GET still works**

```bash
curl -s http://localhost:3000/api/settings | head -c 200
```

Expected: JSON with `bread_types`, `rests`, `drinks` arrays.

---

## Task 1: Server-side helpers (IDs, settings access, validation)

**Files:**
- Modify: `server.js` — insert a new block right after the existing `updateSettingValue` function (after line ~469) and before `// User management functions`.

- [ ] **Step 1: Add the new helper block to `server.js`**

Insert this code immediately after `function updateSettingValue(...)` ends (line ~469):

```js
// ── Admin menu management helpers ───────────────────────────────────
function newMenuId() {
  return crypto.randomUUID()
}

function getRests()       { return getSettingValue('rests', DEFAULT_RESTS) }
function getBreadTypes()  { return getSettingValue('bread_types', DEFAULT_BREAD_TYPES) }
function getDrinks()      { return getSettingValue('drinks', DEFAULT_DRINKS) }
function setRestsValue(value)      { updateSettingValue('rests', value) }
function setBreadTypesValue(value) { updateSettingValue('bread_types', value) }
function setDrinksValue(value)     { updateSettingValue('drinks', value) }

const MENU_NAME_MIN = 1
const MENU_NAME_MAX = 60
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/
const HTTPS_URL_RE = /^https:\/\/.+/

function validationError(field, message) {
  return { ok: false, error: 'validation', field, message }
}

function validateName(value, field = 'name') {
  if (typeof value !== 'string') return validationError(field, 'must be a string')
  const trimmed = value.trim()
  if (trimmed.length < MENU_NAME_MIN || trimmed.length > MENU_NAME_MAX) {
    return validationError(field, `length must be ${MENU_NAME_MIN}-${MENU_NAME_MAX}`)
  }
  return null
}

function validateNumberRange(value, field, { min = 0, max = 99999 } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) {
    return validationError(field, `must be a number between ${min} and ${max}`)
  }
  return null
}

function validateColor(value, field) {
  if (typeof value !== 'string' || !HEX_COLOR_RE.test(value)) {
    return validationError(field, 'must be #RRGGBB')
  }
  return null
}

function validateImageUrl(value, field = 'image') {
  if (value === '' || value == null) return null
  if (typeof value !== 'string' || !HTTPS_URL_RE.test(value)) {
    return validationError(field, 'must be empty or an https:// URL')
  }
  return null
}

function validateVendor(input, { partial = false } = {}) {
  const errors = []
  const has = key => input != null && Object.prototype.hasOwnProperty.call(input, key)
  if (!partial || has('name')) { const e = validateName(input.name, 'name'); if (e) errors.push(e) }
  if (!partial || has('delivery')) { const e = validateNumberRange(input.delivery ?? 0, 'delivery'); if (e) errors.push(e) }
  if (!partial || has('bg')) { if (input.bg != null) { const e = validateColor(input.bg, 'bg'); if (e) errors.push(e) } }
  if (has('image')) { const e = validateImageUrl(input.image); if (e) errors.push(e) }
  return errors[0] || null
}

function validateItem(input, { partial = false } = {}) {
  const has = key => input != null && Object.prototype.hasOwnProperty.call(input, key)
  if (!partial || has('name')) { const e = validateName(input.name, 'name'); if (e) return e }
  if (!partial || has('price')) { const e = validateNumberRange(input.price ?? 0, 'price'); if (e) return e }
  return null
}

function validateBread(input, { partial = false } = {}) {
  const has = key => input != null && Object.prototype.hasOwnProperty.call(input, key)
  if (!partial || has('ar')) { const e = validateName(input.ar, 'ar'); if (e) return e }
  if (!partial || has('color')) { const e = validateColor(input.color, 'color'); if (e) return e }
  if (has('light')) { const e = validateColor(input.light, 'light'); if (e) return e }
  return null
}

function validateDrink(input, { partial = false } = {}) {
  const has = key => input != null && Object.prototype.hasOwnProperty.call(input, key)
  if (!partial || has('name')) { const e = validateName(input.name, 'name'); if (e) return e }
  return null
}

// Returns array of open session ids that reference a vendor / item / bread / drink.
function findReferencingSessions({ vendorId = null, itemId = null, breadId = null, drinkId = null }) {
  const refs = []
  const sids = getSessionIds({ openOnly: true })
  for (const sid of sids) {
    const orders = Object.values(getOrders(sid))
    let referenced = false
    for (const order of orders) {
      const lines = order.lines || []
      for (const line of lines) {
        if (vendorId != null && String(line.rid) === String(vendorId)) { referenced = true; break }
        if (itemId   != null && String(line.iid) === String(itemId))   { referenced = true; break }
        if (breadId  != null && line.bt === breadId)                   { referenced = true; break }
      }
      if (!referenced && drinkId != null) {
        const drinks = order.drinks || {}
        if (drinks[drinkId] && drinks[drinkId] > 0) referenced = true
      }
      if (referenced) break
    }
    if (referenced) refs.push(sid)
  }
  return refs
}
```

- [ ] **Step 2: Verify the file still parses (server hot-reloads or restart)**

```bash
node --check server.js
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(admin-menu): add server-side helpers for menu CRUD

Adds id generator, per-key settings accessors, validation helpers, and
open-session reference scanner. No endpoints yet — those land in the
next commits."
```

---

## Task 2: Vendor endpoints (POST / PUT / DELETE)

**Files:**
- Modify: `server.js` — insert after the existing `POST /api/settings` route (after line ~1425).

- [ ] **Step 1: Add the three vendor routes**

Insert directly after the existing `POST /api/settings` handler:

```js
// ── Admin Menu CRUD: vendors ───────────────────────────────────────
app.post('/api/admin/menu/vendor', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateVendor(body, { partial: false })
  if (err) return res.status(400).json(err)
  const vendor = {
    id: newMenuId(),
    name: body.name.trim(),
    emoji: typeof body.emoji === 'string' ? body.emoji : '🍽️',
    bg: typeof body.bg === 'string' && HEX_COLOR_RE.test(body.bg) ? body.bg : '#FFF8E8',
    hasBread: !!body.hasBread,
    delivery: Number(body.delivery) || 0,
    image: typeof body.image === 'string' ? body.image : '',
    available: body.available === false ? false : true,
    items: [],
  }
  const rests = getRests()
  rests.push(vendor)
  setRestsValue(rests)
  res.json({ ok: true, vendor, rests })
})

app.put('/api/admin/menu/vendor/:id', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateVendor(body, { partial: true })
  if (err) return res.status(400).json(err)
  const rests = getRests()
  const idx = rests.findIndex(r => String(r.id) === String(req.params.id))
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' })
  const allowed = ['name', 'emoji', 'bg', 'hasBread', 'delivery', 'image', 'available']
  const patch = {}
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = k === 'name' ? body.name.trim()
              : k === 'delivery' ? Number(body.delivery) || 0
              : k === 'hasBread' || k === 'available' ? !!body[k]
              : body[k]
    }
  }
  rests[idx] = { ...rests[idx], ...patch }
  setRestsValue(rests)
  res.json({ ok: true, vendor: rests[idx] })
})

app.delete('/api/admin/menu/vendor/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  const refs = findReferencingSessions({ vendorId: id })
  if (refs.length > 0) {
    return res.status(409).json({ ok: false, error: 'in_use', sessions: refs })
  }
  const rests = getRests().filter(r => String(r.id) !== String(id))
  setRestsValue(rests)
  res.json({ ok: true, rests })
})
```

- [ ] **Step 2: Restart the dev server** (Ctrl-C then `npm run dev`) so the new routes register.

- [ ] **Step 3: Create a vendor**

```bash
curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/vendor \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Vendor","emoji":"🍕","bg":"#FFE8E8","delivery":15,"hasBread":false}'
```

Expected: `{"ok":true,"vendor":{"id":"<uuid>","name":"Test Vendor",...},"rests":[...]}`. Save the returned `vendor.id` for the next steps:

```bash
VID=$(curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/vendor \
  -H 'Content-Type: application/json' \
  -d '{"name":"Plan Test Vendor","bg":"#FFE8E8","delivery":15}' | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
echo "$VID"
```

Expected: a UUID printed.

- [ ] **Step 4: Update the vendor**

```bash
curl -s $ADMIN -X PUT http://localhost:3000/api/admin/menu/vendor/$VID \
  -H 'Content-Type: application/json' \
  -d '{"name":"Renamed","delivery":20}'
```

Expected: `{"ok":true,"vendor":{"id":"<VID>","name":"Renamed","delivery":20,...}}`.

- [ ] **Step 5: Validation rejects bad input**

```bash
curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/vendor \
  -H 'Content-Type: application/json' \
  -d '{"name":"","bg":"red"}'
```

Expected: HTTP 400 body `{"ok":false,"error":"validation","field":"name","message":"length must be 1-60"}` (or `field:"bg"` — order depends on which check fails first; both should fail).

- [ ] **Step 6: Delete the vendor**

```bash
curl -s $ADMIN -X DELETE http://localhost:3000/api/admin/menu/vendor/$VID
```

Expected: `{"ok":true,"rests":[...]}` and the vendor no longer in the list.

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "feat(admin-menu): add vendor CRUD endpoints

POST/PUT/DELETE /api/admin/menu/vendor/:id with validation and
open-session reference check on delete (409 in_use)."
```

---

## Task 3: Item endpoints (nested under vendor)

**Files:**
- Modify: `server.js` — insert directly after the vendor DELETE route from Task 2.

- [ ] **Step 1: Add the three item routes**

```js
// ── Admin Menu CRUD: items ─────────────────────────────────────────
app.post('/api/admin/menu/vendor/:vid/item', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateItem(body, { partial: false })
  if (err) return res.status(400).json(err)
  const rests = getRests()
  const vendor = rests.find(r => String(r.id) === String(req.params.vid))
  if (!vendor) return res.status(404).json({ ok: false, error: 'not_found' })
  const item = {
    id: newMenuId(),
    name: body.name.trim(),
    price: Number(body.price) || 0,
    available: body.available === false ? false : true,
  }
  vendor.items = [...(vendor.items || []), item]
  setRestsValue(rests)
  res.json({ ok: true, item, vendor })
})

app.put('/api/admin/menu/vendor/:vid/item/:iid', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateItem(body, { partial: true })
  if (err) return res.status(400).json(err)
  const rests = getRests()
  const vendor = rests.find(r => String(r.id) === String(req.params.vid))
  if (!vendor) return res.status(404).json({ ok: false, error: 'not_found' })
  const idx = (vendor.items || []).findIndex(it => String(it.id) === String(req.params.iid))
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' })
  const allowed = ['name', 'price', 'available']
  const patch = {}
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = k === 'name' ? body.name.trim()
              : k === 'price' ? Number(body.price) || 0
              : !!body[k]
    }
  }
  vendor.items[idx] = { ...vendor.items[idx], ...patch }
  setRestsValue(rests)
  res.json({ ok: true, item: vendor.items[idx] })
})

app.delete('/api/admin/menu/vendor/:vid/item/:iid', requireAdmin, (req, res) => {
  const refs = findReferencingSessions({ itemId: req.params.iid })
  if (refs.length > 0) {
    return res.status(409).json({ ok: false, error: 'in_use', sessions: refs })
  }
  const rests = getRests()
  const vendor = rests.find(r => String(r.id) === String(req.params.vid))
  if (!vendor) return res.status(404).json({ ok: false, error: 'not_found' })
  vendor.items = (vendor.items || []).filter(it => String(it.id) !== String(req.params.iid))
  setRestsValue(rests)
  res.json({ ok: true, vendor })
})
```

- [ ] **Step 2: Restart the dev server.**

- [ ] **Step 3: Create vendor + item via curl**

```bash
VID=$(curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/vendor \
  -H 'Content-Type: application/json' \
  -d '{"name":"Item Test Vendor"}' | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)

curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/vendor/$VID/item \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Sandwich","price":25}'
```

Expected: `{"ok":true,"item":{"id":"<uuid>","name":"Test Sandwich","price":25,"available":true},"vendor":{...}}`.

- [ ] **Step 4: Update the item price**

```bash
IID=$(curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/vendor/$VID/item \
  -H 'Content-Type: application/json' \
  -d '{"name":"Plan Item","price":10}' | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)

curl -s $ADMIN -X PUT http://localhost:3000/api/admin/menu/vendor/$VID/item/$IID \
  -H 'Content-Type: application/json' \
  -d '{"price":12}'
```

Expected: `{"ok":true,"item":{...,"price":12}}`.

- [ ] **Step 5: Cleanup the test vendor**

```bash
curl -s $ADMIN -X DELETE http://localhost:3000/api/admin/menu/vendor/$VID
```

Expected: `{"ok":true,"rests":[...]}`.

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat(admin-menu): add item CRUD endpoints

POST/PUT/DELETE /api/admin/menu/vendor/:vid/item/:iid with the same
validation + delete-safety pattern as vendors."
```

---

## Task 4: Bread endpoints

**Files:**
- Modify: `server.js` — insert directly after the item DELETE route from Task 3.

- [ ] **Step 1: Add the three bread routes**

```js
// ── Admin Menu CRUD: bread types ───────────────────────────────────
app.post('/api/admin/menu/bread', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateBread(body, { partial: false })
  if (err) return res.status(400).json(err)
  const bread = {
    id: newMenuId(),
    ar: body.ar.trim(),
    color: body.color,
    light: typeof body.light === 'string' && HEX_COLOR_RE.test(body.light) ? body.light : `${body.color}11`,
    available: body.available === false ? false : true,
  }
  const types = getBreadTypes()
  types.push(bread)
  setBreadTypesValue(types)
  res.json({ ok: true, bread, bread_types: types })
})

app.put('/api/admin/menu/bread/:id', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateBread(body, { partial: true })
  if (err) return res.status(400).json(err)
  const types = getBreadTypes()
  const idx = types.findIndex(b => String(b.id) === String(req.params.id))
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' })
  const allowed = ['ar', 'color', 'light', 'available']
  const patch = {}
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = k === 'ar' ? body.ar.trim()
              : k === 'available' ? !!body[k]
              : body[k]
    }
  }
  types[idx] = { ...types[idx], ...patch }
  setBreadTypesValue(types)
  res.json({ ok: true, bread: types[idx] })
})

app.delete('/api/admin/menu/bread/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  const refs = findReferencingSessions({ breadId: id })
  if (refs.length > 0) {
    return res.status(409).json({ ok: false, error: 'in_use', sessions: refs })
  }
  const types = getBreadTypes().filter(b => String(b.id) !== String(id))
  setBreadTypesValue(types)
  res.json({ ok: true, bread_types: types })
})
```

- [ ] **Step 2: Restart, then test**

```bash
BID=$(curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/bread \
  -H 'Content-Type: application/json' \
  -d '{"ar":"عيش بلان","color":"#A33A0A"}' | sed -n 's/.*"bread":{"id":"\([^"]*\)".*/\1/p' | head -1)
echo "$BID"

curl -s $ADMIN -X DELETE http://localhost:3000/api/admin/menu/bread/$BID
```

Expected: UUID printed, then `{"ok":true,"bread_types":[...]}`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(admin-menu): add bread type CRUD endpoints"
```

---

## Task 5: Drink endpoints

**Files:**
- Modify: `server.js` — insert directly after the bread DELETE route from Task 4.

- [ ] **Step 1: Add the three drink routes**

```js
// ── Admin Menu CRUD: drinks ────────────────────────────────────────
app.post('/api/admin/menu/drink', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateDrink(body, { partial: false })
  if (err) return res.status(400).json(err)
  const drink = {
    id: newMenuId(),
    name: body.name.trim(),
    emoji: typeof body.emoji === 'string' ? body.emoji : '🥤',
    available: body.available === false ? false : true,
  }
  const drinks = getDrinks()
  drinks.push(drink)
  setDrinksValue(drinks)
  res.json({ ok: true, drink, drinks })
})

app.put('/api/admin/menu/drink/:id', requireAdmin, (req, res) => {
  const body = req.body || {}
  const err = validateDrink(body, { partial: true })
  if (err) return res.status(400).json(err)
  const drinks = getDrinks()
  const idx = drinks.findIndex(d => String(d.id) === String(req.params.id))
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not_found' })
  const allowed = ['name', 'emoji', 'available']
  const patch = {}
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = k === 'name' ? body.name.trim()
              : k === 'available' ? !!body[k]
              : body[k]
    }
  }
  drinks[idx] = { ...drinks[idx], ...patch }
  setDrinksValue(drinks)
  res.json({ ok: true, drink: drinks[idx] })
})

app.delete('/api/admin/menu/drink/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  const refs = findReferencingSessions({ drinkId: id })
  if (refs.length > 0) {
    return res.status(409).json({ ok: false, error: 'in_use', sessions: refs })
  }
  const drinks = getDrinks().filter(d => String(d.id) !== String(id))
  setDrinksValue(drinks)
  res.json({ ok: true, drinks })
})
```

- [ ] **Step 2: Restart, then test**

```bash
DID=$(curl -s $ADMIN -X POST http://localhost:3000/api/admin/menu/drink \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Drink","emoji":"🍹"}' | sed -n 's/.*"drink":{"id":"\([^"]*\)".*/\1/p' | head -1)

curl -s $ADMIN -X PUT http://localhost:3000/api/admin/menu/drink/$DID \
  -H 'Content-Type: application/json' \
  -d '{"available":false}'

curl -s $ADMIN -X DELETE http://localhost:3000/api/admin/menu/drink/$DID
```

Expected: drink created, updated to `available:false`, then deleted with `{"ok":true,"drinks":[...]}`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(admin-menu): add drink CRUD endpoints

Completes the 12-endpoint backend surface for menu management.
Frontend wiring lands next."
```

---

## Task 6: API client wrappers

**Files:**
- Modify: `src/api/client.js` — append a new `// Menu management` block at the end of the `api` object (before the closing brace).

- [ ] **Step 1: Add the wrappers**

Find the closing `}` of the `api` object (currently after the duplicate `vote:` entry near line 84) and insert before it:

```js
  // Menu management (Phase 1 admin)
  createVendor:    (data)            => parseJson(fetch('/api/admin/menu/vendor', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  updateVendor:    (vid, data)       => parseJson(fetch(`/api/admin/menu/vendor/${vid}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  deleteVendor:    (vid)             => parseJson(fetch(`/api/admin/menu/vendor/${vid}`, { method:'DELETE' })),
  createItem:      (vid, data)       => parseJson(fetch(`/api/admin/menu/vendor/${vid}/item`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  updateItem:      (vid, iid, data)  => parseJson(fetch(`/api/admin/menu/vendor/${vid}/item/${iid}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  deleteItem:      (vid, iid)        => parseJson(fetch(`/api/admin/menu/vendor/${vid}/item/${iid}`, { method:'DELETE' })),
  createBread:     (data)            => parseJson(fetch('/api/admin/menu/bread', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  updateBread:     (id, data)        => parseJson(fetch(`/api/admin/menu/bread/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  deleteBread:     (id)              => parseJson(fetch(`/api/admin/menu/bread/${id}`, { method:'DELETE' })),
  createDrink:     (data)            => parseJson(fetch('/api/admin/menu/drink', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  updateDrink:     (id, data)        => parseJson(fetch(`/api/admin/menu/drink/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  deleteDrink:     (id)              => parseJson(fetch(`/api/admin/menu/drink/${id}`, { method:'DELETE' })),
```

(`parseJson` is already defined at the top of `client.js` — no new import needed.)

- [ ] **Step 2: Verify the file parses**

```bash
node --check src/api/client.js 2>&1 || echo 'parse error'
```

Expected: no output. (Note: `client.js` is ESM, `node --check` is enough for syntax.)

- [ ] **Step 3: Commit**

```bash
git add src/api/client.js
git commit -m "feat(admin-menu): add api client wrappers for menu CRUD"
```

---

## Task 7: `InlineField` component (debounced auto-save)

**Files:**
- Create: `src/admin/menu/InlineField.jsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/admin/menu
```

- [ ] **Step 2: Write the component**

```jsx
import { useEffect, useRef, useState } from 'react'
import { C } from '../../constants/colors.js'
import { inpSt } from '../../utils/helpers.js'

/**
 * Debounced inline input. Calls onSave(newValue) 400ms after the last keystroke,
 * once the value differs from `value`. Shows a brief saved/error indicator.
 *
 * Props:
 *   value         — current value (string or number)
 *   onSave        — async (next) => void; throw to signal failure
 *   type          — 'text' | 'number' | 'color' (default 'text')
 *   placeholder
 *   style         — extra style overrides
 *   coerce        — optional fn applied to raw input before save (e.g. parseFloat)
 */
export default function InlineField({ value, onSave, type = 'text', placeholder = '', style = {}, coerce }) {
  const [local, setLocal] = useState(value ?? '')
  const [state, setState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [errMsg, setErrMsg] = useState('')
  const timer = useRef(null)
  const lastSaved = useRef(value ?? '')

  // External value changes (e.g. server response after add) reset local state.
  useEffect(() => {
    setLocal(value ?? '')
    lastSaved.current = value ?? ''
  }, [value])

  const scheduleSave = next => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const toSend = coerce ? coerce(next) : next
      if (toSend === lastSaved.current) return
      setState('saving')
      try {
        await onSave(toSend)
        lastSaved.current = toSend
        setState('saved')
        setTimeout(() => setState('idle'), 1200)
      } catch (e) {
        setErrMsg(e?.data?.message || e?.message || 'خطأ')
        setState('error')
      }
    }, 400)
  }

  const baseStyle = {
    ...inpSt({ height: 38, fontSize: 13 }),
    borderColor: state === 'error' ? C.red : state === 'saved' ? C.green : undefined,
    ...style,
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={e => { setLocal(e.target.value); scheduleSave(e.target.value); setState('idle'); setErrMsg('') }}
        onBlur={() => { if (timer.current) { clearTimeout(timer.current); scheduleSave(local) } }}
        style={baseStyle}
      />
      {state === 'saving' && <span style={{ position: 'absolute', insetInlineEnd: 6, top: 10, fontSize: 10, color: C.muted }}>…</span>}
      {state === 'saved' && <span style={{ position: 'absolute', insetInlineEnd: 6, top: 10, fontSize: 10, color: C.green }}>✓</span>}
      {state === 'error' && <span style={{ position: 'absolute', insetInlineEnd: 6, top: 10, fontSize: 10, color: C.red }} title={errMsg}>!</span>}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles in the Vite dev build**

```bash
npx vite build 2>&1 | tail -20
```

Expected: build succeeds, no syntax errors. (Component is unused so no warning is fine — Vite tree-shakes.)

- [ ] **Step 4: Commit**

```bash
git add src/admin/menu/InlineField.jsx
git commit -m "feat(admin-menu): add InlineField — debounced auto-save input"
```

---

## Task 8: `VendorCard` component

**Files:**
- Create: `src/admin/menu/VendorCard.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { C } from '../../constants/colors.js'
import { api } from '../../api/client.js'
import { GhostBtn } from '../../components/Btn.jsx'
import InlineField from './InlineField.jsx'

export default function VendorCard({ vendor, onChange, onRemove }) {
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const patchVendor = async patch => {
    const res = await api.updateVendor(vendor.id, patch)
    onChange({ ...vendor, ...res.vendor })
  }

  const addItem = async () => {
    setBusy(true); setErrorMsg('')
    try {
      const res = await api.createItem(vendor.id, { name: '', price: 0 })
      onChange({ ...vendor, items: [...(vendor.items || []), res.item] })
    } catch (e) {
      setErrorMsg(e?.data?.message || e?.message || 'فشل الإضافة')
    } finally { setBusy(false) }
  }

  const patchItem = async (iid, patch) => {
    const res = await api.updateItem(vendor.id, iid, patch)
    onChange({ ...vendor, items: vendor.items.map(it => it.id === iid ? { ...it, ...res.item } : it) })
  }

  const deleteItem = async iid => {
    if (!confirm('متأكد تمسحه؟')) return
    try {
      await api.deleteItem(vendor.id, iid)
      onChange({ ...vendor, items: vendor.items.filter(it => it.id !== iid) })
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`الصنف مستخدم في ${e.data.sessions.length} جلسة مفتوحة. تخفيه بدل ما تمسحه؟`)) {
          await patchItem(iid, { available: false })
        }
      } else {
        alert(e?.data?.message || e?.message || 'فشل الحذف')
      }
    }
  }

  const deleteVendor = async () => {
    if (!confirm(`متأكد تمسح "${vendor.name}"؟`)) return
    try {
      await api.deleteVendor(vendor.id)
      onRemove()
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`المطعم مستخدم في ${e.data.sessions.length} جلسة مفتوحة. تخفيه بدل ما تمسحه؟`)) {
          await patchVendor({ available: false })
        }
      } else {
        alert(e?.data?.message || e?.message || 'فشل الحذف')
      }
    }
  }

  const dimmed = vendor.available === false
  return (
    <div style={{ background: dimmed ? '#F2F2F2' : C.tag, borderRadius: 14, padding: 14, opacity: dimmed ? 0.6 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 42px', gap: 8, marginBottom: 10 }}>
        <InlineField value={vendor.name} placeholder="اسم المطعم" onSave={v => patchVendor({ name: v })}/>
        <InlineField value={vendor.emoji || ''} placeholder="🍽️" style={{ textAlign: 'center' }} onSave={v => patchVendor({ emoji: v })}/>
        <InlineField value={vendor.delivery ?? 0} type="number" placeholder="توصيل" coerce={parseFloat} onSave={v => patchVendor({ delivery: v })}/>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#FFF', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
          <input type="checkbox" checked={!!vendor.hasBread} onChange={e => patchVendor({ hasBread: e.target.checked })}/>
          عيش
        </label>
        <button onClick={deleteVendor} style={{ border: 'none', background: C.redLight, color: C.red, borderRadius: 10, cursor: 'pointer' }}>
          <Trash2 size={16}/>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 800 }}>الخلفية</span>
        <input type="color" value={vendor.bg || '#FFF8E8'} onChange={e => patchVendor({ bg: e.target.value })} style={{ width: 50, height: 34, padding: 0, border: 'none', background: 'transparent' }}/>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 800 }}>صورة (https://...)</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <InlineField value={vendor.image || ''} placeholder="https://..." onSave={v => patchVendor({ image: v })}/>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800 }}>
          <input type="checkbox" checked={vendor.available !== false} onChange={e => patchVendor({ available: e.target.checked })}/>
          مرئي
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(vendor.items || []).map(item => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 40px', gap: 8, alignItems: 'center', opacity: item.available === false ? 0.5 : 1 }}>
            <InlineField value={item.name} placeholder="اسم الصنف" onSave={v => patchItem(item.id, { name: v })}/>
            <InlineField value={item.price} type="number" placeholder="السعر" coerce={parseFloat} onSave={v => patchItem(item.id, { price: v })}/>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 800 }}>
              <input type="checkbox" checked={item.available !== false} onChange={e => patchItem(item.id, { available: e.target.checked })}/>
              مرئي
            </label>
            <button onClick={() => deleteItem(item.id)} style={{ border: 'none', background: C.redLight, color: C.red, borderRadius: 10, cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>

      <GhostBtn onClick={addItem} disabled={busy} style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}>
        <Plus size={14}/> إضافة صنف
      </GhostBtn>
      {errorMsg && <div style={{ marginTop: 8, color: C.red, fontSize: 12 }}>{errorMsg}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Verify the build still passes**

```bash
npx vite build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/admin/menu/VendorCard.jsx
git commit -m "feat(admin-menu): add VendorCard editor with inline items"
```

---

## Task 9: `MenuSettingsTab` and tab registration

**Files:**
- Create: `src/admin/MenuSettingsTab.jsx`
- Modify: `src/admin/AdminPage.jsx`

- [ ] **Step 1: Write the tab component**

Create `src/admin/MenuSettingsTab.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { C } from '../constants/colors.js'
import { api } from '../api/client.js'
import { GhostBtn } from '../components/Btn.jsx'
import VendorCard from './menu/VendorCard.jsx'
import InlineField from './menu/InlineField.jsx'

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: '#FFF', borderRadius: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', marginBottom: 20, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'start', padding: '14px 18px', border: 'none', background: 'transparent', fontWeight: 900, fontSize: 16, color: C.dark, cursor: 'pointer' }}>
        {open ? '▼' : '▶'} {title}
      </button>
      {open && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </div>
  )
}

export default function MenuSettingsTab() {
  const [rests, setRests] = useState([])
  const [breadTypes, setBreadTypes] = useState([])
  const [drinks, setDrinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const load = async () => {
    try {
      const s = await api.getSettings()
      setRests(s.rests || [])
      setBreadTypes(s.bread_types || [])
      setDrinks(s.drinks || [])
    } catch (e) {
      setErrorMsg('فشل تحميل البيانات')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const addVendor = async () => {
    try {
      const res = await api.createVendor({ name: 'مطعم جديد' })
      setRests(prev => [...prev, res.vendor])
    } catch (e) { alert(e?.data?.message || 'فشل الإضافة') }
  }

  const addBread = async () => {
    try {
      const res = await api.createBread({ ar: 'عيش جديد', color: '#B83A0A' })
      setBreadTypes(prev => [...prev, res.bread])
    } catch (e) { alert(e?.data?.message || 'فشل الإضافة') }
  }

  const addDrink = async () => {
    try {
      const res = await api.createDrink({ name: 'مشروب جديد', emoji: '🥤' })
      setDrinks(prev => [...prev, res.drink])
    } catch (e) { alert(e?.data?.message || 'فشل الإضافة') }
  }

  const deleteBread = async id => {
    if (!confirm('متأكد تمسحه؟')) return
    try {
      await api.deleteBread(id)
      setBreadTypes(prev => prev.filter(b => b.id !== id))
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`مستخدم في ${e.data.sessions.length} جلسة. تخفيه؟`)) {
          await api.updateBread(id, { available: false })
          setBreadTypes(prev => prev.map(b => b.id === id ? { ...b, available: false } : b))
        }
      } else alert(e?.data?.message || 'فشل الحذف')
    }
  }

  const deleteDrink = async id => {
    if (!confirm('متأكد تمسحه؟')) return
    try {
      await api.deleteDrink(id)
      setDrinks(prev => prev.filter(d => d.id !== id))
    } catch (e) {
      if (e.status === 409) {
        if (confirm(`مستخدم في ${e.data.sessions.length} جلسة. تخفيه؟`)) {
          await api.updateDrink(id, { available: false })
          setDrinks(prev => prev.map(d => d.id === id ? { ...d, available: false } : d))
        }
      } else alert(e?.data?.message || 'فشل الحذف')
    }
  }

  const patchBread = async (id, patch) => {
    const res = await api.updateBread(id, patch)
    setBreadTypes(prev => prev.map(b => b.id === id ? { ...b, ...res.bread } : b))
  }

  const patchDrink = async (id, patch) => {
    const res = await api.updateDrink(id, patch)
    setDrinks(prev => prev.map(d => d.id === id ? { ...d, ...res.drink } : d))
  }

  const replaceVendor = nextVendor =>
    setRests(prev => prev.map(v => v.id === nextVendor.id ? nextVendor : v))

  const removeVendor = id =>
    setRests(prev => prev.filter(v => v.id !== id))

  if (loading) return <div style={{ padding: 24, color: C.muted }}>...جاري التحميل</div>
  if (errorMsg) return <div style={{ padding: 24, color: C.red }}>{errorMsg}</div>

  return (
    <div style={{ padding: '0 24px 40px' }}>
      <Section title={`المطاعم / الأماكن (${rests.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rests.map(v => (
            <VendorCard key={v.id} vendor={v} onChange={replaceVendor} onRemove={() => removeVendor(v.id)}/>
          ))}
        </div>
        <GhostBtn onClick={addVendor} style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>
          <Plus size={16}/> إضافة مطعم
        </GhostBtn>
      </Section>

      <Section title={`أنواع العيش (${breadTypes.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {breadTypes.map(b => (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 42px', gap: 8, alignItems: 'center', opacity: b.available === false ? 0.5 : 1 }}>
              <InlineField value={b.ar} placeholder="اسم النوع" onSave={v => patchBread(b.id, { ar: v })}/>
              <input type="color" value={b.color || '#B83A0A'} onChange={e => patchBread(b.id, { color: e.target.value, light: `${e.target.value}11` })} style={{ width: '100%', height: 38, padding: 0, border: 'none', background: 'transparent' }}/>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 800 }}>
                <input type="checkbox" checked={b.available !== false} onChange={e => patchBread(b.id, { available: e.target.checked })}/>
                مرئي
              </label>
              <button onClick={() => deleteBread(b.id)} style={{ border: 'none', background: C.redLight, color: C.red, borderRadius: 10, height: 38, cursor: 'pointer' }}>
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
        </div>
        <GhostBtn onClick={addBread} style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>
          <Plus size={16}/> إضافة نوع عيش
        </GhostBtn>
      </Section>

      <Section title={`المشروبات (${drinks.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {drinks.map(d => (
            <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 60px 42px', gap: 8, alignItems: 'center', opacity: d.available === false ? 0.5 : 1 }}>
              <InlineField value={d.emoji || ''} placeholder="🥤" style={{ textAlign: 'center' }} onSave={v => patchDrink(d.id, { emoji: v })}/>
              <InlineField value={d.name} placeholder="اسم المشروب" onSave={v => patchDrink(d.id, { name: v })}/>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 800 }}>
                <input type="checkbox" checked={d.available !== false} onChange={e => patchDrink(d.id, { available: e.target.checked })}/>
                مرئي
              </label>
              <button onClick={() => deleteDrink(d.id)} style={{ border: 'none', background: C.redLight, color: C.red, borderRadius: 10, height: 38, cursor: 'pointer' }}>
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
        </div>
        <GhostBtn onClick={addDrink} style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>
          <Plus size={16}/> إضافة مشروب
        </GhostBtn>
      </Section>
    </div>
  )
}
```

- [ ] **Step 2: Register the tab in `src/admin/AdminPage.jsx`**

Add the import near the other admin tab imports (after the `OrderStatusTab` import around line 17):

```jsx
import MenuSettingsTab from './MenuSettingsTab.jsx'
```

If `Coffee` isn't already in the lucide-react import list at the top of the file, leave it as-is — we'll use the already-imported `Settings` icon. Edit the tab nav array (currently around line 711):

Replace:

```jsx
        {[
          { id: 'sessions', label: 'الجلسات', icon: Users },
          { id: 'analytics', label: 'إحصائيات', icon: FileText },
          { id: 'promo', label: 'كوبونات', icon: Wallet },
          { id: 'status', label: 'حالة الطلبات', icon: Clock },
        ].map(tab => (
```

With:

```jsx
        {[
          { id: 'sessions', label: 'الجلسات', icon: Users },
          { id: 'analytics', label: 'إحصائيات', icon: FileText },
          { id: 'promo', label: 'كوبونات', icon: Wallet },
          { id: 'status', label: 'حالة الطلبات', icon: Clock },
          { id: 'menu', label: 'إعدادات القائمة', icon: Settings },
        ].map(tab => (
```

Add the panel render alongside the others (currently around line 1041):

Replace:

```jsx
      {activeAdminTab === 'analytics' && <AnalyticsTab sid={sid} />}
      {activeAdminTab === 'promo' && <PromoCodesTab promoCodes={promoCodes} />}
      {activeAdminTab === 'status' && <OrderStatusTab sid={sid} />}
```

With:

```jsx
      {activeAdminTab === 'analytics' && <AnalyticsTab sid={sid} />}
      {activeAdminTab === 'promo' && <PromoCodesTab promoCodes={promoCodes} />}
      {activeAdminTab === 'status' && <OrderStatusTab sid={sid} />}
      {activeAdminTab === 'menu' && <MenuSettingsTab />}
```

- [ ] **Step 3: Build + browser smoke test**

```bash
npx vite build 2>&1 | tail -5
```

Expected: build succeeds. Then in a browser:

1. Open `http://localhost:3000/?admin=1`, log in.
2. Click the **إعدادات القائمة** tab — sections render with current data.
3. Click **إضافة مطعم** — a new vendor appears at the bottom; the name field is editable.
4. Edit the new vendor's name to "Plan Test"; lose focus — see ✓ briefly.
5. Reload the page — the rename persists.
6. Click the trash icon on the new vendor → confirm → vendor disappears.
7. Repeat for one bread type and one drink.

- [ ] **Step 4: Commit**

```bash
git add src/admin/MenuSettingsTab.jsx src/admin/AdminPage.jsx
git commit -m "feat(admin-menu): add MenuSettingsTab and register in admin nav"
```

---

## Task 10: User-side filter for `available !== false`

**Files:**
- Modify: `src/screens/UserApp.jsx`

- [ ] **Step 1: Filter on the settings response**

Locate the `useEffect` that calls `api.getSettings()` (currently lines 91–96):

```jsx
    api.getSettings().then(s => {
      if (s.bread_types) setBreadTypes(s.bread_types)
      if (s.rests) setRests(s.rests)
      if (s.drinks) setDrinks(s.drinks)
    })
```

Replace with:

```jsx
    api.getSettings().then(s => {
      const isAvail = x => x.available !== false
      if (s.bread_types) setBreadTypes(s.bread_types.filter(isAvail))
      if (s.rests) {
        const visible = s.rests
          .filter(isAvail)
          .map(r => ({ ...r, items: (r.items || []).filter(isAvail) }))
        setRests(visible)
      }
      if (s.drinks) setDrinkTypes(s.drinks.filter(isAvail))
    })
```

(Note the existing code calls `setDrinkTypes` already; this matches.)

- [ ] **Step 2: Browser smoke test the filter**

1. In the admin tab, edit any vendor and uncheck **مرئي**.
2. Open a fresh user tab at `http://localhost:3000/?s=test123` (any session id).
3. Walk through to the home screen — the hidden vendor should not appear in the grid.
4. Re-check **مرئي** in admin; reload the user tab — vendor reappears.
5. Hide one item inside a vendor; confirm only that item disappears from the menu.

Already-submitted lines that referenced a now-hidden vendor or item still render correctly because they carry their own `iname`/`price` snapshot — verify by submitting an order, then hiding the vendor, then refreshing the submitted screen.

- [ ] **Step 3: Commit**

```bash
git add src/screens/UserApp.jsx
git commit -m "feat(admin-menu): hide unavailable vendors/items/drinks from users

Filters available!==false at settings load time. Already-submitted
orders are unaffected because lines carry their own snapshots."
```

---

## Task 11: Remove the old `showSettings` modal and dead state

**Files:**
- Modify: `src/admin/AdminPage.jsx`

The old hidden modal (lines ~1081–1184), its trigger button, and its supporting state/helpers are now obsolete. Removing them lands as one focused commit.

- [ ] **Step 1: Find the trigger that opens the old modal**

```bash
grep -n "setShowSettings(true)" src/admin/AdminPage.jsx
```

Note the line number(s). There may be a button in the session header or a settings icon; remove just that one button (its surrounding JSX should still parse).

- [ ] **Step 2: Remove the modal block**

Delete the entire `{showSettings && ( ... )}` JSX block — it begins at the `{showSettings && (` line and ends at the matching `)}` (currently lines ~1081 to ~1184). The block is the last child of the outer admin `<div>`, so removing it should leave a clean `</div>` followed by `)`.

- [ ] **Step 3: Remove the now-dead state and helpers**

In the state declarations (top of `AdminPage` component), delete these lines:

```jsx
  const [showSettings, setShowSettings] = useState(false)
  const [menuTab, setMenuTab] = useState('rests')
  const [newBread, setNewBread] = useState({ ar:'', color:'#B83A0A' })
  const [savingSettings, setSavingSettings] = useState(false)
```

Delete the `saveSettings`, `updateRest`, `updateDrink`, and any `addBread` helper that was used only by the old modal. Also delete:

```jsx
  const [breadTypes, setBreadTypes] = useState([])
  const [rests, setRests] = useState([])
  const [drinks, setDrinks] = useState([])
```

**only if** they are no longer read by anything else in `AdminPage.jsx`. Check first:

```bash
grep -nE 'breadTypes|rests|drinks' src/admin/AdminPage.jsx | grep -v 'setBreadTypes\|setRests\|setDrinks'
```

`breadTypes` is read by `getDrinkBreakdown`, `getRestaurantBreakdown`, and `<CombinedTotals breadTypes=...>` rendering inside the session view. **Keep these states**, but remove the `setBreadTypes`/`setRests`/`setDrinks` calls that fed the old modal at lines 200–202 and 223–225 only if `MenuSettingsTab` is the sole writer. The session view still needs them to render its own summary, so the simplest path is:

- Keep the existing `setBreadTypes(settingsRes.bread_types || [])` etc. in the `refreshAdminSessions` flow — they feed the session-view summary.
- Just delete the old modal and the four state vars listed above (`showSettings`, `menuTab`, `newBread`, `savingSettings`) plus the helpers (`saveSettings`, `updateRest`, `updateDrink`, `addBread`).

- [ ] **Step 4: Build + smoke**

```bash
npx vite build 2>&1 | tail -5
```

Expected: build succeeds. Then reload the admin page in the browser:

1. The session view still renders correctly (vendor breakdown, drink breakdown, combined totals).
2. The old "Settings" button is gone.
3. The new **إعدادات القائمة** tab still works.
4. Editing in the new tab, then switching back to **الجلسات**, still shows the session summary correctly.

- [ ] **Step 5: Commit**

```bash
git add src/admin/AdminPage.jsx
git commit -m "refactor(admin-menu): remove obsolete settings modal

Replaced by MenuSettingsTab in the previous commit. Drops dead state
(showSettings, menuTab, newBread, savingSettings) and the bulk-save
helpers (saveSettings, updateRest, updateDrink, addBread)."
```

---

## Task 12: Final end-to-end smoke test

- [ ] **Step 1: Reset state**

```bash
# Optional: back up first if you have data you care about
cp data/sandwitchy.db data/sandwitchy.db.bak
```

- [ ] **Step 2: Walk the full path manually**

In the browser:

1. Open `/?admin=1`, log in, go to **إعدادات القائمة**.
2. **Add a vendor:** name "مطعم تجريبي", emoji "🌯", delivery 18, color #FFE8B0. Reload — persists.
3. **Add 2 items** to it: "كباب" 30 ج, "شاورما" 25 ج.
4. **Add a bread type:** name "عيش تنور", color #5B2EA0.
5. **Add a drink:** name "موهيتو", emoji "🌿".
6. Open `/?s=smoke1` in a different tab/incognito. Click into the new vendor — both items show. Bread types include the new entry. Drinks include the new entry.
7. **Submit an order** with one of those items.
8. Back in admin, try to **delete the vendor**: expect 409 → "تخفيه؟" → say yes. Vendor flips to dim/hidden state.
9. Reload the user tab — the vendor disappears from the grid, but the submitted-order screen still shows the line correctly.
10. Re-enable the vendor (check **مرئي**); reload user tab — vendor reappears.
11. **Validation:** in admin, set a vendor's bg color via DevTools to "red" via direct `api.updateVendor(id, { bg: 'red' })` in the console — expect a 400 error to surface in the console.
12. **Hard delete success path:** create another vendor, do not order from it, delete it — expect immediate disappearance with no prompt.

- [ ] **Step 3: If anything in step 2 fails, file it as a follow-up bug**

Don't try to fix as part of this plan — Phase 1 is complete when the happy paths pass. Bugs go in a follow-up commit.

- [ ] **Step 4: Tag the phase**

```bash
git tag phase-1-admin-menu-management
git log --oneline phase-1-admin-menu-management~12..phase-1-admin-menu-management
```

Expected: 11 commits from Tasks 1–11 (12 if you commit any final tweak from the smoke test).

---

## Notes for the implementer

- **Where to insert in `server.js`.** All 12 endpoints sit in one block, after the existing `POST /api/settings` route (line ~1425) and before the votes routes (line ~1427). Keep them grouped under a single `// ── Admin Menu CRUD ──` header for easy navigation.
- **The duplicate `vote` entry in `client.js`.** There's a duplicate `getVotes`/`vote` near the bottom of the `api` object (lines ~83–84). Don't touch it as part of this plan — it's pre-existing and out of scope.
- **In-memory fallback.** All new endpoints write through `getSettingValue`/`updateSettingValue`, which already handle the `!db` branch. No extra in-memory code needed.
- **Admin cookie auth in dev.** `npm run client` runs Vite on :5173 with a proxy to :3000, so the cookie set during admin login from `/?admin=1` works across both ports. No CORS workarounds needed.
- **Restart vs. hot reload.** Backend changes require a server restart (`Ctrl-C` and re-run `npm run dev`) — there is no nodemon configured. Frontend changes hot-reload via Vite if you're running `npm run client` in another terminal.
