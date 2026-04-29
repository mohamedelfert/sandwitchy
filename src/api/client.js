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
  getSession:    sid         => fetch(`/api/session/${sid}`).then(r=>r.json()),
  submitOrder:   (sid,uid,b) => fetch(`/api/orders/${sid}/${uid}`,  { method:'POST',   headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) }),
  deleteOrder:   (sid,uid)   => parseJson(fetch(`/api/orders/${sid}/${uid}`,  { method:'DELETE' })),
  patchLines:    (sid,uid,ls)=> parseJson(fetch(`/api/orders/${sid}/${uid}`,  { method:'PATCH',  headers:{'Content-Type':'application/json'}, body:JSON.stringify({lines:ls}) })),
  setDelivery:   (sid,amt)   => parseJson(fetch(`/api/session/${sid}/delivery`,{ method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount:amt}) })),
  complete:      sid         => parseJson(fetch(`/api/session/${sid}/complete`, { method:'PUT' })),
  reopen:        sid         => parseJson(fetch(`/api/session/${sid}/reopen`,  { method:'PUT' })),
  resetSession:  sid         => parseJson(fetch(`/api/session/${sid}`, { method:'DELETE' })),
  setDeadline:   (sid,dl)    => parseJson(fetch(`/api/session/${sid}/deadline`,{ method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify({deadline:dl}) })),
  setSessionMeta:(sid,meta)  => parseJson(fetch(`/api/session/${sid}/meta`,    { method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify(meta) })),
  setExpected:   (sid,names) => parseJson(fetch(`/api/session/${sid}/expected`,{ method:'PUT',   headers:{'Content-Type':'application/json'}, body:JSON.stringify({names}) })),
  getSettings:   ()          => fetch(`/api/settings`).then(r=>r.json()),
  updateSettings:(key,value) => fetch(`/api/settings`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key,value}) }).then(r=>r.json()),
  getActiveSessions: ()      => fetch(`/api/sessions/active`).then(r=>r.json()),
  getOrderHistory: (name)    => fetch(`/api/history/${encodeURIComponent(name)}`).then(r=>r.json()),
  reorder:      (hid)       => fetch(`/api/reorder/${hid}`, { method:'POST' }).then(r=>r.json()),
  setPayment:   (sid,uid,paid,amount) => parseJson(fetch(`/api/orders/${sid}/${uid}/payment`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ paid, amount }) })),
  adminMe:      ()          => parseJson(fetch('/api/admin/me')),
  adminLogin:   (username,password) => parseJson(fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ username, password }) })),
  adminLogout:  ()          => parseJson(fetch('/api/admin/logout', { method:'POST' })),
  getAdminSessions: ()      => parseJson(fetch('/api/admin/sessions')),
}
