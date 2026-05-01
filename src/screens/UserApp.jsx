import { useState, useEffect, useRef } from 'react'
import { INIT_RESTS } from '../constants/data.js'
import { genId } from '../utils/helpers.js'
import { api } from '../api/client.js'
import LoginScreen   from './LoginScreen.jsx'
import RegisterScreen from './RegisterScreen.jsx'
import WelcomeScreen   from './WelcomeScreen.jsx'
import NameScreen      from './NameScreen.jsx'
import HomeScreen      from './HomeScreen.jsx'
import MenuScreen      from './MenuScreen.jsx'
import SubmittedScreen from './SubmittedScreen.jsx'
import SummaryScreen   from './SummaryScreen.jsx'
import CompleteScreen  from './CompleteScreen.jsx'
import ProfileScreen   from './ProfileScreen.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import VoteScreen      from './VoteScreen.jsx'

// ── localStorage helpers ──────────────────────────────────────
const LAST_ORDER_KEY = 'sandwitchy_last_order'
const USER_NAME_KEY  = 'sandwitchy_user_name'
const PHONE_KEY      = 'sandwitchy_user_phone'
const TELEGRAM_KEY   = 'sandwitchy_user_telegram'
const SESSION_ID_KEY = 'sandwitchy_session_id'
const SCREEN_KEY     = 'sandwitchy_screen'

function saveStoredSession(sid, screen) {
  try { 
    localStorage.setItem(SESSION_ID_KEY, sid || '')
    localStorage.setItem(SCREEN_KEY, screen || '')
  } catch(_) {}
}
function loadStoredSession() {
  try { 
    return { 
      sid: localStorage.getItem(SESSION_ID_KEY) || '',
      screen: localStorage.getItem(SCREEN_KEY) || 'welcome'
    }
  } catch(_) { return { sid: '', screen: 'welcome' } }
}

function saveLastOrder(lines, drinks, notes) {
  try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ lines, drinks, notes, savedAt: Date.now() })) } catch(_) {}
}
function loadLastOrder() {
  try { return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || 'null') } catch(_) { return null }
}
function saveStoredName(name) {
  try { localStorage.setItem(USER_NAME_KEY, name) } catch(_) {}
}
function loadStoredName() {
  try { return localStorage.getItem(USER_NAME_KEY) || '' } catch(_) { return '' }
}
function saveStoredPhone(phone) {
  try { localStorage.setItem(PHONE_KEY, phone) } catch(_) {}
}
function loadStoredPhone() {
  try { return localStorage.getItem(PHONE_KEY) || '' } catch(_) { return '' }
}
function saveStoredTelegram(telegram) {
  try { localStorage.setItem(TELEGRAM_KEY, telegram) } catch(_) {}
}
function loadStoredTelegram() {
  try { return localStorage.getItem(TELEGRAM_KEY) || '' } catch(_) { return '' }
}

export default function UserApp() {
  const { user, isAuthenticated, loading } = useAuth()
  const [sessionId,    setSessionId]    = useState(null)
  const [myId]                          = useState(() => genId())
  const [userName,     setUserName]     = useState(() => loadStoredName())
  const [screen,       setScreen]       = useState('welcome')
  const [allOrders,    setAllOrders]    = useState({})
  const [delivery,     setDelivery]     = useState(0)
  const [sessStatus,   setSessStatus]   = useState('open')
  const [deadline,     setDeadline]     = useState(null)
  const [expected,     setExpected]     = useState([])
  const [sessionTitle, setSessionTitle] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [restaurantStatuses, setRestaurantStatuses] = useState({})
  const [submitError,  setSubmitError]  = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [isEditing,    setIsEditing]    = useState(false)
  const [telegramUser, setTelegramUser] = useState(() => loadStoredTelegram())
  const [phoneUser,    setPhoneUser]    = useState(() => loadStoredPhone())
  const [breadTypes,   setBreadTypes]   = useState([])
  const [drinkTypes,   setDrinkTypes]   = useState([])
  const [authMode,     setAuthMode]     = useState('login') // 'login' or 'register'

  const [rests,     setRests]     = useState(INIT_RESTS)
  const [lines,     setLines]     = useState([])
  const [drinks,    setDrinks]    = useState({})
  const [notes,     setNotes]     = useState({})
  const [activeRid, setActiveRid] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const evtRef = useRef(null)

  // Restore session from URL or localStorage
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const s = p.get('s')
    const v = p.get('vote')
    
    if (s) {
      setSessionId(s)
      setScreen(v === '1' ? 'vote' : 'name')
    } else {
      // Check localStorage for persisted session
      const stored = loadStoredSession()
      if (stored.sid) {
        setSessionId(stored.sid)
        // Only restore if it's a valid screen we can resume from
        if (stored.screen && stored.screen !== 'welcome') {
          setScreen(stored.screen)
        }
      }
    }
    
    // Fetch settings (menu from API)
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
  }, [])

  // Persist session on change
  useEffect(() => {
    if (sessionId) {
      saveStoredSession(sessionId, screen)
    }
  }, [sessionId, screen])

  // SSE
  useEffect(() => {
    if (!sessionId) return
    evtRef.current?.close()
    const connect = () => {
      const es = new EventSource(`/events/${sessionId}`)
      es.onmessage = e => {
        try {
          const d = JSON.parse(e.data)
          setAllOrders(d.orders || {})
          setDelivery(d.delivery || 0)
          setSessStatus(d.status || 'open')
          setDeadline(d.deadline || null)
          setExpected(d.expected || [])
          setSessionTitle(d.title || '')
          setAnnouncement(d.announcement || '')
          setRestaurantStatuses(d.restaurantStatuses || {})
        } catch (_) {}
      }
      es.onerror = () => { es.close(); setTimeout(connect, 3000) }
      evtRef.current = es
    }
    connect()
    return () => evtRef.current?.close()
  }, [sessionId])

  // Handle promo code validation
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return
    const res = await api.validatePromo(promoCode.trim(), 0) // Will validate with actual total
    if (res.ok) {
      setPromoDiscount(res)
      alert(`Promo applied! ${res.discount_type === 'percent' ? res.discount + '% off' : res.discount + ' ج discount'}`)
    } else {
      alert(res.error || 'Invalid promo code')
    }
  }

  // ── Order helpers ──
  const lKey = (r, i, b) => `${r}_${i}_${b||'none'}`

  const addL = (rest, item, bt) => {
    const k = lKey(rest.id, item.id, bt)
    setLines(prev => {
      const ex = prev.find(l => l.key === k)
      if (ex) return prev.map(l => l.key===k ? {...l, qty:l.qty+1} : l)
      return [...prev, { key:k, rid:rest.id, rname:rest.name, iid:item.id, iname:item.name, price:item.price||0, bt:bt||null, qty:1 }]
    })
  }
  const subL = (rest, item, bt) => {
    const k = lKey(rest.id, item.id, bt)
    setLines(prev => {
      const ex = prev.find(l => l.key === k)
      if (!ex) return prev
      if (ex.qty <= 1) return prev.filter(l => l.key !== k)
      return prev.map(l => l.key===k ? {...l, qty:l.qty-1} : l)
    })
  }
  const setNote = (key, text) => setNotes(n => ({ ...n, [key]: text }))
  const addD = id => setDrinks(d => ({ ...d, [id]:(d[id]||0)+1 }))
  const subD = id => setDrinks(d => { const n={...d}; if(!n[id]||n[id]<=1) delete n[id]; else n[id]--; return n })

  const startSession = sid => {
    setSessionId(sid)
    const url = new URL(window.location.origin)
    url.searchParams.set('s', sid)
    window.history.replaceState({}, '', url)
    setScreen('name')
  }

  // ── Load existing order for editing ──
  const startEditing = () => {
    const myOrder = Object.values(allOrders).find(o => o.name === userName)
    if (myOrder) {
      setLines((myOrder.lines||[]).map(l => ({ ...l, key: lKey(l.rid, l.iid, l.bt) })))
      setDrinks(myOrder.drinks || {})
      setNotes(myOrder.notes || {})
    } else { setLines([]); setDrinks({}); setNotes({}) }
    setIsEditing(true)
    setScreen('home')
  }

  // ── Repeat last order ──
  const repeatLastOrder = () => {
    const last = loadLastOrder()
    if (!last) return
    setLines(last.lines || [])
    setDrinks(last.drinks || {})
    setNotes(last.notes || {})
    setScreen('home')
  }

  // ── Submit ──
  const submitOrder = async () => {
    const hasAnything = lines.length > 0 || Object.values(drinks).some(q => q > 0)
    if (!hasAnything || submitting) return
    setSubmitting(true); setSubmitError('')
    try {
      const res = await api.submitOrder(sessionId, myId, { name:userName, lines, drinks, notes, telegram:telegramUser, phone:phoneUser })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      if (!json.ok) throw new Error('rejected')

      saveLastOrder(lines, drinks, notes)
      setIsEditing(false)
      setScreen('submitted')
    } catch (err) {
      setSubmitError(`مش قادر يبعت — تأكد إن السيرفر شغال`)
    } finally { setSubmitting(false) }
  }

  const handleAddItem    = (restId, item)       => setRests(p => p.map(r => r.id===restId ? {...r,items:[...r.items,item]} : r))
  const handleUpdatePrice = (restId,itemId,pr)  => setRests(p => p.map(r => r.id===restId ? {...r,items:r.items.map(i=>i.id===itemId?{...i,price:pr}:i)} : r))

  // Global complete state
  if (sessStatus==='complete' && screen!=='welcome' && screen!=='name' && screen!=='profile') {
    return <CompleteScreen userName={userName} allOrders={allOrders} delivery={delivery} sessionId={sessionId} sessionTitle={sessionTitle} announcement={announcement} breadTypes={breadTypes} rests={rests} restaurantStatuses={restaurantStatuses}/>
  }

  // Auth screens
  if (!isAuthenticated) {
    if (screen === 'welcome') {
      return (
        <WelcomeScreen 
          onStart={(mode) => {
            setAuthMode(mode)
            setScreen('login')
          }}
        />
      )
    }
    if (screen === 'login') {
      return authMode === 'login' ? (
        <LoginScreen onSwitchToRegister={() => setAuthMode('register')} onSuccess={() => setScreen('name')} onGuest={() => setScreen('name')} />
      ) : (
        <RegisterScreen onSwitchToLogin={() => setAuthMode('login')} onSuccess={() => setScreen('name')} onGuest={() => setScreen('name')} />
      )
    }
  }

  // Profile screen
  if (showProfile) {
    return <ProfileScreen onBack={() => setShowProfile(false)} />
  }

  const activeRest = rests.find(r => r.id === activeRid)
  const totalItems = lines.reduce((s,l) => s+l.qty, 0)
  const mySubmittedOrder = Object.values(allOrders).find(o => o.name === userName)
  const hasLastOrder = !!loadLastOrder()
  const filteredRests = rests.filter(r => 
    !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', background: '#FFF', minHeight: '100vh', boxShadow: '0 0 50px rgba(0,0,0,0.05)', position: 'relative' }}>
      {screen==='welcome' && <WelcomeScreen onStart={mode => { setAuthMode(mode); setScreen('login'); }} />}
      
      {screen==='login' && (
        authMode === 'login' ?
          <LoginScreen onSwitchToRegister={() => setAuthMode('register')} onSuccess={() => setScreen('home')} onGuest={() => setScreen('name')} /> :
          <RegisterScreen onSwitchToLogin={() => setAuthMode('login')} onSuccess={() => setScreen('home')} onGuest={() => setScreen('name')} />
      )}
      
      {screen==='name' && (
        <NameScreen
             sessionId={sessionId}
             hasLastOrder={hasLastOrder}
             initialName={userName}
             initialPhone={phoneUser}
             initialTelegram={telegramUser}
             onConfirm={(name,tg,ph,hist) => { 
               setUserName(name); 
               saveStoredName(name); 
               setTelegramUser(tg || ''); 
               saveStoredTelegram(tg || '');
               setPhoneUser(ph || '');
               saveStoredPhone(ph || '');
               if (hist) {
                 setLines(hist.lines || [])
                 setDrinks(hist.drinks || {})
                 setNotes(hist.notes || {})
               }
               if (Object.values(allOrders).some(o => o.name === name)) {
                 setScreen('submitted')
               } else {
                 setScreen('home') 
               }
             }}
             onRepeatLast={(name,tg,ph) => { 
               setUserName(name); 
               saveStoredName(name); 
               setTelegramUser(tg); 
               saveStoredTelegram(tg || '');
               setPhoneUser(ph);
               saveStoredPhone(ph);
               repeatLastOrder() 
             }}
          />
      )}
      
      {screen==='home' && (
        <HomeScreen
          userName={userName} sessionId={sessionId} rests={filteredRests} setRests={setRests}
          lines={lines} drinks={drinks} drinkTypes={drinkTypes} allOrders={allOrders} isEditing={isEditing}
          deadline={deadline} sessStatus={sessStatus} sessionTitle={sessionTitle} announcement={announcement} expected={expected} restaurantStatuses={restaurantStatuses}
          onGoMenu={rid => { setActiveRid(rid); setScreen('menu') }}
          onSubmit={submitOrder} submitting={submitting} submitError={submitError}
          onDrinkAdd={addD} onDrinkSub={subD}
          onCancelEdit={() => { setIsEditing(false); setLines([]); setDrinks({}); setNotes({}); setScreen('submitted') }}
          onOpenProfile={() => setShowProfile(true)}
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
          promoCode={promoCode}
          promoDiscount={promoDiscount}
          onApplyPromo={handleApplyPromo}
          phone={phoneUser}
          telegram={telegramUser}
        />
      )}
      
      {screen==='menu' && activeRest && (
        <MenuScreen
          activeRest={activeRest} lines={lines} notes={notes} totalItems={totalItems}
          breadTypes={breadTypes}
          onBack={() => setScreen('home')}
          onAddL={addL} onSubL={subL} onUpdatePrice= {handleUpdatePrice}
          onAddItem={handleAddItem} onSetNote={setNote}
        />
      )}
      
      {screen==='submitted' && (
        <SubmittedScreen
          sessionId={sessionId} userName={userName} allOrders={allOrders}
          sessStatus={sessStatus} myOrder={mySubmittedOrder} deadline={deadline} sessionTitle={sessionTitle} announcement={announcement} expected={expected} delivery={delivery} breadTypes={breadTypes} rests={rests} restaurantStatuses={restaurantStatuses}
          onGoSummary={() => setScreen('summary')} onEditOrder={startEditing}
        />
      )}
      
      {screen==='summary' && (
        <SummaryScreen
          sessionId={sessionId} allOrders={allOrders} delivery={delivery}
          rests={rests} drinkTypes={drinkTypes} breadTypes={breadTypes} sessStatus={sessStatus} deadline={deadline} sessionTitle={sessionTitle} announcement={announcement} expected={expected} restaurantStatuses={restaurantStatuses}
onBack={() => setScreen('submitted')} onEditOrder={startEditing}
        />
      )}

      {screen==='vote' && (
        <VoteScreen
          sessionId={sessionId} rests={rests}
          onBack={() => setScreen('home')}
        />
      )}
    </div>
  )
}
