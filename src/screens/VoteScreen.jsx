import { useState, useEffect } from 'react'
import { ThumbsUp, ChevronLeft, Users } from 'lucide-react'
import { C } from '../constants/colors.js'
import { inpSt } from '../utils/helpers.js'
import { api } from '../api/client.js'
import { Btn, GhostBtn } from '../components/Btn.jsx'

export default function VoteScreen({ sessionId, rests, onBack }) {
  const [name, setName] = useState(() => localStorage.getItem('sandwitchyuser') || '')
  const [votes, setVotes] = useState([])
  const [myVote, setMyVote] = useState(null)
  const [voted, setVoted] = useState(false)

  useEffect(() => {
    api.getVotes(sessionId).then(v => setVotes(v || []))
  }, [sessionId])

  const handleVote = async (rid) => {
    if (!name.trim()) return
    localStorage.setItem('sandwitchyuser', name.trim())
    await api.vote(sessionId, `v_${Date.now()}`, name.trim(), rid)
    setMyVote(rid)
    setVoted(true)
    const v = await api.getVotes(sessionId)
    setVotes(v || [])
  }

  const getVoteCount = (rid) => votes.find(v => v.rid === rid)?.cnt || 0
  const totalVotes = votes.reduce((s, v) => s + v.cnt, 0)
  const winner = votes.length ? votes.reduce((a, b) => a.cnt > b.cnt ? a : b, votes[0]) : null

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <div className="glass-header" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: C.primaryLight, border: 'none', borderRadius: 12, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>تصويت على المطعم</div>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {!voted ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: C.muted, marginBottom: 8, display: 'block' }}>اسمك</label>
              <input type="text" placeholder="اكتب اسمك للتصويت"
                value={name} onChange={e => setName(e.target.value)}
                style={inpSt({ fontSize: 18, fontWeight: 800 })} autoFocus />
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, color: C.dark, marginBottom: 16 }}>
              اختار المطعم اللي نفسك تطلب منه:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
              {rests.map(rest => (
                <button key={rest.id} onClick={() => handleVote(rest.id)}
                  disabled={!name.trim()}
                  style={{
                    padding: 20, borderRadius: 20, border: '2px solid transparent',
                    background: C.tag, cursor: name.trim() ? 'pointer' : 'not-allowed',
                    opacity: name.trim() ? 1 : 0.5, transition: 'all 0.2s'
                  }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{rest.emoji}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.dark }}>{rest.name}</div>
                  {rest.delivery > 0 && (
                    <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginTop: 4 }}>توصيل {rest.delivery} ج</div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.dark, marginBottom: 8 }}>شكراً على تصويتك!</div>
            <div style={{ fontSize: 16, color: C.muted, marginBottom: 32 }}> وشكراً للتصويت!</div>

            <div style={{ fontSize: 18, fontWeight: 900, color: C.dark, marginBottom: 16, textAlign: 'right' }}>
              نتائج التصويت:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rests.map(rest => {
                const cnt = getVoteCount(rest.id)
                const pct = totalVotes > 0 ? (cnt / totalVotes * 100).toFixed(0) : 0
                const isWinner = winner?.rid === rest.id
                return (
                  <div key={rest.id} style={{
                    padding: 16, borderRadius: 16, background: isWinner ? C.greenLight : C.tag,
                    border: `2px solid ${isWinner ? C.green : 'transparent'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 32 }}>{rest.emoji}</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>{rest.name}</span>
                        {isWinner && <span style={{ background: C.green, color: '#FFF', padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 900 }}>الأكثر</span>}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: isWinner ? C.green : C.dark }}>{cnt}</div>
                    </div>
                    <div style={{ height: 8, background: '#FFF', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: isWinner ? C.green : C.primary, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 32, color: C.muted, fontSize: 14, fontWeight: 700 }}>
              <Users size={16} style={{ marginRight: 8 }} />
              {totalVotes} شخص للتصويت
            </div>

            <GhostBtn onClick={() => { setVoted(false); setMyVote(null) }} style={{ marginTop: 24 }}>
              تصويت تاني
            </GhostBtn>
          </div>
        )}
      </div>
    </div>
  )
}