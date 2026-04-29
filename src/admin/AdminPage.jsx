import { useEffect, useRef, useState } from 'react'
import {
  ShieldCheck, CheckCircle, RotateCcw, Trash2, Edit3, Copy, Check, Truck, Clock, Users,
  Printer, QrCode, ArrowLeft, Bell, MessageCircle, Settings, Plus, Save, Coffee, LogOut,
  RefreshCw, Wallet, FileText, Download
} from 'lucide-react'
import { C } from '../constants/colors.js'
import { fmt, genId, formatTime, getWhatsAppLink, inpSt } from '../utils/helpers.js'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import { Btn, GhostBtn } from '../components/Btn.jsx'
import CombinedTotals from '../components/CombinedTotals.jsx'
import Countdown from '../components/Countdown.jsx'
import { generateMD } from '../utils/markdown.js'
import {
  buildSessionCsv,
  downloadBlob,
  getDrinkBreakdown,
  getGrandTotal,
  getItemsTotal,
  getMissingMembers,
  getOrderTotal,
  getOrdersArray,
  getPaidSummary,
  getPerPersonDelivery,
  getRestaurantBreakdown,
} from '../utils/orders.js'

function QRModal({ url, onClose }) {
  const encoded = encodeURIComponent(url)
  return (
    <Modal title="شارك رابط الطلب" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'10px 0' }}>
        <div style={{ background:'#FFF', padding:20, borderRadius:20, display:'inline-block', boxShadow:'0 4px 20px rgba(0,0,0,0.05)', marginBottom:20 }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encoded}`}
            alt="QR"
            style={{ width:240, height:240 }}
          />
        </div>
        <div style={{ fontSize:13, color:C.muted, marginTop:12, wordBreak:'break-all', background:C.tag, borderRadius:12, padding:'12px 16px', fontWeight:600 }}>{url}</div>
        <p style={{ fontSize:14, color:C.primary, marginTop:16, fontWeight:700 }}>خلّي الناس تصور الكود أو افتحلهم الرابط مباشرة.</p>
      </div>
    </Modal>
  )
}

function buildWhatsAppText(orders, delivery, sid, paymentSummary) {
  const perPerson = getPerPersonDelivery(
    Object.fromEntries(orders.map(order => [order.uid, order])),
    delivery
  )
  let text = `*ملخص طلبات ساندوتشي* — ${sid}\n`
  text += `--------------------------\n`

  orders.forEach(order => {
    text += `👤 *${order.name}*: ${fmt(getOrderTotal(order, perPerson))} ج`
    text += order.paid ? ' ✅\n' : ' ⏳\n'
    ;(order.lines || []).forEach(line => {
      text += `• ${line.iname} ×${line.qty}${order.notes?.[line.key] ? ` (${order.notes[line.key]})` : ''}\n`
    })
    text += '\n'
  })

  text += `📊 *الإجمالي:* ${fmt(paymentSummary.totalDue)} ج\n`
  text += `💵 *المحصّل:* ${fmt(paymentSummary.totalPaid)} ج\n`
  text += `🚗 *التوصيل:* ${fmt(delivery)} ج`
  return text
}

function buildMissingReminderText(sid, missingMembers) {
  return `لسه مستنيين طلبات: ${missingMembers.join('، ')}\nرابط الطلب: ${window.location.origin}/?s=${sid}`
}

function NotificationButton({ enabled, onClick }) {
  return (
    <GhostBtn onClick={onClick} style={{ padding:'8px 12px' }}>
      <Bell size={18} color={enabled ? C.green : C.primary}/>
    </GhostBtn>
  )
}

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [usingDefaults, setUsingDefaults] = useState(false)
  const [authUsr, setAuthUsr] = useState('')
  const [authPwd, setAuthPwd] = useState('')
  const [authErr, setAuthErr] = useState('')

  const [sid, setSid] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [sessionFilter, setSessionFilter] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [allOrders, setAllOrders] = useState({})
  const [delivery, setDelivery] = useState(0)
  const [deliveryInput, setDeliveryInput] = useState('')
  const [status, setStatus] = useState('open')
  const [deadline, setDeadlineState] = useState(null)
  const [expected, setExpectedState] = useState([])
  const [sessionTitle, setSessionTitle] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [breadTypes, setBreadTypes] = useState([])
  const [rests, setRests] = useState([])
  const [drinks, setDrinks] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [menuTab, setMenuTab] = useState('rests')
  const [newBread, setNewBread] = useState({ ar:'', color:'#B83A0A' })
  const [copied, setCopied] = useState('')
  const [editOrder, setEditOrder] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [savingDel, setSavingDel] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showExpected, setShowExpected] = useState(false)
  const [expectedInput, setExpectedInput] = useState('')
  const [deadlineInput, setDeadlineInput] = useState('')
  const [desktopNotifications, setDesktopNotifications] = useState(() => localStorage.getItem('sandwitchy_admin_notifications') === 'true')
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false)
  const [bulkPayLoading, setBulkPayLoading] = useState('')

  const evtRef = useRef(null)
  const prevCount = useRef(0)

  const orders = getOrdersArray(allOrders)
  const numPeople = orders.length
  const perPerson = getPerPersonDelivery(allOrders, delivery)
  const missingMembers = getMissingMembers(expected, allOrders)
  const paymentSummary = getPaidSummary(allOrders, delivery)
  const restaurantBreakdown = getRestaurantBreakdown(allOrders, rests)
  const drinkBreakdown = getDrinkBreakdown(allOrders, drinks)
  const filteredOrders = orders.filter(order => {
    if (showUnpaidOnly && order.paid) return false
    const query = orderSearch.trim().toLowerCase()
    if (!query) return true
    return (
      order.name.toLowerCase().includes(query) ||
      (order.phone || '').toLowerCase().includes(query) ||
      (order.telegram || '').toLowerCase().includes(query) ||
      (order.lines || []).some(line => (line.iname || '').toLowerCase().includes(query))
    )
  })

  const syncUrl = nextSid => {
    const url = new URL(window.location.href)
    url.searchParams.set('admin', '1')
    if (nextSid) url.searchParams.set('s', nextSid)
    else url.searchParams.delete('s')
    window.history.replaceState({}, '', url)
  }

  const handleAdminError = error => {
    if (error?.status === 401) {
      setIsAuthenticated(false)
      setSid('')
      setAuthErr('انتهت جلسة الإدارة. سجّل دخول تاني.')
      syncUrl('')
    }
  }

  const guarded = async task => {
    try {
      return await task()
    } catch (error) {
      handleAdminError(error)
      throw error
    }
  }

  const refreshAdminSessions = async () => {
    if (!isAuthenticated) return
    setSessionsLoading(true)
    try {
      const response = await guarded(() => api.getAdminSessions())
      setSessions(response.sessions || [])
      setUsingDefaults(!!response.usingDefaultCredentials)
    } catch (_) {
      // handled centrally
    } finally {
      setSessionsLoading(false)
    }
  }

  const refreshSettings = async () => {
    const settings = await api.getSettings()
    setBreadTypes(settings.bread_types || [])
    setRests(settings.rests || [])
    setDrinks(settings.drinks || [])
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const session = params.get('s') || ''
    setSid(session)

    api.adminMe()
      .then(data => {
        setIsAuthenticated(true)
        setUsingDefaults(!!data.usingDefaultCredentials)
      })
      .catch(error => {
        if (error?.status !== 401) setAuthErr('في مشكلة في التحقق من الدخول')
      })
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    refreshAdminSessions()
  }, [isAuthenticated])

  useEffect(() => {
    if (!sid) {
      evtRef.current?.close()
      return
    }

    evtRef.current?.close()
    const connect = () => {
      const source = new EventSource(`/events/${sid}`)
      source.onmessage = event => {
        try {
          const payload = JSON.parse(event.data)
          setAllOrders(payload.orders || {})
          setDelivery(payload.delivery || 0)
          setDeliveryInput(String(payload.delivery || ''))
          setStatus(payload.status || 'open')
          setDeadlineState(payload.deadline || null)
          setExpectedState(payload.expected || [])
          setSessionTitle(payload.title || '')
          setAnnouncement(payload.announcement || '')
        } catch (_) {}
      }
      source.onerror = () => {
        source.close()
        setTimeout(connect, 3000)
      }
      evtRef.current = source
    }

    connect()
    refreshSettings().catch(() => {})
    return () => evtRef.current?.close()
  }, [sid])

  useEffect(() => {
    const count = orders.length
    if (count > prevCount.current && prevCount.current > 0) {
      const newest = orders[orders.length - 1]
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(520, ctx.currentTime)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      } catch (_) {}

      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])

      if (
        desktopNotifications &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('طلب جديد في ساندوتشي', {
          body: newest ? `${newest.name} بعت طلبه` : 'وصل طلب جديد',
        })
      }
    }
    prevCount.current = count
  }, [orders, desktopNotifications])

  const requestDesktopNotifications = async () => {
    if (typeof Notification === 'undefined') return
    const permission = await Notification.requestPermission()
    const enabled = permission === 'granted'
    setDesktopNotifications(enabled)
    localStorage.setItem('sandwitchy_admin_notifications', enabled ? 'true' : 'false')
  }

  const enterSid = nextSid => {
    setSid(nextSid)
    setInputCode(nextSid)
    syncUrl(nextSid)
  }

  const leaveSession = () => {
    setSid('')
    setInputCode('')
    setAllOrders({})
    setDelivery(0)
    setDeliveryInput('')
    setStatus('open')
    setDeadlineState(null)
    setExpectedState([])
    setSessionTitle('')
    setAnnouncement('')
    syncUrl('')
    refreshAdminSessions()
  }

  const copyText = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const orderLink = currentSid => {
    const url = new URL(window.location.origin)
    url.searchParams.set('s', currentSid)
    return url.toString()
  }

  const handleDelivery = async () => {
    setSavingDel(true)
    try {
      await guarded(() => api.setDelivery(sid, parseFloat(deliveryInput) || 0))
      refreshAdminSessions()
    } catch (_) {
      // handled centrally
    } finally {
      setSavingDel(false)
    }
  }

  const handleSetDeadline = async () => {
    if (!deadlineInput) return
    try {
      await guarded(() => api.setDeadline(sid, new Date(deadlineInput).toISOString()))
      setDeadlineInput('')
      refreshAdminSessions()
    } catch (_) {}
  }

  const clearDeadline = async () => {
    try {
      await guarded(() => api.setDeadline(sid, null))
      refreshAdminSessions()
    } catch (_) {}
  }

  const saveExpected = async () => {
    const names = expectedInput.split('\n').map(name => name.trim()).filter(Boolean)
    try {
      await guarded(() => api.setExpected(sid, names))
      setShowExpected(false)
      refreshAdminSessions()
    } catch (_) {}
  }

  const saveSessionMeta = async () => {
    setSavingMeta(true)
    try {
      await guarded(() => api.setSessionMeta(sid, { title: sessionTitle, announcement }))
      refreshAdminSessions()
    } catch (_) {
      // handled centrally
    } finally {
      setSavingMeta(false)
    }
  }

  const handleReset = async () => {
    try {
      await guarded(() => api.resetSession(sid))
      setConfirmReset(false)
      leaveSession()
    } catch (_) {}
  }

  const saveEditOrder = async () => {
    if (!editOrder) return
    try {
      await guarded(() => api.patchLines(sid, editOrder.uid, editOrder.lines))
      setEditOrder(null)
      refreshAdminSessions()
    } catch (_) {}
  }

  const togglePaid = async order => {
    try {
      await guarded(() => api.setPayment(sid, order.uid, !order.paid, getOrderTotal(order, perPerson)))
      refreshAdminSessions()
    } catch (_) {}
  }

  const bulkSetPayments = async paid => {
    const targetOrders = paid ? orders.filter(order => !order.paid) : orders.filter(order => order.paid)
    if (targetOrders.length === 0) return
    setBulkPayLoading(paid ? 'paid' : 'unpaid')
    try {
      await Promise.all(
        targetOrders.map(order =>
          guarded(() => api.setPayment(sid, order.uid, paid, paid ? getOrderTotal(order, perPerson) : null))
        )
      )
      refreshAdminSessions()
    } catch (_) {
      // handled centrally
    } finally {
      setBulkPayLoading('')
    }
  }

  const deleteOrder = async uid => {
    try {
      await guarded(() => api.deleteOrder(sid, uid))
      refreshAdminSessions()
    } catch (_) {}
  }

  const saveSettings = async key => {
    const value = key === 'bread_types' ? breadTypes : key === 'rests' ? rests : drinks
    setSavingSettings(true)
    try {
      await guarded(() => api.updateSettings(key, value))
      refreshAdminSessions()
    } catch (_) {
      // handled centrally
    } finally {
      setSavingSettings(false)
    }
  }

  const addBreadType = () => {
    if (!newBread.ar.trim()) return
    const id = newBread.ar.toLowerCase().replace(/\s+/g, '_')
    setBreadTypes(prev => [...prev, { ...newBread, id, light: `${newBread.color}11` }])
    setNewBread({ ar:'', color:'#B83A0A' })
  }

  const updateRest = (index, updater) => {
    setRests(prev => prev.map((rest, i) => (i === index ? updater(rest) : rest)))
  }

  const updateDrink = (index, updater) => {
    setDrinks(prev => prev.map((drink, i) => (i === index ? updater(drink) : drink)))
  }

  const shareWhatsApp = () => {
    const text = buildWhatsAppText(orders, delivery, sid, paymentSummary)
    window.open(getWhatsAppLink(text), '_blank')
  }

  const shareMissingReminder = () => {
    const text = buildMissingReminderText(sid, missingMembers)
    window.open(getWhatsAppLink(text), '_blank')
  }

  const handleLogin = async () => {
    try {
      const data = await api.adminLogin(authUsr, authPwd)
      setIsAuthenticated(true)
      setUsingDefaults(!!data.usingDefaultCredentials)
      setAuthErr('')
      refreshAdminSessions()
    } catch (error) {
      setAuthErr(error?.status === 401 ? 'اليوزر أو الباسورد غلط' : 'حصلت مشكلة أثناء تسجيل الدخول')
    }
  }

  const handleLogout = async () => {
    try {
      await api.adminLogout()
    } catch (_) {}
    setIsAuthenticated(false)
    setSid('')
    syncUrl('')
  }

  const filteredSessions = sessions.filter(session => {
    const q = sessionFilter.trim().toLowerCase()
    if (!q) return true
    return (
      session.sid.toLowerCase().includes(q) ||
      (session.title || '').toLowerCase().includes(q) ||
      (session.names || []).some(name => name.toLowerCase().includes(q))
    )
  })

  if (!authChecked) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="glass-card" style={{ padding:'28px 32px', fontWeight:800, color:C.primary }}>جاري تجهيز لوحة الإدارة...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }} className="animate-fade-in">
        <div style={{ width:'100%', maxWidth:420 }} className="glass-card">
          <div style={{ padding:40, textAlign:'center' }}>
            <div style={{ width:80, height:80, borderRadius:24, background:C.gradAdmin, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', boxShadow:'0 10px 25px rgba(16,185,129,0.3)', color:'#FFF' }}>
              <ShieldCheck size={40} />
            </div>
            <h1 style={{ fontSize:26, fontWeight:900, color:C.dark, marginBottom:8 }}>دخول الإدارة</h1>
            <p style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:20 }}>سجّل دخول مرة واحدة عشان تتحكم في الجلسات وتحصيل الحسابات.</p>

            {usingDefaults && (
              <div style={{ background:'#FEF3C7', color:'#92400E', borderRadius:14, padding:'12px 14px', fontSize:12, fontWeight:800, marginBottom:16 }}>
                شغالين حالياً على بيانات الدخول الافتراضية. غيّر `ADMIN_USERNAME` و`ADMIN_PASSWORD` قبل أي نشر حقيقي.
              </div>
            )}

            <input
              type="text"
              placeholder="اسم المستخدم"
              value={authUsr}
              onChange={e => setAuthUsr(e.target.value)}
              style={{ ...inpSt({ textAlign:'center', fontSize:16, marginBottom:12 }), direction:'ltr' }}
              autoFocus
            />

            <input
              type="password"
              placeholder="كلمة المرور"
              value={authPwd}
              onChange={e => setAuthPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...inpSt({ textAlign:'center', fontSize:16, marginBottom:20 }), direction:'ltr' }}
            />

            {authErr && <div style={{ color:C.red, fontSize:13, fontWeight:700, marginBottom:16 }}>{authErr}</div>}

            <Btn onClick={handleLogin} color={C.gradAdmin} style={{ width:'100%', height:56 }}>
              دخول <ArrowLeft size={20} style={{ marginRight:8 }}/>
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  if (!sid) {
    return (
      <div style={{ minHeight:'100vh', padding:'24px' }} className="animate-fade-in">
        <div className="glass-header no-print" style={{ padding:'16px 18px', margin:'-24px -24px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:20, fontWeight:950, color:C.dark, display:'flex', alignItems:'center', gap:8 }}>
                <ShieldCheck size={20} color={C.green}/> لوحة إدارة ساندوتشي
              </div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginTop:4 }}>إدارة الجلسات المفتوحة، التحصيل، والمنيو من مكان واحد.</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <NotificationButton enabled={desktopNotifications} onClick={requestDesktopNotifications}/>
              <GhostBtn onClick={refreshAdminSessions} style={{ padding:'8px 12px' }}><RefreshCw size={18}/></GhostBtn>
              <GhostBtn onClick={handleLogout} color={C.red} style={{ padding:'8px 12px' }}><LogOut size={18}/></GhostBtn>
            </div>
          </div>
        </div>

        {usingDefaults && (
          <div style={{ background:'#FEF3C7', color:'#92400E', borderRadius:16, padding:'14px 18px', fontSize:13, fontWeight:800, marginBottom:20 }}>
            تنبيه أمان: السيرفر شغال حالياً ببيانات دخول افتراضية. اضبط `ADMIN_USERNAME` و`ADMIN_PASSWORD` ويفضل كمان `ADMIN_SESSION_SECRET`.
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16, marginBottom:24 }}>
          <div className="glass-card" style={{ padding:22 }}>
            <div style={{ fontSize:16, fontWeight:900, color:C.dark, marginBottom:10 }}>ابدأ جلسة جديدة</div>
            <div style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:18 }}>هنولّد كود جديد وندخلك مباشرة على لوحة الجلسة.</div>
            <Btn onClick={() => enterSid(genId())} color={C.gradAdmin} style={{ width:'100%', height:54 }}>
              <Plus size={18}/> جلسة جديدة
            </Btn>
          </div>

          <div className="glass-card" style={{ padding:22 }}>
            <div style={{ fontSize:16, fontWeight:900, color:C.dark, marginBottom:10 }}>افتح جلسة بالكود</div>
            <input
              type="text"
              placeholder="مثلاً: ZH1INJ"
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              style={inpSt({ textAlign:'center', fontSize:20, fontWeight:900, letterSpacing:4, marginBottom:16 })}
            />
            <Btn onClick={() => inputCode.length >= 4 && enterSid(inputCode)} disabled={inputCode.length < 4} style={{ width:'100%', height:54 }}>
              افتح الجلسة <ArrowLeft size={18}/>
            </Btn>
          </div>
        </div>

        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:C.dark }}>الجلسات الحالية</div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700 }}>افتح أي جلسة من اللي شغالة دلوقتي وتابع تحصيلها.</div>
            </div>
            <div style={{ minWidth:240, flex:1, maxWidth:320 }}>
              <input
                type="text"
                placeholder="ابحث بالكود أو الاسم"
                value={sessionFilter}
                onChange={e => setSessionFilter(e.target.value)}
                style={inpSt({ paddingRight:40 })}
              />
              <Search size={16} style={{ position:'relative', top:-36, right:12, color:C.muted }}/>
            </div>
          </div>

          {sessionsLoading ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:C.muted, fontWeight:800 }}>بنحدّث الجلسات...</div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:C.muted, fontWeight:800 }}>لا توجد جلسات مطابقة حالياً.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14 }}>
              {filteredSessions.map(session => (
                <div key={session.sid} className="glass-card" style={{ padding:18, border:session.status === 'open' ? `1px solid ${C.green}33` : `1px solid ${C.border}` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:950, color:C.dark }}>{session.sid}</div>
                      {session.title && <div style={{ fontSize:12, fontWeight:800, color:C.primary, marginTop:4 }}>{session.title}</div>}
                      <div style={{ fontSize:11, fontWeight:700, color:session.status === 'open' ? C.green : C.muted }}>
                        {session.status === 'open' ? 'مفتوحة الآن' : 'مقفولة'} · {session.count} مشاركين
                      </div>
                    </div>
                    <div style={{ background:C.primaryLight, color:C.primary, borderRadius:12, padding:'6px 10px', fontSize:12, fontWeight:900 }}>
                      {fmt(session.total)} ج
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                    <div style={{ background:C.tag, borderRadius:12, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, color:C.muted, fontWeight:700 }}>التحصيل</div>
                      <div style={{ fontSize:16, fontWeight:900, color:C.dark }}>{session.paidCount}/{session.count}</div>
                    </div>
                    <div style={{ background:C.tag, borderRadius:12, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, color:C.muted, fontWeight:700 }}>المتأخرين</div>
                      <div style={{ fontSize:16, fontWeight:900, color:session.missingCount > 0 ? C.red : C.green }}>{session.missingCount}</div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:8 }}>
                    <Btn onClick={() => enterSid(session.sid)} style={{ flex:1, height:44 }}>
                      افتحها
                    </Btn>
                    <GhostBtn onClick={() => copyText(orderLink(session.sid), `session-${session.sid}`)} style={{ padding:'0 14px', height:44 }}>
                      {copied === `session-${session.sid}` ? <Check size={16} color={C.green}/> : <Copy size={16}/>}
                    </GhostBtn>
                    {session.status === 'open' && (
                      <button onClick={() => guarded(() => api.complete(session.sid)).then(() => refreshAdminSessions()).catch(() => {})} 
                        style={{ padding:'0 10px', height:44, background:C.green, color:'#FFF', border:'none', borderRadius:12, fontSize:12, fontWeight:800, cursor:'pointer' }}>
                        إغلاق
                      </button>
                    )}
                    <button onClick={() => { if(confirm(`حذف جلسة ${session.sid}؟`)) guarded(() => api.resetSession(session.sid)).then(() => refreshAdminSessions()).catch(() => {}) }} 
                      style={{ padding:'0 10px', height:44, background:C.redLight, color:C.red, border:'none', borderRadius:12, fontSize:12, fontWeight:800, cursor:'pointer' }}>
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:60 }} className="animate-fade-in">
      <div className="glass-header no-print" style={{ padding:'16px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, display:'flex', alignItems:'center', gap:8 }}>
              <ShieldCheck size={20} color={C.green}/> {sessionTitle || 'لوحة التحكم'} <span className="live-indicator"></span>
            </div>
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginTop:2 }}>
              {status === 'complete' ? '✅ الطلب مكتمل' : '🟢 يتم المتابعة حالياً'} · {sid}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Btn onClick={shareWhatsApp} color="#25D366" style={{ padding:'0 16px', height:40 }}>
              <MessageCircle size={18}/> واتساب
            </Btn>
            <NotificationButton enabled={desktopNotifications} onClick={requestDesktopNotifications}/>
            <GhostBtn onClick={() => setShowSettings(true)} style={{ padding:'8px 12px' }}><Settings size={18}/></GhostBtn>
            <GhostBtn onClick={() => setShowQR(true)} style={{ padding:'8px 12px' }}><QrCode size={18}/></GhostBtn>
            <GhostBtn onClick={() => copyText(orderLink(sid), 'link')} style={{ padding:'8px 12px' }}>
              {copied === 'link' ? <Check size={18} color={C.green}/> : <Copy size={18}/>}
            </GhostBtn>
            <GhostBtn onClick={leaveSession} style={{ padding:'8px 12px' }}><ArrowLeft size={18}/></GhostBtn>
            <GhostBtn onClick={handleLogout} color={C.red} style={{ padding:'8px 12px' }}><LogOut size={18}/></GhostBtn>
          </div>
        </div>
      </div>

      <div style={{ padding:'24px', maxWidth:1300, margin:'0 auto' }}>
        {usingDefaults && (
          <div style={{ background:'#FEF3C7', color:'#92400E', borderRadius:16, padding:'14px 18px', fontSize:13, fontWeight:800, marginBottom:20 }}>
            تنبيه أمان: غيّر بيانات الدخول الافتراضية ومتغير `ADMIN_SESSION_SECRET` قبل أي استخدام خارجي.
          </div>
        )}

        <div className="glass-card" style={{ padding:18, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1.4fr auto', gap:10, alignItems:'start' }}>
            <input
              type="text"
              placeholder="عنوان الجلسة"
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              style={inpSt({ height:46 })}
            />
            <textarea
              placeholder="إعلان أو ملاحظة تظهر لكل المستخدمين"
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              style={{ ...inpSt({ minHeight: 84, resize: 'vertical' }) }}
            />
            <Btn onClick={saveSessionMeta} loading={savingMeta} style={{ minWidth:120, height:46, boxShadow:'none' }}>
              <Save size={16}/> حفظ
            </Btn>
          </div>
        </div>

        <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16, marginBottom:24 }}>
          <div className="glass-card" style={{ padding:20, textAlign:'center' }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:8 }}>عدد الأشخاص</div>
            <div style={{ fontSize:32, fontWeight:950, color:C.primary }}>{numPeople}</div>
          </div>
          <div className="glass-card" style={{ padding:20, textAlign:'center', background:C.grad, color:'#FFF' }}>
            <div style={{ fontSize:13, fontWeight:700, opacity:0.8, marginBottom:8 }}>إجمالي الحساب</div>
            <div style={{ fontSize:32, fontWeight:950 }}>{fmt(getGrandTotal(allOrders, delivery))} <span style={{ fontSize:14 }}>ج</span></div>
          </div>
          <div className="glass-card" style={{ padding:20, textAlign:'center' }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:8 }}>المحصّل / المتبقي</div>
            <div style={{ fontSize:22, fontWeight:950, color:C.green }}>{fmt(paymentSummary.totalPaid)} ج</div>
            <div style={{ fontSize:12, fontWeight:800, color: paymentSummary.remaining > 0 ? C.red : C.green }}>متبقي {fmt(paymentSummary.remaining)} ج</div>
          </div>
          <div className="glass-card" style={{ padding:20, textAlign:'center' }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:8 }}>اللي لسه ماطلبوش</div>
            <div style={{ fontSize:32, fontWeight:950, color: missingMembers.length > 0 ? C.red : C.green }}>{missingMembers.length}</div>
          </div>
        </div>

        <div className="actions-row no-print" style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
          {status === 'open' ? (
            <Btn onClick={() => guarded(() => api.complete(sid)).then(refreshAdminSessions).catch(() => {})} color={C.gradAdmin} style={{ flex:1, minWidth:180, height:50 }}>
              <CheckCircle size={18}/> تسليم الطلب
            </Btn>
          ) : (
            <Btn onClick={() => guarded(() => api.reopen(sid)).then(refreshAdminSessions).catch(() => {})} color={C.accent} style={{ flex:1, minWidth:180, height:50 }}>
              <RotateCcw size={18}/> إعادة فتح
            </Btn>
          )}
          <Btn onClick={() => window.print()} color={C.dark} style={{ flex:1, minWidth:160, height:50 }}>
            <Printer size={18}/> طباعة
          </Btn>
          <Btn onClick={() => { if(confirm('حذف هذه الجلسة؟ لا يمكن التراجع بعد الحذف.')) guarded(() => api.resetSession(sid)).then(leaveSession).catch(() => {}) }} color={C.red} style={{ flex:1, minWidth:160, height:50 }}>
            <Trash2 size={18}/> حذف
          </Btn>
          <Btn onClick={() => downloadBlob(`talabati-${sid}.md`, generateMD(allOrders, delivery, sid, { breadTypes, drinkTypes: drinks, rests }), 'text/markdown;charset=utf-8')} color={C.primary} style={{ flex:1, minWidth:160, height:50 }}>
            <FileText size={18}/> MD
          </Btn>
          <Btn onClick={() => downloadBlob(`talabati-${sid}.csv`, buildSessionCsv(allOrders, delivery), 'text/csv;charset=utf-8')} color={C.gradAdmin} style={{ flex:1, minWidth:160, height:50 }}>
            <Download size={18}/> CSV
          </Btn>
          <GhostBtn onClick={() => setConfirmReset(true)} color={C.red} style={{ height:50, padding:'0 20px' }}>
            <Trash2 size={18}/>
          </GhostBtn>
        </div>

        <div className="admin-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0, 2fr) minmax(320px, 1fr)', gap:24, alignItems:'start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              <div style={{ fontSize:16, fontWeight:900, color:C.dark }}>📋 قائمة الطلبات</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <input
                  type="text"
                  placeholder="ابحث باسم / صنف / رقم"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  style={{ ...inpSt({ width: 220, height: 40, fontSize: 13 }) }}
                />
                <GhostBtn onClick={() => setShowUnpaidOnly(value => !value)} color={showUnpaidOnly ? C.red : C.primary} style={{ height:40, justifyContent:'center' }}>
                  {showUnpaidOnly ? 'عرض الكل' : 'غير المدفوع فقط'}
                </GhostBtn>
              </div>
            </div>
            {orders.length === 0 ? (
              <div className="glass-card" style={{ textAlign:'center', padding:'60px 0' }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🍩</div>
                <p style={{ fontSize:15, fontWeight:700, color:C.muted }}>لسه مفيش حد طلب حاجة</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="glass-card" style={{ textAlign:'center', padding:'40px 0' }}>
                <p style={{ fontSize:15, fontWeight:700, color:C.muted }}>مفيش طلبات مطابقة للفلتر الحالي.</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))', gap:16 }}>
                {filteredOrders.map(order => (
                  <div key={order.uid} className="glass-card" style={{ overflow:'hidden' }}>
                    <div style={{ padding:'14px 16px', background:`${order.paid ? C.green : C.primary}08`, display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:38, height:38, borderRadius:10, background:order.paid ? C.gradAdmin : C.grad, color:'#FFF', fontWeight:900, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {order.name[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:900, color:C.dark }}>{order.name}</div>
                        <div style={{ fontSize:10, color:C.muted, fontWeight:700 }}>🕐 {formatTime(order.submittedAt)}</div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => setEditOrder({ uid:order.uid, name:order.name, lines:[...(order.lines || [])] })} style={{ width:30, height:30, borderRadius:8, background:C.tag, border:'none', color:C.primary, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Edit3 size={14}/>
                        </button>
                        <button onClick={() => deleteOrder(order.uid)} style={{ width:30, height:30, borderRadius:8, background:C.redLight, border:'none', color:C.red, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>

                    <div style={{ padding:'14px 16px' }}>
                      {(order.phone || order.telegram) && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                          {order.phone && <div style={{ background:C.tag, color:C.dark, borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:800 }}>📱 {order.phone}</div>}
                          {order.telegram && <div style={{ background:C.tag, color:C.primary, borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:800 }}>@{order.telegram}</div>}
                        </div>
                      )}

                      {(order.lines || []).map((line, index) => (
                        <div key={index} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, gap:12 }}>
                          <div style={{ fontSize:13, fontWeight:700 }}>
                            {line.iname} <span style={{ color:C.muted, marginRight:4 }}>×{line.qty}</span>
                            {order.notes?.[line.key] && <div style={{ fontSize:10, color:'#92400E', background:'#FEF9C3', borderRadius:6, padding:'1px 6px', marginTop:3 }}>📝 {order.notes[line.key]}</div>}
                          </div>
                          <span style={{ fontSize:13, fontWeight:800 }}>{line.price * line.qty} ج</span>
                        </div>
                      ))}

                      <div style={{ borderTop:'1px dashed var(--border)', marginTop:10, paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:C.muted }}>الإجمالي مع التوصيل</span>
                        <span style={{ fontSize:16, fontWeight:950, color:C.primary }}>{fmt(getOrderTotal(order, perPerson))} ج</span>
                      </div>

                      <div style={{ display:'flex', gap:8, marginTop:12 }}>
                        <Btn
                          onClick={() => togglePaid(order)}
                          color={order.paid ? C.red : C.gradAdmin}
                          style={{ flex:1, height:42, fontSize:13, boxShadow:'none' }}
                        >
                          <Wallet size={15}/> {order.paid ? 'إلغاء الدفع' : 'تم الدفع'}
                        </Btn>
                        <div style={{ minWidth:112, background:order.paid ? C.greenLight : C.redLight, color:order.paid ? C.green : C.red, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900 }}>
                          {order.paid ? `مدفوع ${fmt(order.paidAmount ?? getOrderTotal(order, perPerson))} ج` : 'غير مدفوع'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div className="glass-card" style={{ padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:900, color:C.dark, display:'flex', alignItems:'center', gap:6 }}>
                  <Users size={16} color={C.purple}/> المتأخرين عن الطلب
                </div>
                <GhostBtn onClick={() => { setExpectedInput(expected.join('\n')); setShowExpected(true) }} style={{ padding:'4px 8px', height:28, fontSize:11 }}>
                  تعديل
                </GhostBtn>
              </div>
              {expected.length === 0 ? (
                <p style={{ fontSize:12, color:C.muted, textAlign:'center' }}>لا توجد قائمة متابعة بعد.</p>
              ) : missingMembers.length === 0 ? (
                <div style={{ color:C.green, textAlign:'center', fontWeight:800, fontSize:13 }}>🎉 كله طلب بالفعل</div>
              ) : (
                <>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                    {missingMembers.map(name => (
                      <div key={name} style={{ background:'#FEF3C7', color:'#92400E', borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:800 }}>{name}</div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <Btn onClick={shareMissingReminder} color="#25D366" style={{ flex:1, height:40, boxShadow:'none', fontSize:13 }}>
                      <MessageCircle size={14}/> تذكير
                    </Btn>
                    <GhostBtn onClick={() => copyText(buildMissingReminderText(sid, missingMembers), 'missing')} style={{ flex:1, height:40, justifyContent:'center' }}>
                      {copied === 'missing' ? <Check size={14} color={C.green}/> : <Copy size={14}/>}
                      نسخ النص
                    </GhostBtn>
                  </div>
                </>
              )}
            </div>

            <div className="glass-card" style={{ padding:16 }}>
              <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <Clock size={16} color={C.accent}/> المؤقت
              </div>
              {deadline ? (
                <div>
                  <Countdown deadline={deadline} />
                  <GhostBtn onClick={clearDeadline} color={C.red} style={{ width:'100%', marginTop:8, height:36, justifyContent:'center' }}>
                    إلغاء
                  </GhostBtn>
                </div>
              ) : (
                <div style={{ display:'flex', gap:8 }}>
                  <input type="datetime-local" value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} style={inpSt({ flex:1, fontSize:12 })}/>
                  <Btn onClick={handleSetDeadline} disabled={!deadlineInput} style={{ padding:'0 12px', height:36, boxShadow:'none' }}>
                    تفعيل
                  </Btn>
                </div>
              )}
            </div>

            <div className="glass-card" style={{ padding:16 }}>
              <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <Truck size={16} color={C.primary}/> التوصيل
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="number" placeholder="0" value={deliveryInput} onChange={e => setDeliveryInput(e.target.value)} style={inpSt({ flex:1, fontSize:16, fontWeight:800, textAlign:'center' })}/>
                <Btn onClick={handleDelivery} loading={savingDel} style={{ padding:'0 16px', height:40, boxShadow:'none' }}>
                  حفظ
                </Btn>
              </div>
              <div style={{ marginTop:10, fontSize:12, color:C.muted, fontWeight:700 }}>نصيب الفرد حالياً: {fmt(perPerson)} ج</div>
            </div>

            <div className="glass-card" style={{ padding:16 }}>
              <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <Wallet size={16} color={C.green}/> التحصيل
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ background:C.greenLight, borderRadius:12, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, color:C.green, fontWeight:800 }}>تم دفعه</div>
                  <div style={{ fontSize:18, fontWeight:950, color:C.green }}>{fmt(paymentSummary.totalPaid)} ج</div>
                </div>
                <div style={{ background:C.redLight, borderRadius:12, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, color:C.red, fontWeight:800 }}>المتبقي</div>
                  <div style={{ fontSize:18, fontWeight:950, color:C.red }}>{fmt(paymentSummary.remaining)} ج</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
                <Btn onClick={() => bulkSetPayments(true)} loading={bulkPayLoading === 'paid'} style={{ height:40, fontSize:12, boxShadow:'none' }}>
                  دفع الكل
                </Btn>
                <GhostBtn onClick={() => bulkSetPayments(false)} color={C.red} style={{ height:40, justifyContent:'center', fontSize:12 }}>
                  رجّع الكل غير مدفوع
                </GhostBtn>
              </div>
            </div>

            {restaurantBreakdown.length > 0 && (
              <div className="glass-card" style={{ padding:16 }}>
                <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12 }}>🍽️ تجميع المطاعم</div>
                <div style={{ display:'grid', gap:8 }}>
                  {restaurantBreakdown.map(rest => (
                    <div key={rest.id} style={{ background:C.tag, borderRadius:12, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:900, color:C.dark }}>{rest.name}</div>
                        <div style={{ fontSize:11, color:C.muted, fontWeight:700 }}>{rest.items} قطعة · {rest.peopleCount} أشخاص</div>
                      </div>
                      <div style={{ fontSize:14, fontWeight:900, color:C.primary }}>{fmt(rest.total)} ج</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drinkBreakdown.length > 0 && (
              <div className="glass-card" style={{ padding:16 }}>
                <div style={{ fontSize:14, fontWeight:900, color:C.dark, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                  <Coffee size={16} color={C.green}/> المشروبات
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {drinkBreakdown.map(drink => (
                    <div key={drink.id} style={{ display:'flex', alignItems:'center', gap:6, background:C.tag, borderRadius:12, padding:'8px 10px' }}>
                      <span>{drink.emoji}</span>
                      <span style={{ fontSize:12, fontWeight:800, color:C.dark }}>{drink.name}</span>
                      <span style={{ fontSize:12, fontWeight:900, color:C.green }}>×{drink.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize:15, fontWeight:900, color:C.dark, marginTop:4 }}>📊 الملخص المجمع</div>
            <CombinedTotals allOrders={allOrders} breadTypes={breadTypes}/>
          </div>
        </div>
      </div>

      {showQR && <QRModal url={orderLink(sid)} onClose={() => setShowQR(false)}/>}

      {showExpected && (
        <Modal title="قائمة الأشخاص" onClose={() => setShowExpected(false)}>
          <textarea value={expectedInput} onChange={e => setExpectedInput(e.target.value)} placeholder="اسم في كل سطر" style={{ ...inpSt({ direction:'rtl' }), height:160, marginBottom:16 }}/>
          <Btn onClick={saveExpected} style={{ width:'100%' }}>حفظ القائمة</Btn>
        </Modal>
      )}

      {confirmReset && (
        <Modal title="تنبيه: مسح الجلسة" onClose={() => setConfirmReset(false)}>
          <div style={{ textAlign:'center' }}>
            <p style={{ color:C.muted, fontSize:14, marginBottom:20 }}>هل أنت متأكد من مسح الجلسة؟ دي هتمسح الطلبات والتحصيل للجلسة الحالية.</p>
            <div style={{ display:'flex', gap:10 }}>
              <GhostBtn onClick={() => setConfirmReset(false)} style={{ flex:1, justifyContent:'center' }}>إلغاء</GhostBtn>
              <Btn onClick={handleReset} style={{ flex:1, background:C.red }}>نعم، امسح</Btn>
            </div>
          </div>
        </Modal>
      )}

      {editOrder && (
        <Modal title={`تعديل طلب ${editOrder.name}`} onClose={() => setEditOrder(null)} wide>
          <p style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:12 }}>أي تعديل هنا بيرجّع حالة الدفع لـ "غير مدفوع" عشان الحساب يتراجع من جديد.</p>
          {editOrder.lines.map((line, index) => (
            <div key={index} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700 }}>{line.iname}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={() => setEditOrder(prev => ({ ...prev, lines: prev.lines.map((item, i) => i !== index ? item : item.qty <= 1 ? null : { ...item, qty: item.qty - 1 }).filter(Boolean) }))} style={{ width:24, height:24, borderRadius:6, border:'none', background:C.tag }}>−</button>
                <span style={{ fontSize:14, fontWeight:900 }}>{line.qty}</span>
                <button onClick={() => setEditOrder(prev => ({ ...prev, lines: prev.lines.map((item, i) => i !== index ? item : { ...item, qty: item.qty + 1 }) }))} style={{ width:24, height:24, borderRadius:6, border:'none', background:C.primary, color:'#FFF' }}>+</button>
              </div>
            </div>
          ))}
          <Btn onClick={saveEditOrder} style={{ width:'100%', marginTop:16 }}>حفظ</Btn>
        </Modal>
      )}

      {showSettings && (
        <Modal title="إعدادات المنيو" onClose={() => setShowSettings(false)} wide>
          <div style={{ display:'flex', gap:12, marginBottom:20 }}>
            <button onClick={() => setMenuTab('bread')} style={{ flex:1, padding:12, background:menuTab === 'bread' ? C.primary : C.tag, color:menuTab === 'bread' ? '#FFF' : C.dark, border:'none', borderRadius:10, fontWeight:800, cursor:'pointer' }}>العيش</button>
            <button onClick={() => setMenuTab('rests')} style={{ flex:1, padding:12, background:menuTab === 'rests' ? C.primary : C.tag, color:menuTab === 'rests' ? '#FFF' : C.dark, border:'none', borderRadius:10, fontWeight:800, cursor:'pointer' }}>المطاعم</button>
            <button onClick={() => setMenuTab('drinks')} style={{ flex:1, padding:12, background:menuTab === 'drinks' ? C.primary : C.tag, color:menuTab === 'drinks' ? '#FFF' : C.dark, border:'none', borderRadius:10, fontWeight:800, cursor:'pointer' }}>المشروبات</button>
          </div>

          {menuTab === 'bread' && (
            <div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {breadTypes.map((bread, index) => (
                  <div key={bread.id} style={{ display:'grid', gridTemplateColumns:'1fr 70px 40px', gap:8, alignItems:'center', background:C.tag, padding:'10px 12px', borderRadius:12 }}>
                    <input type="text" value={bread.ar} onChange={e => setBreadTypes(prev => prev.map((item, i) => i === index ? { ...item, ar:e.target.value } : item))} style={{ ...inpSt({ height:42 }) }} />
                    <input type="color" value={bread.color} onChange={e => setBreadTypes(prev => prev.map((item, i) => i === index ? { ...item, color:e.target.value, light:`${e.target.value}11` } : item))} style={{ width:70, height:42, padding:0, border:'none', background:'transparent' }}/>
                    <button onClick={() => setBreadTypes(prev => prev.filter(item => item.id !== bread.id))} style={{ border:'none', background:C.redLight, color:C.red, borderRadius:10, height:42, cursor:'pointer' }}>
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 70px auto', gap:8, marginBottom:16 }}>
                <input type="text" placeholder="نوع جديد" value={newBread.ar} onChange={e => setNewBread(prev => ({ ...prev, ar:e.target.value }))} style={inpSt({ height:42 })}/>
                <input type="color" value={newBread.color} onChange={e => setNewBread(prev => ({ ...prev, color:e.target.value }))} style={{ width:70, height:42, padding:0, border:'none', background:'transparent' }}/>
                <GhostBtn onClick={addBreadType} style={{ height:42, justifyContent:'center' }}><Plus size={16}/> إضافة</GhostBtn>
              </div>
              <Btn onClick={() => saveSettings('bread_types')} loading={savingSettings} style={{ width:'100%', height:46 }}>
                <Save size={16}/> حفظ أنواع العيش
              </Btn>
            </div>
          )}

          {menuTab === 'rests' && (
            <div>
              <div style={{ display:'flex', flexDirection:'column', gap:16, maxHeight:440, overflowY:'auto', paddingRight:4 }}>
                {rests.map((rest, restIndex) => (
                  <div key={rest.id} style={{ background:C.tag, borderRadius:14, padding:14 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 70px 80px 42px', gap:8, marginBottom:10 }}>
                      <input type="text" value={rest.name} onChange={e => updateRest(restIndex, current => ({ ...current, name:e.target.value }))} style={inpSt({ height:42 })} placeholder="اسم المطعم"/>
                      <input type="text" value={rest.emoji} onChange={e => updateRest(restIndex, current => ({ ...current, emoji:e.target.value }))} style={inpSt({ height:42, textAlign:'center' })} placeholder="🍽️"/>
                      <input type="number" value={rest.delivery || 0} onChange={e => updateRest(restIndex, current => ({ ...current, delivery:parseFloat(e.target.value) || 0 }))} style={inpSt({ height:42 })} placeholder="توصيل"/>
                      <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#FFF', borderRadius:12, fontSize:12, fontWeight:800 }}>
                        <input type="checkbox" checked={!!rest.hasBread} onChange={e => updateRest(restIndex, current => ({ ...current, hasBread:e.target.checked }))}/>
                        عيش
                      </label>
                      <button onClick={() => setRests(prev => prev.filter((_, index) => index !== restIndex))} style={{ border:'none', background:C.redLight, color:C.red, borderRadius:10, cursor:'pointer' }}>
                        <Trash2 size={16}/>
                      </button>
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                      <span style={{ fontSize:12, color:C.muted, fontWeight:800 }}>لون الخلفية</span>
                      <input type="color" value={rest.bg || '#FFF8E8'} onChange={e => updateRest(restIndex, current => ({ ...current, bg:e.target.value }))} style={{ width:50, height:34, padding:0, border:'none', background:'transparent' }}/>
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {(rest.items || []).map((item, itemIndex) => (
                        <div key={item.id || itemIndex} style={{ display:'grid', gridTemplateColumns:'1fr 90px 40px', gap:8 }}>
                          <input type="text" value={item.name} onChange={e => updateRest(restIndex, current => ({ ...current, items:(current.items || []).map((currentItem, i) => i === itemIndex ? { ...currentItem, name:e.target.value } : currentItem) }))} style={inpSt({ height:40, fontSize:13 })} placeholder="اسم الصنف"/>
                          <input type="number" value={item.price} onChange={e => updateRest(restIndex, current => ({ ...current, items:(current.items || []).map((currentItem, i) => i === itemIndex ? { ...currentItem, price:parseFloat(e.target.value) || 0 } : currentItem) }))} style={inpSt({ height:40, fontSize:13 })} placeholder="السعر"/>
                          <button onClick={() => updateRest(restIndex, current => ({ ...current, items:(current.items || []).filter((_, i) => i !== itemIndex) }))} style={{ border:'none', background:C.redLight, color:C.red, borderRadius:10, cursor:'pointer' }}>×</button>
                        </div>
                      ))}
                    </div>

                    <GhostBtn onClick={() => updateRest(restIndex, current => ({ ...current, items:[...(current.items || []), { id:`i${Date.now()}`, name:'', price:0 }] }))} style={{ width:'100%', marginTop:10, justifyContent:'center' }}>
                      <Plus size={14}/> إضافة صنف
                    </GhostBtn>
                  </div>
                ))}
              </div>

              <GhostBtn onClick={() => setRests(prev => [...prev, { id:Date.now(), name:'', emoji:'🍽️', bg:'#FFF8E8', hasBread:true, delivery:0, items:[] }])} style={{ width:'100%', marginTop:16, justifyContent:'center' }}>
                <Plus size={16}/> إضافة مطعم
              </GhostBtn>
              <Btn onClick={() => saveSettings('rests')} loading={savingSettings} style={{ width:'100%', marginTop:10, height:46 }}>
                <Save size={16}/> حفظ المطاعم
              </Btn>
            </div>
          )}

          {menuTab === 'drinks' && (
            <div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto' }}>
                {drinks.map((drink, index) => (
                  <div key={drink.id} style={{ display:'grid', gridTemplateColumns:'50px 1fr 40px', gap:8, alignItems:'center', background:C.tag, padding:'10px 12px', borderRadius:12 }}>
                    <input type="text" value={drink.emoji} onChange={e => updateDrink(index, current => ({ ...current, emoji:e.target.value }))} style={inpSt({ textAlign:'center', height:42 })}/>
                    <input type="text" value={drink.name} onChange={e => updateDrink(index, current => ({ ...current, name:e.target.value }))} style={inpSt({ height:42 })}/>
                    <button onClick={() => setDrinks(prev => prev.filter((_, itemIndex) => itemIndex !== index))} style={{ border:'none', background:C.redLight, color:C.red, borderRadius:10, height:42, cursor:'pointer' }}>
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
              </div>
              <GhostBtn onClick={() => setDrinks(prev => [...prev, { id:`d${Date.now()}`, name:'', emoji:'🍵' }])} style={{ width:'100%', marginTop:16, justifyContent:'center' }}>
                <Plus size={16}/> إضافة مشروب
              </GhostBtn>
              <Btn onClick={() => saveSettings('drinks')} loading={savingSettings} style={{ width:'100%', marginTop:10, height:46 }}>
                <Save size={16}/> حفظ المشروبات
              </Btn>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
