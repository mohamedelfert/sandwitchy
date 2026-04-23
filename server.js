const express  = require('express')
const cors     = require('cors')
const path     = require('path')
const os       = require('os')
const fs       = require('fs')
const https    = require('https')
const http     = require('http')

const app  = express()
const PORT = process.env.PORT || 3000
const N8N_WEBHOOK = process.env.N8N_WEBHOOK || ''

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '100kb' }))

// ── 1. SQLite persistent store ────────────────────────────────
let db
try {
  if (process.env.VERCEL) throw new Error('Vercel environment detected. Forcing in-memory store.')
  const Database = require('better-sqlite3')
  const dbPath   = process.env.DB_PATH || path.join(__dirname, 'data', 'sandwitchy.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid      TEXT PRIMARY KEY,
      delivery REAL DEFAULT 0,
      status   TEXT DEFAULT 'open',
      deadline TEXT DEFAULT NULL,
      created  INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS orders (
      sid         TEXT,
      uid         TEXT,
      name        TEXT,
      telegram    TEXT DEFAULT '',
      lines       TEXT DEFAULT '[]',
      drinks      TEXT DEFAULT '{}',
      notes       TEXT DEFAULT '{}',
      submitted_at INTEGER,
      PRIMARY KEY (sid, uid)
    );
    CREATE TABLE IF NOT EXISTS expected_members (
      sid  TEXT,
      name TEXT,
      PRIMARY KEY (sid, name)
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `)
  
  // Seed default bread types if not exists
  const hasBread = db.prepare('SELECT 1 FROM app_settings WHERE key=?').get('bread_types')
  if (!hasBread) {
    const defaults = [
      { id: 'baladi', ar: 'عيش بلدي', color: '#B83A0A', light: '#FDEEE8' },
      { id: 'shamy',  ar: 'عيش شامي', color: '#6B2EA0', light: '#F2E8FF' },
      { id: 'souri',  ar: 'عيش سوري', color: '#0A7C5A', light: '#E4F5EF' },
    ]
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?,?)').run('bread_types', JSON.stringify(defaults))
  }
  console.log('[db]     SQLite ready →', dbPath)
} catch (e) {
  console.warn('[db]     better-sqlite3 not available, using in-memory store:', e.message)
  db = null
}

// ── In-memory fallback ────────────────────────────────────────
const memStore = {}
function getMem(sid) {
  if (!memStore[sid]) memStore[sid] = { orders:{}, delivery:0, status:'open', deadline:null, expectedMembers:[] }
  return memStore[sid]
}

// ── Store abstraction ─────────────────────────────────────────
function getSession(sid) {
  if (!db) return getMem(sid)
  const row = db.prepare('SELECT * FROM sessions WHERE sid=?').get(sid)
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
    return { sid, delivery:0, status:'open', deadline:null }
  }
  return row
}

function getOrders(sid) {
  if (!db) return getMem(sid).orders
  const rows = db.prepare('SELECT * FROM orders WHERE sid=?').all(sid)
  const obj  = {}
  rows.forEach(r => {
    obj[r.uid] = {
      name: r.name, telegram: r.telegram,
      lines: JSON.parse(r.lines), drinks: JSON.parse(r.drinks),
      notes: JSON.parse(r.notes || '{}'),
      submittedAt: r.submitted_at,
    }
  })
  return obj
}

function setOrder(sid, uid, data) {
  if (!db) { getMem(sid).orders[uid] = data; return }
  db.prepare(`
    INSERT INTO orders (sid,uid,name,telegram,lines,drinks,notes,submitted_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(sid,uid) DO UPDATE SET
      name=excluded.name, telegram=excluded.telegram,
      lines=excluded.lines, drinks=excluded.drinks,
      notes=excluded.notes, submitted_at=excluded.submitted_at
  `).run(sid, uid, data.name, data.telegram||'',
    JSON.stringify(data.lines||[]), JSON.stringify(data.drinks||{}),
    JSON.stringify(data.notes||{}), data.submittedAt||Date.now())
}

function delOrder(sid, uid) {
  if (!db) { delete getMem(sid).orders[uid]; return }
  db.prepare('DELETE FROM orders WHERE sid=? AND uid=?').run(sid, uid)
}

function setDelivery(sid, amt) {
  if (!db) { getMem(sid).delivery = amt; return }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET delivery=? WHERE sid=?').run(amt, sid)
}

function setStatus(sid, status) {
  if (!db) { getMem(sid).status = status; return }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET status=? WHERE sid=?').run(status, sid)
}

function setDeadline(sid, deadline) {
  if (!db) { getMem(sid).deadline = deadline; return }
  db.prepare('INSERT OR IGNORE INTO sessions (sid) VALUES (?)').run(sid)
  db.prepare('UPDATE sessions SET deadline=? WHERE sid=?').run(deadline, sid)
}

function getExpected(sid) {
  if (!db) return getMem(sid).expectedMembers || []
  return db.prepare('SELECT name FROM expected_members WHERE sid=?').all(sid).map(r => r.name)
}

function setExpected(sid, names) {
  if (!db) { getMem(sid).expectedMembers = names; return }
  db.prepare('DELETE FROM expected_members WHERE sid=?').run(sid)
  const ins = db.prepare('INSERT OR IGNORE INTO expected_members (sid,name) VALUES (?,?)')
  names.forEach(n => ins.run(sid, n))
}

function deleteSession(sid) {
  if (!db) { delete memStore[sid]; return }
  db.prepare('DELETE FROM sessions WHERE sid=?').run(sid)
  db.prepare('DELETE FROM orders WHERE sid=?').run(sid)
  db.prepare('DELETE FROM expected_members WHERE sid=?').run(sid)
}

function buildPayload(sid) {
  const sess     = getSession(sid)
  const orders   = getOrders(sid)
  const expected = getExpected(sid)
  return {
    orders,
    delivery:  sess?.delivery  || 0,
    status:    sess?.status    || 'open',
    deadline:  sess?.deadline  || null,
    expected,
  }
}

// ── SSE clients ───────────────────────────────────────────────
const clients = {}
function broadcast(sid) {
  const chunk = `data: ${JSON.stringify(buildPayload(sid))}\n\n`
  for (const res of (clients[sid] || new Set())) {
    try { res.write(chunk) } catch (_) { clients[sid]?.delete(res) }
  }
}

// ── Rate limiter ──────────────────────────────────────────────
const rlMap = new Map()
function rateLimit(key, max=20) {
  const now = Date.now()
  const e   = rlMap.get(key) || { count:0, reset: now+60000 }
  if (now > e.reset) { e.count=0; e.reset=now+60000 }
  e.count++; rlMap.set(key, e)
  return e.count > max
}
setInterval(() => { const now=Date.now(); for(const [k,v] of rlMap) if(now>v.reset+60000) rlMap.delete(k) }, 300000)

// ── Deadline auto-complete ────────────────────────────────────
setInterval(() => {
  if (!db) return
  const now  = new Date().toISOString()
  const rows = db.prepare("SELECT sid FROM sessions WHERE status='open' AND deadline IS NOT NULL AND deadline <= ?").all(now)
  rows.forEach(({ sid }) => {
    setStatus(sid, 'complete')
    broadcast(sid)
    console.log(`[auto]   session ${sid} completed by deadline`)
    fireN8nWebhook(sid)
  })
}, 10000)

// ── n8n webhook ───────────────────────────────────────────────
function fireN8nWebhook(sid) {
  if (!N8N_WEBHOOK) { console.log('[n8n]    N8N_WEBHOOK not set — skipping'); return }
  const orders    = getOrders(sid)
  const sess      = getSession(sid)
  const delivery  = sess?.delivery || 0
  const numPeople = Object.keys(orders).length
  const perPerson = numPeople > 0 ? delivery / numPeople : 0
  const breadMap  = { baladi:'عيش بلدي', shamy:'عيش شامي', souri:'عيش سوري' }

  const messages = Object.values(orders).map(o => {
    const itemsTotal = (o.lines||[]).reduce((s,l) => s+(l.price||0)*l.qty, 0)
    const total      = itemsTotal + perPerson
    const linesText  = (o.lines||[]).map(l => {
      const bread = l.bt ? ` (${breadMap[l.bt]})` : ''
      const note  = (o.notes||{})[l.key] ? ` — 📝 ${o.notes[l.key]}` : ''
      const price = l.price > 0 ? ` — ${l.price*l.qty} ج` : ''
      return `• ${l.iname}${bread} ×${l.qty}${price}${note}`
    }).join('\n')
    const timeStr = o.submittedAt ? new Date(o.submittedAt).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : ''
    return { name:o.name, telegram:o.telegram||'', total:+total.toFixed(2), items_total:itemsTotal, delivery:+perPerson.toFixed(2), lines_text:linesText, session_id:sid, submitted_at:timeStr }
  })

  const body = JSON.stringify({ session_id:sid, delivery, num_people:numPeople, messages })
  try {
    const url  = new URL(N8N_WEBHOOK)
    const lib  = url.protocol==='https:' ? https : http
    const req  = lib.request({ hostname:url.hostname, port:url.port||(url.protocol==='https:'?443:80), path:url.pathname+url.search, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} }, r => console.log(`[n8n]    → ${r.statusCode}`))
    req.on('error', e => console.error('[n8n]    error:', e.message))
    req.write(body); req.end()
  } catch(e) { console.error('[n8n]    failed:', e.message) }
}

// ════════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════════

// SSE
app.get('/events/:sid', (req, res) => {
  const { sid } = req.params
  res.setHeader('Content-Type','text/event-stream')
  res.setHeader('Cache-Control','no-cache')
  res.setHeader('Connection','keep-alive')
  res.setHeader('X-Accel-Buffering','no')
  res.flushHeaders()
  res.write(`data: ${JSON.stringify(buildPayload(sid))}\n\n`)
  if (!clients[sid]) clients[sid] = new Set()
  clients[sid].add(res)
  const ping = setInterval(() => { try { res.write(': ping\n\n') } catch(_){ clearInterval(ping) } }, 20000)
  req.on('close', () => { clearInterval(ping); clients[sid]?.delete(res) })
})

// GET active open sessions
app.get('/api/sessions/active', (req, res) => {
  if (!db) {
    const list = Object.entries(memStore)
      .filter(([, v]) => v.status === 'open' && Object.keys(v.orders).length > 0)
      .map(([k, v]) => ({ sid: k, count: Object.keys(v.orders).length }))
    return res.json(list)
  }
  const rows = db.prepare(`
    SELECT s.sid, COUNT(o.uid) as count 
    FROM sessions s 
    LEFT JOIN orders o ON s.sid = o.sid 
    WHERE s.status = 'open' 
    GROUP BY s.sid 
    HAVING count > 0
  `).all()
  res.json(rows)
})

// GET session snapshot
app.get('/api/session/:sid', (req, res) => res.json(buildPayload(req.params.sid)))

// POST / PATCH order
app.post('/api/orders/:sid/:uid', (req, res) => {
  const { sid, uid } = req.params
  const ip = req.ip || req.connection.remoteAddress
  if (rateLimit(`order:${ip}`)) return res.status(429).json({ ok:false, error:'too many requests' })
  if (!req.body?.name || typeof req.body.name !== 'string' || req.body.name.length > 80)
    return res.status(400).json({ ok:false })
  setOrder(sid, uid, { ...req.body, submittedAt: Date.now() })
  broadcast(sid)
  console.log(`[order]  ${sid} | ${req.body.name}${req.body.telegram?' @'+req.body.telegram:''} | ${(req.body.lines||[]).reduce((s,l)=>s+l.qty,0)} items`)
  res.json({ ok:true })
})

app.delete('/api/orders/:sid/:uid', (req, res) => {
  delOrder(req.params.sid, req.params.uid)
  broadcast(req.params.sid)
  res.json({ ok:true })
})

app.patch('/api/orders/:sid/:uid', (req, res) => {
  const { sid, uid } = req.params
  const orders = getOrders(sid)
  if (!orders[uid]) return res.status(404).json({ ok:false })
  const updated = { ...orders[uid], lines: req.body.lines || orders[uid].lines }
  setOrder(sid, uid, updated)
  broadcast(sid)
  res.json({ ok:true })
})

// Delivery
app.put('/api/session/:sid/delivery', (req, res) => {
  const amt = parseFloat(req.body.amount)
  if (isNaN(amt) || amt < 0 || amt > 10000) return res.status(400).json({ ok:false })
  setDelivery(req.params.sid, amt)
  broadcast(req.params.sid)
  res.json({ ok:true })
})

// Complete
app.put('/api/session/:sid/complete', (req, res) => {
  const { sid } = req.params
  setStatus(sid, 'complete')
  broadcast(sid)
  console.log(`[done]   ${sid}`)
  fireN8nWebhook(sid)
  res.json({ ok:true })
})

// Reopen
app.put('/api/session/:sid/reopen', (req, res) => {
  setStatus(req.params.sid, 'open')
  broadcast(req.params.sid)
  res.json({ ok:true })
})

// Set deadline
app.put('/api/session/:sid/deadline', (req, res) => {
  const { deadline } = req.body  // ISO string or null
  setDeadline(req.params.sid, deadline || null)
  broadcast(req.params.sid)
  console.log(`[deadline] ${req.params.sid} → ${deadline}`)
  res.json({ ok:true })
})

// Expected members
app.put('/api/session/:sid/expected', (req, res) => {
  const names = (req.body.names || []).filter(n => typeof n==='string' && n.trim()).map(n => n.trim())
  setExpected(req.params.sid, names)
  broadcast(req.params.sid)
  res.json({ ok:true })
})

// Reset
app.delete('/api/session/:sid', (req, res) => {
  deleteSession(req.params.sid)
  broadcast(req.params.sid)
  console.log(`[reset]  ${req.params.sid}`)
  res.json({ ok:true })
})

// Settings
app.get('/api/settings', (req, res) => {
  if (!db) {
    // Fallback if no DB
    return res.json({
      bread_types: [
        { id: 'baladi', ar: 'عيش بلدي', color: '#B83A0A', light: '#FDEEE8' },
        { id: 'shamy',  ar: 'عيش شامي', color: '#6B2EA0', light: '#F2E8FF' },
        { id: 'souri',  ar: 'عيش سوري', color: '#0A7C5A', light: '#E4F5EF' },
      ]
    })
  }
  const rows = db.prepare('SELECT * FROM app_settings').all()
  const settings = {}
  rows.forEach(r => {
    try { settings[r.key] = JSON.parse(r.value) } catch(_) { settings[r.key] = r.value }
  })
  res.json(settings)
})

app.post('/api/settings', (req, res) => {
  if (!db) return res.status(500).json({ ok:false })
  const { key, value } = req.body
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value))
  res.json({ ok:true })
})

// Static
app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const ip = Object.values(os.networkInterfaces()).flat().find(n=>n.family==='IPv4'&&!n.internal)?.address
    console.log('\n  🍽️  طلباتي v2\n')
    console.log(`  Local:   http://localhost:${PORT}`)
    if (ip) console.log(`  Network: http://${ip}:${PORT}`)
    console.log(`\n  Admin:   http://${ip||'localhost'}:${PORT}/?admin=1`)
    console.log(`  n8n:     ${N8N_WEBHOOK||'⚠️  N8N_WEBHOOK not set'}`)
    console.log(`  SQLite:  ${db ? 'enabled' : 'in-memory fallback'}\n`)
  })
}

module.exports = app
