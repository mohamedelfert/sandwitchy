import { useEffect, useRef, useState } from 'react'
import { C } from '../../constants/colors.js'
import { inpSt } from '../../utils/helpers.js'

export default function InlineField({ value, onSave, type = 'text', placeholder = '', style = {}, coerce }) {
  const [local, setLocal] = useState(value ?? '')
  const [state, setState] = useState('idle')
  const [errMsg, setErrMsg] = useState('')
  const timer = useRef(null)
  const lastSaved = useRef(value ?? '')

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