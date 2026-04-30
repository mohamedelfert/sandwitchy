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
const JWT_SECRET = process.env.JWT_SECRET || `sandwitchy-jwt-${os.hostname()}-${process.pid}`
const JWT_TTL_MS = Number.parseInt(process.env.JWT_TTL_MS || `${30 * 24 * 60 * 60 * 1000}`, 10)
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
    image: '',
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
  return { orders: {}, delivery: 0, status: 'open', deadline: null, expected: [], title: '', announcement: '', restaurantStatuses: {} }
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

// JWT token helpers for user auth
function createJwtToken(userId) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({ 
    sub: userId, 
    exp: getNow() + JWT_TTL_MS,
    iat: Math.floor(getNow() / 1000)
  }))
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${header}.${payload}.${signature}`
}

function verifyJwtToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  
  const [header, payload, signature] = parts
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null
  
  try {
    const parsed = JSON.parse(fromBase64Url(payload))
    if (!parsed?.sub || !parsed?.exp || parsed.exp < getNow()) return null
    return parsed
  } catch (_) {
    return null
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
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
const memUsers = []
const memAddresses = {}
const memFavorites = []
const memPromoCodes = []
const memOrderStatus = []
const memNotifications = []
const memRestaurantHours = {}

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
      restaurant_statuses TEXT DEFAULT '{}',
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
    CREATE TABLE IF NOT EXISTS votes (
      sid TEXT,
      uid TEXT,
      name TEXT,
      rid INTEGER,
      PRIMARY KEY (sid, uid)
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
   try { db.exec("ALTER TABLE sessions ADD COLUMN restaurant_statuses TEXT DEFAULT '{}'") } catch (_) {}
   
   // New tables for enhanced features
   try {
     db.exec(`
       CREATE TABLE IF NOT EXISTS users (
         id TEXT PRIMARY KEY,
         username TEXT UNIQUE NOT NULL,
         password_hash TEXT NOT NULL,
         phone TEXT DEFAULT '',
         telegram TEXT DEFAULT '',
         email TEXT DEFAULT '',
         created_at INTEGER DEFAULT (unixepoch())
       );
       
       CREATE TABLE IF NOT EXISTS user_addresses (
         id TEXT PRIMARY KEY,
         user_id TEXT NOT NULL,
         label TEXT DEFAULT '',
         address TEXT NOT NULL,
         notes TEXT DEFAULT '',
         is_default INTEGER DEFAULT 0,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       );
       
       CREATE TABLE IF NOT EXISTS favorites (
         id TEXT PRIMARY KEY,
         user_id TEXT NOT NULL,
         type TEXT NOT NULL,
         data TEXT NOT NULL,
         created_at INTEGER DEFAULT (unixepoch()),
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       );
       
       CREATE TABLE IF NOT EXISTS promo_codes (
         code TEXT PRIMARY KEY,
         discount_type TEXT NOT NULL,
         value REAL NOT NULL,
         min_amount REAL DEFAULT 0,
         max_uses INTEGER DEFAULT NULL,
         used_count INTEGER DEFAULT 0,
         expires_at INTEGER DEFAULT NULL,
         active INTEGER DEFAULT 1,
         created_by TEXT,
         created_at INTEGER DEFAULT (unixepoch())
       );
       
       CREATE TABLE IF NOT EXISTS order_status_logs (
         id TEXT PRIMARY KEY,
         session_id TEXT NOT NULL,
         order_id TEXT NOT NULL,
         status TEXT NOT NULL,
         note TEXT DEFAULT '',
         created_at INTEGER DEFAULT (unixepoch())
       );
       
       CREATE TABLE IF NOT EXISTS notifications (
         id TEXT PRIMARY KEY,
         user_id TEXT NOT NULL,
         type TEXT NOT NULL,
         title TEXT NOT NULL,
         message TEXT NOT NULL,
         read INTEGER DEFAULT 0,
         action_url TEXT DEFAULT '',
         created_at INTEGER DEFAULT (unixepoch()),
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       );
       
       CREATE TABLE IF NOT EXISTS restaurant_hours (
         id TEXT PRIMARY KEY,
         restaurant_id INTEGER NOT NULL,
         day_of_week INTEGER NOT NULL,
         open_time TEXT DEFAULT '00:00',
         close_time TEXT DEFAULT '23:59',
         closed INTEGER DEFAULT 0,
         UNIQUE(restaurant_id, day_of_week)
       );
       
       CREATE TABLE IF NOT EXISTS order_status (
         session_id TEXT NOT NULL,
         order_id TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'pending',
         prepared_at INTEGER DEFAULT NULL,
         ready_at INTEGER DEFAULT NULL,
         delivered_at INTEGER DEFAULT NULL,
         PRIMARY KEY (session_id, order_id)
       );
     `)
   } catch (_) {}

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
      restaurantStatuses: {},
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

// User management functions
function createUser(username, password, { phone = '', telegram = '', email = '' } = {}) {
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const password_hash = hashPassword(password)
  
  if (!db) {
    if (!memUsers) memUsers = []
    memUsers.push({ id, username, password_hash, phone, telegram, email, created_at: getNow() })
    return { id, username, phone, telegram, email }
  }
  
  try {
    db.prepare(`
      INSERT INTO users (id, username, password_hash, phone, telegram, email, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, password_hash, phone, telegram, email, getNow())
    return { id, username, phone, telegram, email }
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return null
    }
    throw err
  }
}

function verifyUser(username, password) {
  if (!db) {
    if (!memUsers) return null
    const user = memUsers.find(u => u.username === username)
    if (!user) return null
    if (user.password_hash !== hashPassword(password)) return null
    return { id: user.id, username: user.username, phone: user.phone, telegram: user.telegram, email: user.email }
  }
  
  const row = db.prepare('SELECT * FROM users WHERE username=?').get(username)
  if (!row) return null
  if (row.password_hash !== hashPassword(password)) return null
  return { id: row.id, username: row.username, phone: row.phone, telegram: row.telegram, email: row.email }
}

function getUser(id) {
  if (!db) {
    if (!memUsers) return null
    const user = memUsers.find(u => u.id === id)
    if (!user) return null
    return { id: user.id, username: user.username, phone: user.phone, telegram: user.telegram, email: user.email }
  }
  
  const row = db.prepare('SELECT id, username, phone, telegram, email, created_at FROM users WHERE id=?').get(id)
  if (!row) return null
  return { id: row.id, username: row.username, phone: row.phone, telegram: row.telegram, email: row.email, created_at: row.created_at }
}

function getUserByUsername(username) {
  if (!db) {
    if (!memUsers) return null
    const user = memUsers.find(u => u.username === username)
    if (!user) return null
    return { id: user.id, username: user.username }
  }
  
  const row = db.prepare('SELECT id, username FROM users WHERE username=?').get(username)
  if (!row) return null
  return { id: row.id, username: row.username }
}

// User addresses
function getUserAddresses(userId) {
  if (!db) {
    if (!memAddresses) return []
    return (memAddresses[userId] || []).map(a => ({ ...a }))
  }
  
  return db.prepare('SELECT * FROM user_addresses WHERE user_id=? ORDER BY is_default DESC, created_at DESC').all(userId)
}

function addUserAddress(userId, { id, label, address, notes, is_default }) {
  const addrId = id || `addr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  
  if (!db) {
    if (!memAddresses) memAddresses = {}
    if (!memAddresses[userId]) memAddresses[userId] = []
    memAddresses[userId].push({ id: addrId, user_id: userId, label, address, notes, is_default: is_default ? 1 : 0 })
    return addrId
  }
  
  db.prepare(`
    INSERT INTO user_addresses (id, user_id, label, address, notes, is_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(addrId, userId, label || '', address, notes || '', is_default ? 1 : 0)
  
  if (is_default) {
    db.prepare('UPDATE user_addresses SET is_default=0 WHERE user_id=? AND id!=?').run(userId, addrId)
  }
  
  return addrId
}

// Favorites
function addFavorite(userId, type, data) {
  const id = `fav_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  
  if (!db) {
    if (!memFavorites) memFavorites = []
    memFavorites.push({ id, user_id: userId, type, data: JSON.stringify(data), created_at: getNow() })
    return id
  }
  
  db.prepare(`
    INSERT INTO favorites (id, user_id, type, data, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, type, JSON.stringify(data), getNow())
  return id
}

function getUserFavorites(userId, type = null) {
  if (!db) {
    if (!memFavorites) return []
    const favs = (memFavorites || []).filter(f => f.user_id === userId && (!type || f.type === type))
    return favs.map(f => ({ id: f.id, type: f.type, data: JSON.parse(f.data || '{}'), created_at: f.created_at }))
  }
  
  if (type) {
    return db.prepare('SELECT * FROM favorites WHERE user_id=? AND type=? ORDER BY created_at DESC').all(userId, type)
  }
  return db.prepare('SELECT * FROM favorites WHERE user_id=? ORDER BY created_at DESC').all(userId)
}

function removeFavorite(userId, favId) {
  if (!db) {
    if (memFavorites) memFavorites = memFavorites.filter(f => !(f.user_id === userId && f.id === favId))
    return
  }
  db.prepare('DELETE FROM favorites WHERE user_id=? AND id=?').run(userId, favId)
}

// Promo codes
function validatePromoCode(code, totalAmount) {
  if (!db) {
    if (!memPromoCodes) return null
    const promo = memPromoCodes.find(p => p.code === code && p.active)
    if (!promo) return null
    if (promo.expires_at && promo.expires_at < getNow()) return null
    if (promo.max_uses && promo.used_count >= promo.max_uses) return null
    if (totalAmount < (promo.min_amount || 0)) return { valid: false, error: 'Minimum order amount not met' }
    return { valid: true, promo }
  }
  
  const row = db.prepare('SELECT * FROM promo_codes WHERE code=? AND active=1').get(code)
  if (!row) return { valid: false, error: 'Invalid promo code' }
  if (row.expires_at && row.expires_at < getNow()) return { valid: false, error: 'Promo expired' }
  if (row.max_uses && row.used_count >= row.max_uses) return { valid: false, error: 'Promo used max times' }
  if (totalAmount < (row.min_amount || 0)) return { valid: false, error: 'Minimum order amount not met' }
  return { valid: true, promo: row }
}

function applyPromoCode(code, sessionId, userId) {
  const validation = validatePromoCode(code, 0) // Will be validated with actual amount later
  if (!validation.valid) return validation
  
  if (!db) {
    const promo = memPromoCodes.find(p => p.code === code)
    if (promo) {
      promo.used_count = (promo.used_count || 0) + 1
    }
    return { success: true, discount: validation.promo.value, discount_type: validation.promo.discount_type }
  }
  
  db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE code=?').run(code)
  return { success: true, discount: validation.promo.value, discount_type: validation.promo.discount_type }
}

// Order status tracking
function setOrderStatus(sid, uid, status, note = '') {
  const statusId = `status_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  
  if (!db) {
    if (!memOrderStatus) memOrderStatus = []
    memOrderStatus.push({ sid, uid, status, note, created_at: getNow(), id: statusId })
    return statusId
  }
  
  db.prepare(`
    INSERT INTO order_status_logs (id, session_id, order_id, status, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(statusId, sid, uid, status, note, getNow())
  
  // Update the current status in a separate table/query if needed
  return statusId
}

function getOrderStatusHistory(sid, uid) {
  if (!db) {
    if (!memOrderStatus) return []
    return (memOrderStatus || []).filter(s => s.sid === sid && s.uid === uid).sort((a,b) => (a.created_at||0) - (b.created_at||0))
  }
  
  return db.prepare('SELECT * FROM order_status_logs WHERE session_id=? AND order_id=? ORDER BY created_at ASC').all(sid, uid)
}

// Notifications
function createNotification(userId, type, title, message, actionUrl = '') {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  
  if (!db) {
    if (!memNotifications) memNotifications = []
    memNotifications.push({ id, user_id: userId, type, title, message, read: 0, action_url: actionUrl, created_at: getNow() })
    return id
  }
  
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, action_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, type, title, message, actionUrl, getNow())
  return id
}

function getUserNotifications(userId, unreadOnly = false) {
  if (!db) {
    if (!memNotifications) return []
    let notifs = (memNotifications || []).filter(n => n.user_id === userId)
    if (unreadOnly) notifs = notifs.filter(n => !n.read)
    return notifs.sort((a,b) => (b.created_at||0) - (a.created_at||0))
  }
  
  if (unreadOnly) {
    return db.prepare('SELECT * FROM notifications WHERE user_id=? AND read=0 ORDER BY created_at DESC').all(userId)
  }
  return db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC').all(userId)
}

function markNotificationRead(userId, notifId) {
  if (!db) {
    if (memNotifications) {
      const n = memNotifications.find(n => n.id === notifId && n.user_id === userId)
      if (n) n.read = 1
    }
    return
  }
  db.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=?').run(notifId, userId)
}

function markAllNotificationsRead(userId) {
  if (!db) {
    if (memNotifications) {
      memNotifications.forEach(n => { if (n.user_id === userId) n.read = 1 })
    }
    return
  }
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(userId)
}

// Restaurant hours
function setRestaurantHours(restaurantId, hours) {
  if (!db) {
    if (!memRestaurantHours) memRestaurantHours = {}
    memRestaurantHours[restaurantId] = hours
    return
  }
  
  const del = db.prepare('DELETE FROM restaurant_hours WHERE restaurant_id=?')
  const ins = db.prepare('INSERT INTO restaurant_hours (id, restaurant_id, day_of_week, open_time, close_time, closed) VALUES (?, ?, ?, ?, ?, ?)')
  
  db.transaction(() => {
    del.run(restaurantId)
    hours.forEach(h => {
      ins.run(`rh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, restaurantId, h.day_of_week, h.open_time, h.close_time, h.closed ? 1 : 0)
    })
  })()
}

function getSession(sid, { create = true } = {}) {
  if (!db) {
    const mem = getMemSession(sid, create)
    return mem ? { sid, delivery: mem.delivery, status: mem.status, deadline: mem.deadline, title: mem.title || '', announcement: mem.announcement || '', restaurantStatuses: deepClone(mem.restaurantStatuses || {}), created: mem.created } : null
  }

  const row = db.prepare('SELECT * FROM sessions WHERE sid=?').get(sid)
  if (!row) {
    if (!create) return null
    db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
    return { sid, delivery: 0, status: 'open', deadline: null, title: '', announcement: '', restaurantStatuses: {}, created: getNow() }
  }
  return {
    sid: row.sid,
    delivery: row.delivery || 0,
    status: row.status || 'open',
    deadline: row.deadline || null,
    title: row.title || '',
    announcement: row.announcement || '',
    restaurantStatuses: safeJsonParse(row.restaurant_statuses, {}),
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

function setRestaurantStatuses(sid, statuses) {
  if (!db) {
    const session = getMemSession(sid)
    session.restaurantStatuses = deepClone(statuses)
    return
  }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET restaurant_statuses=? WHERE sid=?').run(JSON.stringify(statuses || {}), sid)
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
    restaurantStatuses: session?.restaurantStatuses || {},
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

app.put('/api/session/:sid/restaurant-statuses', requireAdmin, (req, res) => {
  const rawStatuses = req.body?.statuses && typeof req.body.statuses === 'object' ? req.body.statuses : {}
  const statuses = Object.fromEntries(
    Object.entries(rawStatuses).slice(0, 100).map(([restId, value]) => [
      String(restId),
      {
        stage: typeof value?.stage === 'string' ? value.stage.slice(0, 32) : 'collecting',
        note: typeof value?.note === 'string' ? value.note.trim().slice(0, 160) : '',
        updatedAt: value?.updatedAt || getNow(),
      },
    ])
  )
  setRestaurantStatuses(req.params.sid, statuses)
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

function saveVote(sid, uid, name, rid) {
  if (!db) return
  db.prepare(`INSERT OR REPLACE INTO votes (sid, uid, name, rid) VALUES (?, ?, ?, ?)`).run(sid, uid, name, rid)
}

function getVotes(sid) {
  if (!db) return []
  const rows = db.prepare('SELECT rid, COUNT(*) as cnt FROM votes WHERE sid=? GROUP BY rid').all(sid)
  return rows
}

app.get('/api/votes/:sid', (req, res) => {
  res.json(getVotes(req.params.sid))
})

app.post('/api/votes/:sid', (req, res) => {
  const { sid } = req.params
  const { uid, name, rid } = req.body || {}
  if (!sid || !uid || !name || rid == null) return res.status(400).json({ ok: false })
  saveVote(sid, uid, name, rid)
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

// ── User Authentication ───────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { username, password, phone, telegram, email } = req.body || {}
  if (!username || !password || username.length < 3 || username.length > 30 || password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Invalid credentials' })
  }
  
  const user = createUser(username, password, { phone, telegram, email })
  if (!user) return res.status(409).json({ ok: false, error: 'Username already exists' })
  
  const token = createJwtToken(user.id)
  res.json({ ok: true, user: { id: user.id, username: user.username, phone: user.phone, telegram: user.telegram, email: user.email }, token })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = verifyUser(username, password)
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' })
  
  const token = createJwtToken(user.id)
  res.json({ ok: true, user: { id: user.id, username: user.username, phone: user.phone, telegram: user.telegram, email: user.email }, token })
})

function getUserAuth(req) {
  const auth = req.headers.authorization || ''
  const match = auth.match(/^Bearer (.+)$/)
  if (!match) return null
  return verifyJwtToken(match[1])
}

function requireAuth(req, res, next) {
  const auth = getUserAuth(req)
  if (!auth) return res.status(401).json({ ok: false, error: 'unauthorized' })
  req.user = auth
  next()
}

app.get('/api/auth/me', (req, res) => {
  const auth = getUserAuth(req)
  if (!auth) return res.status(200).json({ ok: true, user: null, loggedIn: false })
  const user = getUser(auth.sub)
  res.json({ ok: true, user, loggedIn: !!user })
})

app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true, message: 'Logged out (client should delete token)' })
})

// ── User Profile & Addresses ───────────────────────────────────────
app.get('/api/users/me', requireAuth, (req, res) => {
  const user = getUser(req.user.sub)
  if (!user) return res.status(404).json({ ok: false })
  const addresses = getUserAddresses(req.user.sub)
  res.json({ ok: true, user: { ...user, addresses } })
})

app.put('/api/users/me', requireAuth, (req, res) => {
  const { phone, telegram, email } = req.body || {}
  if (!db) {
    const userIdx = memUsers.findIndex(u => u.id === req.user.sub)
    if (userIdx !== -1) {
      if (phone !== undefined) memUsers[userIdx].phone = phone
      if (telegram !== undefined) memUsers[userIdx].telegram = telegram
      if (email !== undefined) memUsers[userIdx].email = email
    }
    return res.json({ ok: true })
  }
  
  const updates = []
  const values = []
  if (phone !== undefined) { updates.push('phone=?'); values.push(phone) }
  if (telegram !== undefined) { updates.push('telegram=?'); values.push(telegram) }
  if (email !== undefined) { updates.push('email=?'); values.push(email) }
  
  if (updates.length > 0) {
    values.push(req.user.sub)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id=?`).run(...values)
  }
  res.json({ ok: true })
})

app.post('/api/addresses', requireAuth, (req, res) => {
  const { label, address, notes, is_default } = req.body || {}
  const id = addUserAddress(req.user.sub, { id: null, label, address, notes, is_default })
  res.json({ ok: true, id })
})

app.put('/api/addresses/:id', requireAuth, (req, res) => {
  const { label, address, notes, is_default } = req.body || {}
  if (!db) {
    // Implementation for in-memory
    if (!memAddresses[req.user.sub]) return res.status(404).json({ ok: false })
    const addrIdx = memAddresses[req.user.sub].findIndex(a => a.id === req.params.id)
    if (addrIdx === -1) return res.status(404).json({ ok: false })
    if (label !== undefined) memAddresses[req.user.sub][addrIdx].label = label
    if (address !== undefined) memAddresses[req.user.sub][addrIdx].address = address
    if (notes !== undefined) memAddresses[req.user.sub][addrIdx].notes = notes
    if (is_default !== undefined) {
      memAddresses[req.user.sub].forEach(a => a.is_default = 0)
      memAddresses[req.user.sub][addrIdx].is_default = is_default ? 1 : 0
    }
    return res.json({ ok: true })
  }
  
  const updates = []
  const values = []
  if (label !== undefined) { updates.push('label=?'); values.push(label) }
  if (address !== undefined) { updates.push('address=?'); values.push(address) }
  if (notes !== undefined) { updates.push('notes=?'); values.push(notes) }
  if (is_default !== undefined) { 
    db.prepare('UPDATE user_addresses SET is_default=0 WHERE user_id=?').run(req.user.sub)
    updates.push('is_default=?'); values.push(is_default ? 1 : 0) 
  }
  
  if (updates.length > 0) {
    values.push(req.params.id, req.user.sub)
    db.prepare(`UPDATE user_addresses SET ${updates.join(', ')} WHERE id=? AND user_id=?`).run(...values)
  }
  res.json({ ok: true })
})

app.delete('/api/addresses/:id', requireAuth, (req, res) => {
  if (!db) {
    if (memAddresses[req.user.sub]) {
      memAddresses[req.user.sub] = memAddresses[req.user.sub].filter(a => a.id !== req.params.id)
    }
    return res.json({ ok: true })
  }
  db.prepare('DELETE FROM user_addresses WHERE id=? AND user_id=?').run(req.params.id, req.user.sub)
  res.json({ ok: true })
})

// ── Favorites ───────────────────────────────────────────────────────
app.get('/api/favorites', requireAuth, (req, res) => {
  const { type } = req.query
  const favs = getUserFavorites(req.user.sub, type)
  res.json({ ok: true, favorites: favs })
})

app.post('/api/favorites', requireAuth, (req, res) => {
  const { type, data } = req.body || {}
  if (!type || !data) return res.status(400).json({ ok: false, error: 'Missing type or data' })
  const id = addFavorite(req.user.sub, type, data)
  res.json({ ok: true, id })
})

app.delete('/api/favorites/:id', requireAuth, (req, res) => {
  removeFavorite(req.user.sub, req.params.id)
  res.json({ ok: true })
})

// ── Promo Codes ─────────────────────────────────────────────────────
app.post('/api/promo/validate', (req, res) => {
  const { code, amount } = req.body || {}
  if (!code) return res.status(400).json({ ok: false, error: 'Promo code required' })
  const result = validatePromoCode(code, amount || 0)
  if (!result.valid) return res.status(400).json({ ok: false, error: result.error })
  res.json({ ok: true, discount: result.promo.value, discount_type: result.promo.discount_type, description: result.promo.description || '' })
})

// Admin only endpoints for promo code management
app.get('/api/admin/promo-codes', requireAdmin, (req, res) => {
  if (!db) return res.json({ ok: true, promos: memPromoCodes || [] })
  const rows = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all()
  res.json({ ok: true, promos: rows })
})

app.post('/api/admin/promo-codes', requireAdmin, (req, res) => {
  const { code, discount_type, value, min_amount, max_uses, expires_at, active } = req.body || {}
  if (!code || !discount_type || !value) return res.status(400).json({ ok: false, error: 'Missing required fields' })
  
  if (!db) {
    if (!memPromoCodes) memPromoCodes = []
    memPromoCodes.push({ code, discount_type, value, min_amount, max_uses, used_count: 0, expires_at, active: active ? 1 : 1, created_by: req.admin.u, created_at: getNow() })
    return res.json({ ok: true })
  }
  
  try {
    db.prepare(`
      INSERT INTO promo_codes (code, discount_type, value, min_amount, max_uses, expires_at, active, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, discount_type, value, min_amount || 0, max_uses || null, expires_at || null, active ? 1 : 1, req.admin.u, getNow())
  } catch (err) {
    return res.status(409).json({ ok: false, error: 'Code already exists' })
  }
  res.json({ ok: true })
})

// ── Order Status Tracking ───────────────────────────────────────────
app.put('/api/orders/:sid/:uid/status', requireAdmin, (req, res) => {
  const { sid, uid } = req.params
  const { status, note } = req.body || {}
  if (!['pending', 'preparing', 'ready', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Invalid status' })
  }
  
  const statusId = setOrderStatus(sid, uid, status, note || '')
  
  // Send notification to user if status changes
  const order = getOrders(sid)[uid]
  if (order) {
    createNotification(
      `user_${order.name}`, // We'll map username to user id in real implementation
      'order_status',
      `Order Status Update`,
      `Your order status is now: ${status}`,
      `/?s=${sid}`
    )
  }
  
  broadcast(sid)
  res.json({ ok: true, statusId })
})

app.get('/api/orders/:sid/:uid/status', (req, res) => {
  const { sid, uid } = req.params
  const history = getOrderStatusHistory(sid, uid)
  const current = history[history.length - 1] || { status: 'pending' }
  res.json({ ok: true, current: current.status, history })
})

// ── Notifications ───────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, (req, res) => {
  const { unread_only } = req.query
  const notifs = getUserNotifications(req.user.sub, unread_only === 'true')
  res.json({ ok: true, notifications: notifs })
})

app.put('/api/notifications/:id/read', requireAuth, (req, res) => {
  markNotificationRead(req.user.sub, req.params.id)
  res.json({ ok: true })
})

app.post('/api/notifications/mark-all-read', requireAuth, (req, res) => {
  markAllNotificationsRead(req.user.sub)
  res.json({ ok: true })
})

// ── Restaurant Hours ────────────────────────────────────────────────
app.get('/api/restaurants/:id/hours', (req, res) => {
  const restaurantId = parseInt(req.params.id)
  if (!db) {
    return res.json({ ok: true, hours: memRestaurantHours[restaurantId] || [] })
  }
  const rows = db.prepare('SELECT * FROM restaurant_hours WHERE restaurant_id=?').all(restaurantId)
  res.json({ ok: true, hours: rows })
})

app.put('/api/restaurants/:id/hours', requireAdmin, (req, res) => {
  const restaurantId = parseInt(req.params.id)
  const hours = req.body.hours || []
  setRestaurantHours(restaurantId, hours)
  res.json({ ok: true })
})

// ── Admin Analytics ─────────────────────────────────────────────────
app.get('/api/admin/analytics', requireAdmin, (req, res) => {
  const { days = 30 } = req.query
  const since = getNow() - (days * 24 * 60 * 60 * 1000)
  
  if (!db) {
    return res.json({ ok: true, stats: { total_sessions: 0, total_orders: 0, total_revenue: 0, avg_order_value: 0 } })
  }
  
  const sessions = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE created >= ?').all(since)[0].count
  const orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE submitted_at >= ?').all(since)[0].count
  const revenueRow = db.prepare('SELECT SUM(paid_amount) as total FROM orders WHERE paid=1 AND paid_at >= ?').all(since)[0]
  const totalRevenue = revenueRow.total || 0
  
  res.json({
    ok: true,
    stats: {
      total_sessions: sessions,
      total_orders: orders,
      total_revenue: totalRevenue,
      avg_order_value: orders > 0 ? totalRevenue / orders : 0
    }
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
