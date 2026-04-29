async function parseJson(responsePromise) {
  const response = await responsePromise
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export const api = {
  // Auth
  authRegister:   (u,p,o) => fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:u, password:p, ...o }) }).then(r=>r.json()),
  authLogin:      (u,p)   => fetch('/api/auth/login',    { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username:u, password:p }) }).then(r=>r.json()),
  authLogout:     ()      => fetch('/api/auth/logout',   { method:'POST' }).then(r=>r.json()),
  getCurrentUser: ()      => fetch('/api/auth/me').then(r=>r.json()),
  updateProfile:  (data)  => fetch('/api/users/me', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json()),
  getUserProfile: ()     => fetch('/api/users/me').then(r=>r.json()),
  
  // Addresses
  getAddresses:   ()      => fetch('/api/addresses').then(r=>r.json()),
  addAddress:     (data)  => fetch('/api/addresses', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json()),
  updateAddress:  (id,data)=> fetch(`/api/addresses/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json()),
  deleteAddress:  (id)    => fetch(`/api/addresses/${id}`, { method:'DELETE' }).then(r=>r.json()),
  
  // Favorites
  getFavorites:   (type)  => fetch(`/api/favorites?${type ? `type=${type}` : ''}`).then(r=>r.json()),
  addFavorite:    (type,data) => fetch('/api/favorites', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ type, data }) }).then(r=>r.json()),
  removeFavorite: (id)    => fetch(`/api/favorites/${id}`, { method:'DELETE' }).then(r=>r.json()),
  
  // Promo codes
  validatePromo:  (code,amount) => fetch('/api/promo/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code, amount }) }).then(r=>r.json()),
  
  // Orders & sessions (existing)
  getSession:     sid         => fetch(`/api/session/${sid}`).then(r=>r.json()),
  submitOrder:    (sid,uid,b) => fetch(`/api/orders/${sid}/${uid}`,  { method:'POST',   headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }),
  deleteOrder:    (sid,uid)   => parseJson(fetch(`/api/orders/${sid}/${uid}`,  { method:'DELETE' })),
  patchLines:     (sid,uid,ls)=> parseJson(fetch(`/api/orders/${sid}/${uid}`,  { method:'PATCH',  headers:{'Content-Type':'application/json'}, body:JSON.stringify({lines:ls}) })),
  setDelivery:    (sid,amt)   => parseJson(fetch(`/api/session/${sid}/delivery`,{ method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount:amt}) })),
  complete:       sid         => parseJson(fetch(`/api/session/${sid}/complete`, { method:'PUT' })),
  reopen:         sid         => parseJson(fetch(`/api/session/${sid}/reopen`,  { method:'PUT' })),
  resetSession:   sid         => parseJson(fetch(`/api/session/${sid}`, { method:'DELETE' })),
  setDeadline:    (sid,dl)    => parseJson(fetch(`/api/session/${sid}/deadline`,{ method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify({deadline:dl}) })),
  setSessionMeta: (sid,meta)  => parseJson(fetch(`/api/session/${sid}/meta`,    { method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify(meta) })),
  setRestaurantStatuses:(sid,statuses) => parseJson(fetch(`/api/session/${sid}/restaurant-statuses`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ statuses }) })),
  setExpected:    (sid,names) => parseJson(fetch(`/api/session/${sid}/expected`,{ method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify({names}) })),
  getSettings:    ()          => fetch(`/api/settings`).then(r=>r.json()),
  updateSettings: (key,value) => fetch(`/api/settings`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key,value}) }).then(r=>r.json()),
  getActiveSessions: ()      => fetch(`/api/sessions/active`).then(r=>r.json()),
  getOrderHistory: (name)    => fetch(`/api/history/${encodeURIComponent(name)}`).then(r=>r.json()),
  reorder:        (hid)      => fetch(`/api/reorder/${hid}`, { method:'POST' }).then(r=>r.json()),
  setPayment:     (sid,uid,paid,amount) => parseJson(fetch(`/api/orders/${sid}/${uid}/payment`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ paid, amount }) })),
  
  // Voting
  getVotes:       (sid)     => fetch(`/api/votes/${sid}`).then(r=>r.json()),
  vote:           (sid,uid,name,rid) => fetch(`/api/votes/${sid}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ uid, name, rid }) }).then(r=>r.json()),
  
  // Admin
  adminMe:         ()         => parseJson(fetch('/api/admin/me')),
  adminLogin:      (username,password) => parseJson(fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username, password }) })),
  adminLogout:     ()         => parseJson(fetch('/api/admin/logout', { method:'POST' })),
  getAdminSessions: ()       => parseJson(fetch('/api/admin/sessions')),
  getAdminAnalytics: (days)   => parseJson(fetch(`/api/admin/analytics?days=${days || 30}`)),
  getAdminPromoCodes: ()      => parseJson(fetch('/api/admin/promo-codes')),
  createPromoCode: (data)    => parseJson(fetch('/api/admin/promo-codes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })),
  
  // Order status
  getOrderStatus:  (sid,uid)  => fetch(`/api/orders/${sid}/${uid}/status`).then(r=>r.json()),
  setOrderStatus:  (sid,uid,status,note) => parseJson(fetch(`/api/orders/${sid}/${uid}/status`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status, note }) })),
  
  // Notifications
  getNotifications:(unread_only) => fetch(`/api/notifications?${unread_only ? 'unread_only=true' : ''}`).then(r=>r.json()),
  markNotificationRead:(id) => parseJson(fetch(`/api/notifications/${id}/read`, { method:'PUT' })),
  markAllNotificationsRead: () => parseJson(fetch('/api/notifications/mark-all-read', { method:'POST' })),
  
  // Restaurant hours
  getRestaurantHours: (id)  => fetch(`/api/restaurants/${id}/hours`).then(r=>r.json()),
  setRestaurantHours: (id, hours) => parseJson(fetch(`/api/restaurants/${id}/hours`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ hours }) })),
  
  // Votes (existing)
  getVotes:       (sid)      => fetch(`/api/votes/${sid}`).then(r=>r.json()),
  vote:           (sid, uid, name, rid) => fetch(`/api/votes/${sid}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ uid, name, rid }) }).then(r=>r.json()),
}
