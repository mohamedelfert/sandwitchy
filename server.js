const express = require('express')
const cors = require('cors')
const path = require('path')
const os = require('os')
const fs = require('fs')
const https = require('https')
const http = require('http')
const crypto = require('crypto')

const app = express()
const PORT = process.env.PORT || 3000
const N8N_WEBHOOK = process.env.N8N_WEBHOOK || ''
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456789'
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || `sandwitchy-${os.hostname()}-${process.pid}`
const ADMIN_SESSION_TTL_MS = Number.parseInt(process.env.ADMIN_SESSION_TTL_MS || `${7 * 24 * 60 * 60 * 1000}`, 10)
const ADMIN_COOKIE_NAME = 'sandwitchy_admin'
const USING_DEFAULT_ADMIN_CREDENTIALS = !process.env.ADMIN_USERNAME && !process.env.ADMIN_PASSWORD

const DEFAULT_BREAD_TYPES = [
  { id: 'baladi', ar: 'عيش بلدي', color: '#B83A0A', light: '#FDEEE8' },
  { id: 'shamy', ar: 'عيش شامي', color: '#6B2EA0', light: '#F2E8FF' },
  { id: 'souri', ar: 'عيش سوري', color: '#0A7C5A', light: '#E4F5EF' },
]

const DEFAULT_RESTS = [
  {
    id: 1,
    name: 'حماده الواحي',
    emoji: '🔥',
    bg: '#FFF0E8',
    hasBread: true,
    delivery: 12,
    items: [
      { id: 'hw1', name: 'طعمية', price: 11 },
      { id: 'hw2', name: 'فول', price: 10 },
      { id: 'hw3', name: 'فول سلطة', price: 12 },
      { id: 'hw4', name: 'فول بالبيض', price: 17 },
      { id: 'hw5', name: 'بطاطس صوابع كاتشب', price: 14 },
      { id: 'hw6', name: 'بطاطس صوابع كاتشب ومايونيز', price: 16 },
    ],
  },
  {
    id: 2,
    name: 'بطاطس السعد',
    emoji: '🥔',
    bg: '#FFFAE8',
    hasBread: false,
    delivery: 0,
    items: [
      { id: 's1', name: 'بطاطس سوري توابل', price: 20 },
      { id: 's2', name: 'بطاطس بلدي توابل', price: 18 },
      { id: 's3', name: 'بطاطس سوري توابل التميت', price: 22 },
    ],
  },
]

const DEFAULT_DRINKS = [
  { id: 'd1', name: 'شاي', emoji: '🍵' },
  { id: 'd2', name: 'شاي بلبن', emoji: '🍵' },
  { id: 'd3', name: 'قهوة سادة', emoji: '☕' },
  { id: 'd4', name: 'قهوة مظبوط', emoji: '☕' },
  { id: 'd5', name: 'قهوة مانو', emoji: '☕' },
  { id: 'd6', name: 'قهوة باللبن', emoji: '☕' },
  { id: 'd7', name: 'نسكافيه', emoji: '☕' },
  { id: 'd8', name: 'نسكافيه باللبن', emoji: '☕' },
  { id: 'd9', name: 'آيس كوفي', emoji: '🧋' },
  { id: 'd10', name: 'نعناع أخضر', emoji: '🌿' },
  { id: 'd11', name: 'ينسون', emoji: '🌾' },
  { id: 'd12', name: 'كركديه', emoji: '🌺' },
]

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '100kb' }))

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function normalizeTs(value) {
  if (!value) return null
  return value < 1e12 ? value * 1000 : value
}

function getNow() {
  return Date.now()
}

function getOrderItemsTotal(order) {
  return (order?.lines || []).reduce((sum, line) => sum + (line.price || 0) * line.qty, 0)
}

function getUniqueRestaurantIds(lines) {
  return [...new Set((lines || []).map(line => String(line.rid)))]
}

function getPerPersonDelivery(delivery, orders) {
  const count = Object.keys(orders || {}).length
  return count > 0 ? (delivery || 0) / count : 0
}

function createEmptyPayload() {
  return { orders: {}, delivery: 0, status: 'open', deadline: null, expected: [], title: '', announcement: '' }
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value) {
  const padded = value + '==='.slice((value.length + 3) % 4)
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function signTokenPayload(payload) {
  return crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createAdminToken(username) {
  const payload = toBase64Url(JSON.stringify({ u: username, exp: getNow() + ADMIN_SESSION_TTL_MS }))
  const signature = signTokenPayload(payload)
  return `${payload}.${signature}`
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = signTokenPayload(payload)
  const expectedBuffer = Buffer.from(expected)
  const givenBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== givenBuffer.length) return null
  if (!crypto.timingSafeEqual(expectedBuffer, givenBuffer)) return null

  try {
    const parsed = JSON.parse(fromBase64Url(payload))
    if (!parsed?.u || !parsed?.exp || parsed.exp < getNow()) return null
    return parsed
  } catch (_) {
    return null
  }
}

function parseCookies(header = '') {
  return header
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf('=')
      if (idx === -1) return acc
      acc[part.slice(0, idx)] = decodeURIComponent(part.slice(idx + 1))
      return acc
    }, {})
}

function setCookie(res, name, value, maxAgeMs) {
  const cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`,
  ]
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) cookie.push('Secure')
  res.setHeader('Set-Cookie', cookie.join('; '))
}

function clearCookie(res, name) {
  const cookie = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) cookie.push('Secure')
  res.setHeader('Set-Cookie', cookie.join('; '))
}

function getAdminAuth(req) {
  const cookies = parseCookies(req.headers.cookie || '')
  return verifyAdminToken(cookies[ADMIN_COOKIE_NAME])
}

function requireAdmin(req, res, next) {
  const auth = getAdminAuth(req)
  if (!auth) return res.status(401).json({ ok: false, error: 'unauthorized' })
  req.admin = auth
  next()
}

let db
const memStore = {}
const memSettings = {
  bread_types: deepClone(DEFAULT_BREAD_TYPES),
  rests: deepClone(DEFAULT_RESTS),
  drinks: deepClone(DEFAULT_DRINKS),
}
const memOrderHistory = []

try {
  if (process.env.VERCEL) throw new Error('Vercel environment detected. Forcing in-memory store.')
  const Database = require('better-sqlite3')
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'sandwitchy.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      delivery REAL DEFAULT 0,
      status TEXT DEFAULT 'open',
      deadline TEXT DEFAULT NULL,
      title TEXT DEFAULT '',
      announcement TEXT DEFAULT '',
      created INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS orders (
      sid TEXT,
      uid TEXT,
      name TEXT,
      telegram TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      lines TEXT DEFAULT '[]',
      drinks TEXT DEFAULT '{}',
      notes TEXT DEFAULT '{}',
      submitted_at INTEGER,
      paid INTEGER DEFAULT 0,
      paid_at INTEGER DEFAULT NULL,
      paid_amount REAL DEFAULT NULL,
      PRIMARY KEY (sid, uid)
    );
    CREATE TABLE IF NOT EXISTS expected_members (
      sid TEXT,
      name TEXT,
      PRIMARY KEY (sid, name)
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS order_history (
      hid TEXT PRIMARY KEY,
      name TEXT,
      session_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      lines TEXT DEFAULT '[]',
      drinks TEXT DEFAULT '{}',
      notes TEXT DEFAULT '{}'
    );
  `)

  try { db.exec("ALTER TABLE orders ADD COLUMN telegram TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE orders ADD COLUMN phone TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE orders ADD COLUMN paid INTEGER DEFAULT 0") } catch (_) {}
  try { db.exec("ALTER TABLE orders ADD COLUMN paid_at INTEGER DEFAULT NULL") } catch (_) {}
  try { db.exec("ALTER TABLE orders ADD COLUMN paid_amount REAL DEFAULT NULL") } catch (_) {}
  try { db.exec("ALTER TABLE sessions ADD COLUMN title TEXT DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE sessions ADD COLUMN announcement TEXT DEFAULT ''") } catch (_) {}

  const seedSetting = (key, value) => {
    const row = db.prepare('SELECT 1 FROM app_settings WHERE key=?').get(key)
    if (!row) {
      db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
    }
  }

  seedSetting('bread_types', DEFAULT_BREAD_TYPES)
  seedSetting('rests', DEFAULT_RESTS)
  seedSetting('drinks', DEFAULT_DRINKS)

  console.log('[db]     SQLite ready →', dbPath)
} catch (error) {
  console.warn('[db]     better-sqlite3 not available, using in-memory store:', error.message)
  db = null
}

function getMemSession(sid, create = true) {
  if (!memStore[sid] && create) {
    memStore[sid] = {
      orders: {},
      delivery: 0,
      status: 'open',
      deadline: null,
      title: '',
      announcement: '',
      expectedMembers: [],
      created: getNow(),
    }
  }
  return memStore[sid] || null
}

function getSettingValue(key, fallback) {
  if (!db) return deepClone(memSettings[key] ?? fallback)
  const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(key)
  if (!row) return deepClone(fallback)
  return safeJsonParse(row.value, deepClone(fallback))
}

function updateSettingValue(key, value) {
  if (!db) {
    memSettings[key] = deepClone(value)
    return
  }
  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, JSON.stringify(value))
}

function getSession(sid, { create = true } = {}) {
  if (!db) {
    const mem = getMemSession(sid, create)
    return mem ? { sid, delivery: mem.delivery, status: mem.status, deadline: mem.deadline, title: mem.title || '', announcement: mem.announcement || '', created: mem.created } : null
  }

  const row = db.prepare('SELECT * FROM sessions WHERE sid=?').get(sid)
  if (!row) {
    if (!create) return null
    db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
    return { sid, delivery: 0, status: 'open', deadline: null, title: '', announcement: '', created: getNow() }
  }
  return {
    sid: row.sid,
    delivery: row.delivery || 0,
    status: row.status || 'open',
    deadline: row.deadline || null,
    title: row.title || '',
    announcement: row.announcement || '',
    created: normalizeTs(row.created),
  }
}

function getOrders(sid) {
  if (!db) {
    const mem = getMemSession(sid, false)
    return deepClone(mem?.orders || {})
  }

  const rows = db.prepare('SELECT * FROM orders WHERE sid=?').all(sid)
  const orders = {}
  rows.forEach(row => {
    orders[row.uid] = {
      name: row.name,
      telegram: row.telegram || '',
      phone: row.phone || '',
      lines: safeJsonParse(row.lines, []),
      drinks: safeJsonParse(row.drinks, {}),
      notes: safeJsonParse(row.notes, {}),
      submittedAt: row.submitted_at,
      paid: !!row.paid,
      paidAt: row.paid_at || null,
      paidAmount: row.paid_amount ?? null,
    }
  })
  return orders
}

function setOrder(sid, uid, data) {
  const payload = {
    name: data.name,
    telegram: data.telegram || '',
    phone: data.phone || '',
    lines: data.lines || [],
    drinks: data.drinks || {},
    notes: data.notes || {},
    submittedAt: data.submittedAt || getNow(),
    paid: !!data.paid,
    paidAt: data.paidAt || null,
    paidAmount: data.paidAmount ?? null,
  }

  if (!db) {
    const mem = getMemSession(sid)
    mem.orders[uid] = deepClone(payload)
    return
  }

  db.prepare(`
    INSERT INTO orders (sid, uid, name, telegram, phone, lines, drinks, notes, submitted_at, paid, paid_at, paid_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sid, uid) DO UPDATE SET
      name=excluded.name,
      telegram=excluded.telegram,
      phone=excluded.phone,
      lines=excluded.lines,
      drinks=excluded.drinks,
      notes=excluded.notes,
      submitted_at=excluded.submitted_at,
      paid=excluded.paid,
      paid_at=excluded.paid_at,
      paid_amount=excluded.paid_amount
  `).run(
    sid,
    uid,
    payload.name,
    payload.telegram,
    payload.phone,
    JSON.stringify(payload.lines),
    JSON.stringify(payload.drinks),
    JSON.stringify(payload.notes),
    payload.submittedAt,
    payload.paid ? 1 : 0,
    payload.paidAt,
    payload.paidAmount
  )
}

function delOrder(sid, uid) {
  if (!db) {
    const mem = getMemSession(sid, false)
    if (mem) delete mem.orders[uid]
    return
  }
  db.prepare('DELETE FROM orders WHERE sid=? AND uid=?').run(sid, uid)
}

function setPayment(sid, uid, { paid, amount }) {
  if (!db) {
    const mem = getMemSession(sid, false)
    if (!mem?.orders?.[uid]) return false
    mem.orders[uid].paid = !!paid
    mem.orders[uid].paidAt = paid ? getNow() : null
    mem.orders[uid].paidAmount = paid ? amount ?? null : null
    return true
  }

  const row = db.prepare('SELECT 1 FROM orders WHERE sid=? AND uid=?').get(sid, uid)
  if (!row) return false
  db.prepare(`
    UPDATE orders
    SET paid=?, paid_at=?, paid_amount=?
    WHERE sid=? AND uid=?
  `).run(paid ? 1 : 0, paid ? getNow() : null, paid ? amount ?? null : null, sid, uid)
  return true
}

function setDelivery(sid, amount) {
  if (!db) {
    getMemSession(sid).delivery = amount
    return
  }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET delivery=? WHERE sid=?').run(amount, sid)
}

function setStatus(sid, status) {
  if (!db) {
    getMemSession(sid).status = status
    return
  }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET status=? WHERE sid=?').run(status, sid)
}

function setDeadline(sid, deadline) {
  if (!db) {
    getMemSession(sid).deadline = deadline
    return
  }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET deadline=? WHERE sid=?').run(deadline, sid)
}

function setSessionMeta(sid, { title, announcement }) {
  if (!db) {
    const session = getMemSession(sid)
    session.title = title
    session.announcement = announcement
    return
  }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET title=?, announcement=? WHERE sid=?').run(title, announcement, sid)
}

function getExpected(sid) {
  if (!db) {
    const mem = getMemSession(sid, false)
    return deepClone(mem?.expectedMembers || [])
  }
  return db.prepare('SELECT name FROM expected_members WHERE sid=? ORDER BY rowid ASC').all(sid).map(row => row.name)
}

function setExpected(sid, names) {
  if (!db) {
    getMemSession(sid).expectedMembers = deepClone(names)
    return
  }
  db.prepare('DELETE FROM expected_members WHERE sid=?').run(sid)
  const insert = db.prepare('INSERT OR IGNORE INTO expected_members (sid, name) VALUES (?, ?)')
  names.forEach(name => insert.run(sid, name))
}

function deleteSession(sid) {
  if (!db) {
    delete memStore[sid]
    return
  }
  db.prepare('DELETE FROM sessions WHERE sid=?').run(sid)
  db.prepare('DELETE FROM orders WHERE sid=?').run(sid)
  db.prepare('DELETE FROM expected_members WHERE sid=?').run(sid)
}

function saveOrderHistory(name, sid, lines, drinks, notes) {
  const record = {
    hid: `h_${getNow()}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    sessionId: sid,
    createdAt: getNow(),
    lines: deepClone(lines || []),
    drinks: deepClone(drinks || {}),
    notes: deepClone(notes || {}),
  }

  if (!db) {
    memOrderHistory.unshift(record)
    memOrderHistory.splice(20)
    return
  }

  db.prepare(`
    INSERT INTO order_history (hid, name, session_id, lines, drinks, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(record.hid, record.name, record.sessionId, JSON.stringify(record.lines), JSON.stringify(record.drinks), JSON.stringify(record.notes), record.createdAt)
}

function getOrderHistory(name) {
  if (!db) {
    return memOrderHistory
      .filter(record => record.name === name)
      .slice(0, 10)
      .map(record => deepClone(record))
  }

  return db.prepare(`
    SELECT * FROM order_history
    WHERE name=?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(name).map(row => ({
    hid: row.hid,
    sessionId: row.session_id,
    createdAt: normalizeTs(row.created_at),
    lines: safeJsonParse(row.lines, []),
    drinks: safeJsonParse(row.drinks, {}),
    notes: safeJsonParse(row.notes, {}),
  }))
}

function buildPayload(sid, create = true) {
  const session = getSession(sid, { create })
  if (!session && !create) return createEmptyPayload()
  return {
    orders: getOrders(sid),
    delivery: session?.delivery || 0,
    status: session?.status || 'open',
    deadline: session?.deadline || null,
    expected: getExpected(sid),
    title: session?.title || '',
    announcement: session?.announcement || '',
  }
}

function maybeAutoApplyDelivery(sid, lines) {
  const session = getSession(sid)
  if ((session?.delivery || 0) > 0) return
  const rests = getSettingValue('rests', DEFAULT_RESTS)
  const amount = getUniqueRestaurantIds(lines).reduce((max, restId) => {
    const match = rests.find(rest => String(rest.id) === String(restId))
    return Math.max(max, match?.delivery || 0)
  }, 0)
  if (amount > 0) setDelivery(sid, amount)
}

function getSessionIds({ openOnly = false } = {}) {
  if (!db) {
    return Object.entries(memStore)
      .filter(([, session]) => !openOnly || session.status === 'open')
      .sort(([, a], [, b]) => (b.created || 0) - (a.created || 0))
      .map(([sid]) => sid)
  }

  const rows = db.prepare(`
    SELECT sid
    FROM sessions
    ${openOnly ? "WHERE status='open'" : ''}
    ORDER BY created DESC
  `).all()
  return rows.map(row => row.sid)
}

function buildSessionSummary(sid) {
  const payload = buildPayload(sid, false)
  const session = getSession(sid, { create: false })
  const orders = Object.entries(payload.orders || {})
    .map(([uid, order]) => ({ uid, ...order }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))

  const itemsTotal = orders.reduce((sum, order) => sum + getOrderItemsTotal(order), 0)
  const delivery = payload.delivery || 0
  const expected = payload.expected || []
  const orderedNames = new Set(orders.map(order => order.name))
  const missing = expected.filter(name => !orderedNames.has(name))

  return {
    sid,
    status: payload.status || 'open',
    deadline: payload.deadline || null,
    title: payload.title || '',
    announcement: payload.announcement || '',
    delivery,
    count: orders.length,
    itemsTotal,
    total: itemsTotal + delivery,
    expectedCount: expected.length,
    missingCount: missing.length,
    paidCount: orders.filter(order => order.paid).length,
    unpaidCount: orders.filter(order => !order.paid).length,
    names: orders.map(order => order.name),
    lastSubmittedAt: orders[0]?.submittedAt || null,
    createdAt: session?.created || null,
  }
}

function getPublicActiveSessions() {
  return getSessionIds({ openOnly: true })
    .map(sid => buildSessionSummary(sid))
    .filter(session => session.count > 0)
    .map(session => ({ sid: session.sid, count: session.count, title: session.title || '' }))
}

function getAdminSessionSummaries() {
  return getSessionIds({ openOnly: false })
    .map(sid => buildSessionSummary(sid))
    .filter(session => session.count > 0 || session.status === 'open')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      return (b.lastSubmittedAt || 0) - (a.lastSubmittedAt || 0)
    })
}

function getAllSessions() {
  return getSessionIds({ openOnly: false })
    .map(sid => buildSessionSummary(sid))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      return (b.lastSubmittedAt || 0) - (a.lastSubmittedAt || 0)
    })
}

const clients = {}

function broadcast(sid, create = true) {
  const chunk = `data: ${JSON.stringify(buildPayload(sid, create))}\n\n`
  for (const res of clients[sid] || new Set()) {
    try {
      res.write(chunk)
    } catch (_) {
      clients[sid]?.delete(res)
    }
  }
}

const rlMap = new Map()

function rateLimit(key, max = 20) {
  const now = getNow()
  const entry = rlMap.get(key) || { count: 0, reset: now + 60000 }
  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + 60000
  }
  entry.count += 1
  rlMap.set(key, entry)
  return entry.count > max
}

setInterval(() => {
  const now = getNow()
  for (const [key, value] of rlMap) {
    if (now > value.reset + 60000) rlMap.delete(key)
  }
}, 300000)

setInterval(() => {
  if (!db) return
  const now = new Date().toISOString()
  const rows = db.prepare(`
    SELECT sid
    FROM sessions
    WHERE status='open' AND deadline IS NOT NULL AND deadline <= ?
  `).all(now)

  rows.forEach(({ sid }) => {
    setStatus(sid, 'complete')
    broadcast(sid)
    console.log(`[auto]   session ${sid} completed by deadline`)
    fireN8nWebhook(sid)
  })
}, 10000)

function fireN8nWebhook(sid) {
  if (!N8N_WEBHOOK) {
    console.log('[n8n]    N8N_WEBHOOK not set — skipping')
    return
  }

  const orders = getOrders(sid)
  const session = getSession(sid, { create: false })
  const delivery = session?.delivery || 0
  const numPeople = Object.keys(orders).length
  const perPerson = getPerPersonDelivery(delivery, orders)
  const breadMap = Object.fromEntries(
    getSettingValue('bread_types', DEFAULT_BREAD_TYPES).map(bread => [bread.id, bread.ar])
  )

  const messages = Object.values(orders).map(order => {
    const itemsTotal = getOrderItemsTotal(order)
    const total = itemsTotal + perPerson
    const linesText = (order.lines || [])
      .map(line => {
        const bread = line.bt ? ` (${breadMap[line.bt] || line.bt})` : ''
        const note = (order.notes || {})[line.key] ? ` — 📝 ${(order.notes || {})[line.key]}` : ''
        const price = line.price > 0 ? ` — ${line.price * line.qty} ج` : ''
        return `• ${line.iname}${bread} ×${line.qty}${price}${note}`
      })
      .join('\n')
    const submittedAt = order.submittedAt
      ? new Date(order.submittedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      : ''
    return {
      name: order.name,
      telegram: order.telegram || '',
      phone: order.phone || '',
      total: +total.toFixed(2),
      items_total: itemsTotal,
      delivery: +perPerson.toFixed(2),
      lines_text: linesText,
      session_id: sid,
      submitted_at: submittedAt,
    }
  })

  const body = JSON.stringify({ session_id: sid, delivery, num_people: numPeople, messages })

  try {
    const url = new URL(N8N_WEBHOOK)
    const lib = url.protocol === 'https:' ? https : http
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      response => console.log(`[n8n]    → ${response.statusCode}`)
    )

    req.on('error', error => console.error('[n8n]    error:', error.message))
    req.write(body)
    req.end()
  } catch (error) {
    console.error('[n8n]    failed:', error.message)
  }
}

app.get('/events/:sid', (req, res) => {
  const { sid } = req.params
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
  res.write(`data: ${JSON.stringify(buildPayload(sid, true))}\n\n`)

  if (!clients[sid]) clients[sid] = new Set()
  clients[sid].add(res)

  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch (_) {
      clearInterval(ping)
    }
  }, 20000)

  req.on('close', () => {
    clearInterval(ping)
    clients[sid]?.delete(res)
  })
})

app.get('/api/admin/me', (req, res) => {
  const auth = getAdminAuth(req)
  if (!auth) return res.status(401).json({ ok: false, usingDefaultCredentials: USING_DEFAULT_ADMIN_CREDENTIALS })
  res.json({ ok: true, username: auth.u, usingDefaultCredentials: USING_DEFAULT_ADMIN_CREDENTIALS })
})

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  if (rateLimit(`admin:${ip}`, 10)) return res.status(429).json({ ok: false, error: 'too many requests' })

  const username = String(req.body?.username || '')
  const password = String(req.body?.password || '')
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'invalid credentials' })
  }

  const token = createAdminToken(username)
  setCookie(res, ADMIN_COOKIE_NAME, token, ADMIN_SESSION_TTL_MS)
  res.json({ ok: true, username, usingDefaultCredentials: USING_DEFAULT_ADMIN_CREDENTIALS })
})

app.post('/api/admin/logout', (_req, res) => {
  clearCookie(res, ADMIN_COOKIE_NAME)
  res.json({ ok: true })
})

app.get('/api/admin/sessions', requireAdmin, (_req, res) => {
  res.json({ ok: true, sessions: getAdminSessionSummaries(), usingDefaultCredentials: USING_DEFAULT_ADMIN_CREDENTIALS })
})

app.get('/api/sessions/active', (_req, res) => {
  res.json(getPublicActiveSessions())
})

app.get('/api/sessions', (_req, res) => {
  res.json(getAllSessions())
})

app.get('/api/session/:sid', (req, res) => {
  res.json(buildPayload(req.params.sid, true))
})

app.post('/api/orders/:sid/:uid', (req, res) => {
  const { sid, uid } = req.params
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  if (rateLimit(`order:${ip}`)) return res.status(429).json({ ok: false, error: 'too many requests' })

  if (!req.body?.name || typeof req.body.name !== 'string' || req.body.name.length > 80) {
    return res.status(400).json({ ok: false, error: 'invalid name' })
  }

  setOrder(sid, uid, {
    ...req.body,
    submittedAt: getNow(),
    paid: false,
    paidAt: null,
    paidAmount: null,
  })
  saveOrderHistory(req.body.name, sid, req.body.lines, req.body.drinks, req.body.notes)
  maybeAutoApplyDelivery(sid, req.body.lines)
  broadcast(sid)
  console.log(`[order]  ${sid} | ${req.body.name}${req.body.telegram ? ` @${req.body.telegram}` : ''} | ${(req.body.lines || []).reduce((sum, line) => sum + line.qty, 0)} items`)
  res.json({ ok: true })
})

app.delete('/api/orders/:sid/:uid', requireAdmin, (req, res) => {
  delOrder(req.params.sid, req.params.uid)
  broadcast(req.params.sid)
  res.json({ ok: true })
})

app.patch('/api/orders/:sid/:uid', requireAdmin, (req, res) => {
  const { sid, uid } = req.params
  const orders = getOrders(sid)
  const existing = orders[uid]
  if (!existing) return res.status(404).json({ ok: false })

  setOrder(sid, uid, {
    ...existing,
    lines: req.body.lines || existing.lines,
    notes: req.body.notes || existing.notes,
    drinks: req.body.drinks || existing.drinks,
    submittedAt: getNow(),
    paid: false,
    paidAt: null,
    paidAmount: null,
  })
  broadcast(sid)
  res.json({ ok: true })
})

app.put('/api/orders/:sid/:uid/payment', requireAdmin, (req, res) => {
  const paid = !!req.body?.paid
  const amount = req.body?.amount == null ? null : parseFloat(req.body.amount)
  const ok = setPayment(req.params.sid, req.params.uid, { paid, amount: Number.isFinite(amount) ? amount : null })
  if (!ok) return res.status(404).json({ ok: false })
  broadcast(req.params.sid)
  res.json({ ok: true })
})

app.put('/api/session/:sid/delivery', requireAdmin, (req, res) => {
  const amount = parseFloat(req.body.amount)
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000) return res.status(400).json({ ok: false })
  setDelivery(req.params.sid, amount)
  broadcast(req.params.sid)
  res.json({ ok: true })
})

app.put('/api/session/:sid/complete', requireAdmin, (req, res) => {
  const { sid } = req.params
  setStatus(sid, 'complete')
  broadcast(sid)
  console.log(`[done]   ${sid}`)
  fireN8nWebhook(sid)
  res.json({ ok: true })
})

app.put('/api/session/:sid/reopen', requireAdmin, (req, res) => {
  setStatus(req.params.sid, 'open')
  broadcast(req.params.sid)
  res.json({ ok: true })
})

app.put('/api/session/:sid/deadline', requireAdmin, (req, res) => {
  const deadline = req.body?.deadline || null
  setDeadline(req.params.sid, deadline)
  broadcast(req.params.sid)
  console.log(`[deadline] ${req.params.sid} → ${deadline}`)
  res.json({ ok: true })
})

app.put('/api/session/:sid/meta', requireAdmin, (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : ''
  const announcement = typeof req.body?.announcement === 'string' ? req.body.announcement.trim().slice(0, 500) : ''
  setSessionMeta(req.params.sid, { title, announcement })
  broadcast(req.params.sid)
  res.json({ ok: true })
})

app.put('/api/session/:sid/expected', requireAdmin, (req, res) => {
  const names = (req.body.names || [])
    .filter(name => typeof name === 'string' && name.trim())
    .map(name => name.trim())
  setExpected(req.params.sid, names)
  broadcast(req.params.sid)
  res.json({ ok: true })
})

app.delete('/api/session/:sid', requireAdmin, (req, res) => {
  deleteSession(req.params.sid)
  broadcast(req.params.sid, false)
  console.log(`[reset]  ${req.params.sid}`)
  res.json({ ok: true })
})

app.get('/api/settings', (_req, res) => {
  res.json({
    bread_types: getSettingValue('bread_types', DEFAULT_BREAD_TYPES),
    rests: getSettingValue('rests', DEFAULT_RESTS),
    drinks: getSettingValue('drinks', DEFAULT_DRINKS),
  })
})

app.post('/api/settings', requireAdmin, (req, res) => {
  const { key, value } = req.body || {}
  if (!['bread_types', 'rests', 'drinks'].includes(key)) return res.status(400).json({ ok: false })
  updateSettingValue(key, value)
  res.json({ ok: true })
})

app.get('/api/history/:name', (req, res) => {
  const { name } = req.params
  if (!name || name.length > 80) return res.status(400).json([])
  res.json(getOrderHistory(name))
})

app.post('/api/reorder/:hid', (req, res) => {
  if (!db) {
    const row = memOrderHistory.find(record => record.hid === req.params.hid)
    if (!row) return res.status(404).json({ ok: false })
    return res.json({ lines: deepClone(row.lines), drinks: deepClone(row.drinks), notes: deepClone(row.notes) })
  }

  const row = db.prepare('SELECT * FROM order_history WHERE hid=?').get(req.params.hid)
  if (!row) return res.status(404).json({ ok: false })
  res.json({
    lines: safeJsonParse(row.lines, []),
    drinks: safeJsonParse(row.drinks, {}),
    notes: safeJsonParse(row.notes, {}),
  })
})

app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const ip = Object.values(os.networkInterfaces())
      .flat()
      .find(entry => entry.family === 'IPv4' && !entry.internal)?.address
    console.log('\n  🍽️  طلباتي v2\n')
    console.log(`  Local:   http://localhost:${PORT}`)
    if (ip) console.log(`  Network: http://${ip}:${PORT}`)
    console.log(`\n  Admin:   http://${ip || 'localhost'}:${PORT}/?admin=1`)
    console.log(`  n8n:     ${N8N_WEBHOOK || '⚠️  N8N_WEBHOOK not set'}`)
    console.log(`  SQLite:  ${db ? 'enabled' : 'in-memory fallback'}`)
    if (USING_DEFAULT_ADMIN_CREDENTIALS) {
      console.log('  Admin credentials: using defaults, set ADMIN_USERNAME and ADMIN_PASSWORD for production')
    }
    console.log('')
  })
}

module.exports = app
