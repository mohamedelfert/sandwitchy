import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { C } from '../constants/colors.js'

export default function Countdown({ deadline, onEnd }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [percent, setPercent] = useState(100)

  useEffect(() => {
    if (!deadline) return

    const target = new Date(deadline).getTime()
    const start  = target - (15 * 60 * 1000) // Assume a 15min default window for progress bar if unknown

    const update = () => {
      const now   = Date.now()
      const diff  = target - now
      
      if (diff <= 0) {
        setTimeLeft('انتهى الوقت')
        setPercent(0)
        onEnd?.()
        return
      }

      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${m}:${s < 10 ? '0' : ''}${s}`)
      
      const total = target - start
      const current = target - now
      setPercent(Math.max(0, Math.min(100, (current / total) * 100)))
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [deadline])

  if (!deadline) return null

  return (
    <div style={{ background: 'rgba(255,255,255,0.8)', padding: '10px 16px', borderRadius: 16, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, overflow:'hidden', position:'relative' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: C.grad, width: `${percent}%`, transition: 'width 1s linear' }} />
      <div style={{ background: C.primaryLight, color: C.primary, width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Clock size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>متبقي على إكمال الطلب</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.dark }}>{timeLeft}</div>
      </div>
    </div>
  )
}
