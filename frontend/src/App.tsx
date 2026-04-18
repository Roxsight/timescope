import React, { useState, useEffect, useCallback, useMemo } from "react"

const API = "http://localhost:8080"
const OLLAMA = "http://localhost:11434"

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:           '#E8E2DA',
  surface:      'rgba(255,255,255,0.72)',
  border:       'rgba(129,166,198,0.22)',
  borderBright: 'rgba(129,166,198,0.42)',
  accent:       '#81A6C6',
  accentDim:    'rgba(129,166,198,0.13)',
  text:         '#2C3A45',
  textMid:      'rgba(44,58,69,0.60)',
  textDim:      'rgba(44,58,69,0.36)',
}

const BUILT_IN_CATS = ['Work', 'Browsing', 'Communication', 'Entertainment', 'System', 'Other']
const DEFAULT_CAT_COLORS: Record<string, string> = {
  Work:          '#7AAFC8',
  Browsing:      '#78B09A',
  Communication: '#AACDDC',
  Entertainment: '#C4906A',
  System:        '#B4BAC4',
  Other:         '#9E88B8',
}
const SWATCHES = ['#7AAFC8','#AACDDC','#78B09A','#B8D8C8','#C4906A','#D4B8A0','#9E88B8','#C4B8D4']

// ── Helpers ───────────────────────────────────────────────────────────────────
function guessCategory(name: string): string {
  const n = name.toLowerCase()
  if (/code|intellij|idea|eclipse|terminal|cmd|powershell|git|postman|figma|xcode|vim|sublime|notion|cursor/.test(n)) return 'Work'
  if (/chrome|brave|firefox|vivaldi|edge|safari|opera/.test(n)) return 'Browsing'
  if (/slack|discord|teams|zoom|mail|outlook|gmail|telegram|whatsapp|skype/.test(n)) return 'Communication'
  if (/spotify|youtube|netflix|vlc|steam|game|twitch|music/.test(n)) return 'Entertainment'
  if (/explorer|finder|settings|task manager|control panel|lockapp|shellhost/.test(n)) return 'System'
  return 'Other'
}

function fmt(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function toDs(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isToday(d: Date): boolean { return d.toDateString() === new Date().toDateString() }

function fmtDateLabel(d: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return isToday(d) ? `Today · ${d.toLocaleDateString('en-US', opts)}` : d.toLocaleDateString('en-US', { weekday: 'short', ...opts })
}

function shortName(appName: string): string {
  if (appName.includes('|')) return appName.split('|')[0].trim()
  return appName.replace(/\.exe$/i, '')
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.70)',
      border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '14px 16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 1px 4px rgba(44,58,69,0.07), 0 0 0 0.5px rgba(44,58,69,0.04)',
      ...style
    }}>
      {children}
    </div>
  )
}

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 9.5, letterSpacing: 1.6, color: C.textDim, fontWeight: 500, textTransform: 'uppercase' as const }}>{children}</div>
      {right && <div>{right}</div>}
    </div>
  )
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ score, segments }: { score: number; segments: { label: string; value: number; color: string }[] }) {
  const size = 230, cx = 115, cy = 115, r = 92, stroke = 20
  const circ = 2 * Math.PI * r
  const total = segments.reduce((a, b) => a + b.value, 0)
  let offset = 0
  const arcs = segments.map(s => {
    const dash = total > 0 ? (s.value / total) * circ : 0
    const a = { ...s, dash, offset }
    offset += dash
    return a
  })
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Low'
  const labelColor = score >= 80 ? '#78B09A' : score >= 60 ? '#81A6C6' : '#C4906A'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(44,58,69,0.08)" strokeWidth={stroke} />
      {arcs.map((a, i) =>
        a.dash > 1 ? (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={a.color} strokeWidth={stroke}
            strokeDasharray={`${a.dash - 2} ${circ - (a.dash - 2)}`}
            strokeDashoffset={-a.offset + circ * 0.25}
            strokeLinecap="round"
            style={{ transition: 'all 0.8s ease' }}
          />
        ) : null
      )}
      <text x={cx} y={cy - 12} textAnchor="middle" fill={C.text} fontSize="44" fontWeight="600" fontFamily="DM Sans">{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={C.textDim} fontSize="10" fontFamily="DM Sans" letterSpacing="2">FOCUS SCORE</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill={labelColor} fontSize="11.5" fontFamily="DM Sans" fontWeight="500">{label}</text>
    </svg>
  )
}

// ── SegBar ────────────────────────────────────────────────────────────────────
function SegBar({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((a, b) => a + b.value, 0)
  return (
    <div style={{ width: '100%', height: 9, borderRadius: 6, overflow: 'hidden', display: 'flex', gap: 1.5 }}>
      {segments.map((s, i) => (
        <div key={i} style={{ flex: total > 0 ? s.value / total : 0, background: s.color, transition: 'flex 0.6s ease' }} />
      ))}
    </div>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap() {
  const weeks = 53, days = 7, cell = 10, gap = 2
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthMarks = [0,4,8,13,17,21,26,30,35,39,43,48]
  const data = useMemo(() => Array.from({ length: weeks * days }, (_, i) => {
    if (i > 358) return 0
    const wd = i % 7
    const seed = (i * 1234567 + i * 13) % 97
    if (wd >= 5) return seed / 97 * 0.28
    return Math.min(1, seed / 97 * 1.25)
  }), [])
  const getColor = (v: number) => {
    if (!v) return 'rgba(129,166,198,0.12)'
    if (v < 0.25) return 'rgba(129,166,198,0.30)'
    if (v < 0.5)  return 'rgba(129,166,198,0.52)'
    if (v < 0.75) return 'rgba(129,166,198,0.74)'
    return '#81A6C6'
  }
  return (
    <div>
      <div style={{ display: 'flex', marginLeft: 18, marginBottom: 3 }}>
        {months.map((m, mi) => (
          <div key={mi} style={{
            width: (cell + gap) * (mi < 11 ? monthMarks[mi + 1] - monthMarks[mi] : weeks - monthMarks[mi]),
            fontSize: 8.5, color: C.textDim, whiteSpace: 'nowrap' as const, overflow: 'hidden'
          }}>{m}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap }}>
          {['M','','W','','F','','S'].map((l, i) => (
            <div key={i} style={{ height: cell, lineHeight: `${cell}px`, fontSize: 8.5, color: C.textDim, width: 12, textAlign: 'right' as const }}>{l}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks},${cell}px)`, gridTemplateRows: `repeat(${days},${cell}px)`, gap }}>
          {Array.from({ length: weeks * days }, (_, i) => (
            <div key={i} style={{
              gridColumn: Math.floor(i / days) + 1, gridRow: i % days + 1,
              width: cell, height: cell, borderRadius: 2,
              background: getColor(data[i] ?? 0)
            }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 8.5, color: C.textDim }}>Less</span>
        {[0, .30, .52, .74, 1].map((v, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: v === 0 ? 'rgba(129,166,198,0.12)' : `rgba(129,166,198,${v})` }} />
        ))}
        <span style={{ fontSize: 8.5, color: C.textDim }}>More</span>
      </div>
    </div>
  )
}

// ── WeekCalendar ──────────────────────────────────────────────────────────────
function WeekCalendar() {
  const hours = Array.from({ length: 13 }, (_, i) => i + 7)
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - today.getDay() + i + 1); return d
  })
  const catColor: Record<string, string> = {
    work: '#7AAFC8', browsing: '#78B09A', entertainment: '#C4906A', other: '#9E88B8'
  }
  const events = [
    { day: 0, start: 9,    dur: 1,   title: 'Standup',        cat: 'work'          },
    { day: 0, start: 10.5, dur: 1.5, title: 'Deep Work',      cat: 'work'          },
    { day: 1, start: 9,    dur: 2,   title: 'Focus Block',    cat: 'work'          },
    { day: 1, start: 14,   dur: 1,   title: 'Design Review',  cat: 'other'         },
    { day: 2, start: 11,   dur: 0.5, title: 'Sync',           cat: 'browsing'      },
    { day: 2, start: 15,   dur: 2,   title: 'Sprint Planning',cat: 'work'          },
    { day: 3, start: 9.5,  dur: 1,   title: 'Standup',        cat: 'work'          },
    { day: 3, start: 13,   dur: 1.5, title: 'Lunch',          cat: 'entertainment' },
    { day: 4, start: 10,   dur: 3,   title: 'Product Demo',   cat: 'work'          },
    { day: 4, start: 15.5, dur: 1,   title: 'Retro',          cat: 'other'         },
  ]
  const hourH = 44, startH = 7
  const isTodayFn = (d: Date) => d.toDateString() === today.toDateString()
  const dl = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const nowLine = (today.getHours() + today.getMinutes() / 60 - startH) * hourH

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7,1fr)', borderBottom: `1px solid ${C.border}`, paddingBottom: 6, flexShrink: 0 }}>
        <div />
        {days.map((d, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: C.textDim, letterSpacing: 0.8 }}>{dl(d)}</div>
            <div style={{
              fontSize: 14, fontWeight: isTodayFn(d) ? 600 : 400,
              color: isTodayFn(d) ? '#fff' : C.textMid,
              width: 22, height: 22, borderRadius: '50%',
              background: isTodayFn(d) ? C.accent : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '2px auto 0'
            }}>{d.getDate()}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7,1fr)', position: 'relative', minHeight: hourH * hours.length }}>
          {hours.map(h => (
            <React.Fragment key={h}>
              <div style={{ fontSize: 8.5, color: C.textDim, paddingTop: 3, textAlign: 'right' as const, paddingRight: 5, height: hourH }}>
                {h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
              </div>
              {days.map((d, di) => (
                <div key={di} style={{
                  height: hourH,
                  borderTop: `1px solid ${C.border}`,
                  borderLeft: di > 0 ? `1px solid ${C.border}` : 'none',
                  background: isTodayFn(d) ? 'rgba(129,166,198,0.04)' : 'transparent'
                }} />
              ))}
            </React.Fragment>
          ))}
          {nowLine > 0 && nowLine < hourH * hours.length && (
            <div style={{ position: 'absolute', top: nowLine, left: 30, right: 0, height: 1, background: C.accent, opacity: 0.7, zIndex: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, position: 'absolute', left: -3, top: -2.5 }} />
            </div>
          )}
          {events.map((e, i) => {
            const col = catColor[e.cat] || C.accent
            return (
              <div key={i} style={{
                position: 'absolute',
                top: (e.start - startH) * hourH + 1, height: e.dur * hourH - 3,
                left: `calc(30px + ${e.day / 7 * 100}% + 2px)`,
                width: `calc(${100 / 7}% - 4px)`,
                background: col + '22', border: `1px solid ${col}44`,
                borderLeft: `2px solid ${col}`, borderRadius: 4,
                padding: '3px 5px', overflow: 'hidden', cursor: 'default', zIndex: 3
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 500, color: col, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div style={{ fontSize: 8.5, color: col + '99' }}>{e.start % 1 ? `${Math.floor(e.start)}:30` : `${e.start}:00`}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── ManageCats Modal ──────────────────────────────────────────────────────────
interface CatDef { id: string; label: string; color: string; isBuiltin?: boolean }

function ManageCats({
  catDefs, onUpdate, onClose, appData, overrides, onSetOverride,
}: {
  catDefs: CatDef[]
  onUpdate: (defs: CatDef[]) => void
  onClose: () => void
  appData: { appName: string; minutes: number }[]
  overrides: Record<string, string>
  onSetOverride: (app: string, cat: string) => void
}) {
  const [cats, setCats] = useState(catDefs.map(c => ({ ...c })))
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newApp, setNewApp] = useState('')
  const [newCatLabel, setNewCatLabel] = useState('')

  const getAppsInCat = (catLabel: string) =>
    appData
      .filter(d => (overrides[d.appName] || guessCategory(d.appName)) === catLabel)
      .map(d => shortName(d.appName))

  const assignApp = (input: string, catLabel: string) => {
    const match = appData.find(d => shortName(d.appName).toLowerCase() === input.toLowerCase())
    if (match) onSetOverride(match.appName, catLabel)
  }

  const removeApp = (displayName: string) => {
    const match = appData.find(d => shortName(d.appName) === displayName)
    if (match) onSetOverride(match.appName, guessCategory(match.appName))
  }

  const addCat = () => {
    const label = newCatLabel.trim()
    if (!label || cats.find(c => c.label === label)) return
    setCats(prev => [...prev, { id: label.toLowerCase().replace(/\s+/g, '_'), label, color: '#9E88B8' }])
    setNewCatLabel('')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(180,172,162,0.55)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#F2EDE6', border: `1px solid ${C.borderBright}`,
        borderRadius: 20, width: 520, maxHeight: '82vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(44,58,69,0.22)'
      }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Manage Categories</div>
            <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>Define how apps are categorized and tracked</div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(44,58,69,0.08)', border: 'none', color: C.textMid,
            width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          <div style={{ fontSize: 9.5, letterSpacing: 1.5, color: C.textDim, marginBottom: 10 }}>CATEGORIES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {cats.map((cat, ci) => {
              const apps = getAppsInCat(cat.label)
              return (
                <div key={cat.id} style={{ background: 'rgba(255,255,255,0.65)', border: `1px solid ${C.border}`, borderRadius: 11, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: cat.color, flexShrink: 0, boxShadow: `0 0 0 2px ${cat.color}33` }} />
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.text }}>{cat.label}</div>
                    <div style={{ fontSize: 10.5, color: C.textDim }}>{apps.length} apps</div>
                    <div style={{ fontSize: 11, color: C.textDim, transition: 'transform 0.2s', transform: expanded === cat.id ? 'rotate(180deg)' : 'none' }}>▾</div>
                  </div>
                  {expanded === cat.id && (
                    <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', gap: 7, padding: '10px 0 12px' }}>
                        {SWATCHES.map(col => (
                          <div key={col} onClick={() => { const n = [...cats]; n[ci] = { ...cat, color: col }; setCats(n) }} style={{
                            width: 20, height: 20, borderRadius: '50%', background: col, cursor: 'pointer',
                            border: cat.color === col ? '2.5px solid #2C3A45' : '2px solid transparent',
                            transition: 'border 0.15s', boxShadow: '0 1px 3px rgba(44,58,69,0.15)'
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 9.5, color: C.textDim, marginBottom: 8, letterSpacing: 1 }}>TRACKED APPS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
                        {apps.map((app, ai) => (
                          <div key={ai} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'rgba(44,58,69,0.07)', borderRadius: 6,
                            padding: '3px 7px 3px 9px', fontSize: 11, color: C.textMid
                          }}>
                            {app}
                            <button onClick={() => removeApp(app)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: '0 0 0 2px', fontSize: 10, lineHeight: 1 }}>✕</button>
                          </div>
                        ))}
                        {apps.length === 0 && <span style={{ fontSize: 11, color: C.textDim }}>No apps yet</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={newApp} onChange={e => setNewApp(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && newApp.trim()) { assignApp(newApp.trim(), cat.label); setNewApp('') } }}
                          placeholder="Assign app by name…"
                          style={{
                            flex: 1, background: 'rgba(255,255,255,0.8)', border: `1px solid ${C.border}`,
                            borderRadius: 7, color: C.text, padding: '6px 10px', fontSize: 11.5,
                            fontFamily: 'DM Sans', outline: 'none'
                          }} />
                        <button onClick={() => { if (!newApp.trim()) return; assignApp(newApp.trim(), cat.label); setNewApp('') }} style={{
                          background: C.accentDim, border: `1px solid ${C.borderBright}`,
                          color: C.accent, borderRadius: 7, padding: '6px 14px', fontSize: 11.5,
                          cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500
                        }}>Assign</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
            <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCat()}
              placeholder="Add new category…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.8)', border: `1px solid ${C.border}`,
                borderRadius: 7, color: C.text, padding: '7px 10px', fontSize: 12,
                fontFamily: 'DM Sans', outline: 'none'
              }} />
            <button onClick={addCat} style={{
              background: C.accentDim, border: `1px solid ${C.borderBright}`,
              color: C.accent, borderRadius: 7, padding: '7px 14px', fontSize: 12,
              cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500
            }}>Add</button>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'rgba(255,255,255,0.4)' }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: 9, padding: '7px 18px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'DM Sans'
          }}>Cancel</button>
          <button onClick={() => { onUpdate(cats); onClose() }} style={{
            background: C.accentDim, border: `1px solid ${C.borderBright}`,
            color: C.accent, borderRadius: 9, padding: '7px 20px', fontSize: 12.5,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans'
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

// ── TrackingControls ──────────────────────────────────────────────────────────
function TrackingControls({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [status, setStatus] = useState<'running' | 'stopped'>('running')
  const [refreshing, setRefreshing] = useState(false)

  const handleStart = async () => {
    await Promise.allSettled([
      fetch('/launcher/start/backend', { method: 'POST' }),
      fetch('/launcher/start/logger',  { method: 'POST' }),
    ])
    setStatus('running')
  }

  const handleStop = async () => {
    await Promise.allSettled([
      fetch('/launcher/stop/backend', { method: 'POST' }),
      fetch('/launcher/stop/logger',  { method: 'POST' }),
    ])
    setStatus('stopped')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setTimeout(() => setRefreshing(false), 1200)
  }

  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 9,
    padding: '9px 16px', fontSize: 12.5, fontWeight: 500, fontFamily: 'DM Sans',
    cursor: 'pointer', transition: 'all 0.18s', flex: 1, justifyContent: 'center'
  }

  return (
    <Card style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <div style={{ fontSize: 9.5, letterSpacing: 1.6, color: C.textDim, fontWeight: 500, textTransform: 'uppercase' as const }}>Tracking</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: status === 'running' ? '#78B09A' : 'rgba(44,58,69,0.2)',
            boxShadow: status === 'running' ? '0 0 0 3px rgba(120,176,154,0.2)' : 'none',
            transition: 'all 0.3s'
          }} />
          <span style={{ fontSize: 11, color: status === 'running' ? '#78B09A' : C.textDim }}>
            {status === 'running' ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <button onClick={handleStart} style={{
          ...base,
          background: status === 'running' ? 'rgba(120,176,154,0.15)' : 'rgba(44,58,69,0.06)',
          color: status === 'running' ? '#78B09A' : C.textMid,
          border: `1px solid ${status === 'running' ? 'rgba(120,176,154,0.4)' : C.border}`,
        }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <polygon points="2,1 11,6 2,11" fill={status === 'running' ? '#78B09A' : 'rgba(44,58,69,0.4)'} />
          </svg>
          Start All
        </button>
        <button onClick={handleStop} style={{
          ...base,
          background: status === 'stopped' ? 'rgba(196,144,106,0.12)' : 'rgba(44,58,69,0.06)',
          color: status === 'stopped' ? '#C4906A' : C.textMid,
          border: `1px solid ${status === 'stopped' ? 'rgba(196,144,106,0.35)' : C.border}`,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="3" height="8" rx="1" fill={status === 'stopped' ? '#C4906A' : 'rgba(44,58,69,0.4)'} />
            <rect x="6" y="1" width="3" height="8" rx="1" fill={status === 'stopped' ? '#C4906A' : 'rgba(44,58,69,0.4)'} />
          </svg>
          Stop All
        </button>
        <button onClick={handleRefresh} style={{
          ...base, flex: '0 0 auto' as any, padding: '9px 14px',
          background: refreshing ? C.accentDim : 'rgba(44,58,69,0.06)',
          color: refreshing ? C.accent : C.textMid,
          border: `1px solid ${refreshing ? C.borderBright : C.border}`,
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
            style={{ transform: refreshing ? 'rotate(360deg)' : 'none', transition: refreshing ? 'transform 1s linear' : 'none' }}>
            <path d="M14 8A6 6 0 1 1 8 2" stroke={refreshing ? C.accent : 'rgba(44,58,69,0.4)'} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M8 2l2.5 2.5L8 7" stroke={refreshing ? C.accent : 'rgba(44,58,69,0.4)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {refreshing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>
    </Card>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [date, setDate]     = useState(new Date())
  const [data, setData]     = useState<{ appName: string; minutes: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('ts_overrides') || '{}') } catch { return {} }
  })
  const [catColors, setCatColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('ts_cat_colors') || '{}') } catch { return {} }
  })
  const [customCats, setCustomCats] = useState<CatDef[]>(() => {
    try { return JSON.parse(localStorage.getItem('ts_cats_v2') || '[]') } catch { return [] }
  })
  const [showCats, setShowCats]   = useState(false)
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [aiLoading, setAiLoading]   = useState(false)

  const ds = useMemo(() => toDs(date), [date])

  const catDefs = useMemo((): CatDef[] => [
    ...BUILT_IN_CATS.map(name => ({
      id: name.toLowerCase(),
      label: name,
      color: catColors[name] || DEFAULT_CAT_COLORS[name] || '#9E88B8',
      isBuiltin: true,
    })),
    ...customCats,
  ], [catColors, customCats])

  const getCatColor = useCallback((catName: string): string =>
    catDefs.find(c => c.label === catName)?.color || '#9E88B8'
  , [catDefs])

  const getCat = useCallback((appName: string): string =>
    overrides[appName] || guessCategory(appName)
  , [overrides])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/usage?date=${ds}`)
      setData(await r.json())
    } catch { setData([]) }
    setLoading(false)
  }, [ds])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!isToday(date)) return
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [date, load])

  const sorted  = useMemo(() => [...data].sort((a, b) => b.minutes - a.minutes), [data])
  const total   = useMemo(() => data.reduce((s, d) => s + d.minutes, 0), [data])
  const byCat   = useMemo(() => {
    const m: Record<string, number> = {}
    data.forEach(({ appName, minutes }) => { const c = getCat(appName); m[c] = (m[c] || 0) + minutes })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [data, getCat])

  const segments = useMemo(() => byCat.map(([label, value]) => ({ label, value, color: getCatColor(label) })), [byCat, getCatColor])

  const focusScore = useMemo(() => {
    if (total === 0) return 0
    const workMin = byCat.find(([c]) => c === 'Work')?.[1] || 0
    return Math.min(98, Math.max(5, Math.round((workMin / total) * 150)))
  }, [byCat, total])

  const topApp = sorted[0]

  const setOverride = (appName: string, cat: string) => {
    const next = { ...overrides, [appName]: cat }
    setOverrides(next)
    localStorage.setItem('ts_overrides', JSON.stringify(next))
  }

  const handleCatUpdate = (defs: CatDef[]) => {
    const newColors: Record<string, string> = {}
    const newCustom: CatDef[] = []
    defs.forEach(d => {
      if (d.isBuiltin) newColors[d.label] = d.color
      else newCustom.push(d)
    })
    setCatColors(newColors)
    setCustomCats(newCustom)
    localStorage.setItem('ts_cat_colors', JSON.stringify(newColors))
    localStorage.setItem('ts_cats_v2', JSON.stringify(newCustom))
  }

  const genAI = async () => {
    if (data.length === 0) return
    setAiLoading(true)
    setAiInsights([])
    const catSummary = byCat.map(([c, m]) => `${c}: ${fmt(m)} (${total > 0 ? Math.round(m / total * 100) : 0}%)`).join(', ')
    const topApps = sorted.slice(0, 5).map(d => `${shortName(d.appName)}: ${fmt(d.minutes)}`).join(', ')
    const prompt = `You are a time-use analyst. Here is screen time for ${ds}:
Categories: ${catSummary}
Top apps: ${topApps}
Write exactly 5 short insight bullet points (no bullet chars, just the text). Each under 90 characters. One per line. Be specific with numbers. No intro or outro.`
    try {
      const r = await fetch(`${OLLAMA}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt, stream: false }),
      })
      const j = await r.json()
      const lines = (j.response || '').split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5).slice(0, 5)
      setAiInsights(lines.length > 0 ? lines : ['No insights generated — try again.'])
    } catch {
      setAiInsights(['Could not reach Ollama — start it with: ollama serve'])
    }
    setAiLoading(false)
  }

  const placeholderInsights = data.length > 0 ? [
    `${topApp ? shortName(topApp.appName) : 'VS Code'} is your most-used app${topApp ? ` at ${fmt(topApp.minutes)}` : ''}`,
    `${byCat[0] ? byCat[0][0] : 'Work'} takes ${byCat[0] ? fmt(byCat[0][1]) : '—'} of tracked time today`,
    `Focus score of ${focusScore} — ${focusScore >= 60 ? 'solid session' : 'consider more focused work blocks'}`,
    `${byCat.length} categor${byCat.length !== 1 ? 'ies' : 'y'} active across ${data.length} app${data.length !== 1 ? 's' : ''}`,
    `Click Analyse to get AI-powered insights from Ollama`,
  ] : []

  const displayInsights = aiInsights.length > 0 ? aiInsights : placeholderInsights

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: ${C.bg}; font-family: 'DM Sans', sans-serif; color: ${C.text}; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(129,166,198,0.35); border-radius: 2px; }
        #root { height: 100vh; display: flex; flex-direction: column; }
        input:focus, button:focus { outline: none; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 26px', height: 50, flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
          background: 'rgba(242,237,230,0.92)', backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke={C.accent} strokeWidth="1.6" />
              <path d="M10 5.5L10 10L13.5 12" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: 0.2, color: C.text }}>TimeScope</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d); setAiInsights([]) }}
              style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>‹</button>
            <span style={{ fontSize: 12, color: C.textMid, minWidth: 108, textAlign: 'center' as const }}>{fmtDateLabel(date)}</span>
            <button
              onClick={() => { if (!isToday(date)) { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d); setAiInsights([]) } }}
              style={{ background: 'none', border: `1px solid ${C.border}`, color: isToday(date) ? C.textDim : C.textMid, borderRadius: 6, width: 26, height: 26, cursor: isToday(date) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, opacity: isToday(date) ? 0.3 : 1 }}>›</button>
          </div>

          <button style={{
            background: C.accentDim, border: `1px solid ${C.borderBright}`,
            color: C.accent, padding: '5px 14px', borderRadius: 7, fontSize: 12,
            cursor: 'default', fontFamily: 'DM Sans', fontWeight: 500
          }}>Dashboard</button>
        </header>

        {/* ── Body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT */}
          <div style={{
            width: '55%', display: 'flex', flexDirection: 'column', gap: 10,
            padding: '12px 12px 12px 18px', overflowY: 'auto',
            borderRight: `1px solid ${C.border}`
          }}>

            {/* At a Glance */}
            <Card>
              <Label right={
                <span style={{ fontSize: 9, color: C.accent, background: C.accentDim, padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.borderBright}`, letterSpacing: 0.5 }}>
                  {fmtDateLabel(date)}
                </span>
              }>At a Glance</Label>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                {loading
                  ? <div style={{ width: 230, height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: C.textDim }}>Loading…</div>
                    </div>
                  : <DonutChart score={focusScore} segments={segments.length > 0 ? segments : [{ label: 'None', value: 1, color: 'rgba(44,58,69,0.08)' }]} />
                }
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {segments.slice(0, 4).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: C.textMid }}>{s.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: 'DM Mono' }}>
                        {total > 0 ? Math.round(s.value / total * 100) : 0}%
                      </div>
                    </div>
                  ))}
                  {segments.length === 0 && (
                    <div style={{ fontSize: 12, color: C.textDim }}>No data yet</div>
                  )}
                  <div style={{ paddingTop: 10, borderTop: `1px solid ${C.border}`, marginTop: 2 }}>
                    <div style={{ fontSize: 8.5, color: C.textDim, letterSpacing: 1.2, marginBottom: 3 }}>MOST USED APP</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                      {topApp ? shortName(topApp.appName) : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: C.accent, fontFamily: 'DM Mono', marginTop: 1 }}>
                      {topApp ? fmt(topApp.minutes) : 'No data yet'}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tasks Breakdown */}
            <Card>
              <Label right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontFamily: 'DM Mono', color: C.accent, fontWeight: 500 }}>{fmt(total)}</span>
                  <button onClick={() => setShowCats(true)} style={{
                    background: 'transparent', border: `1px solid ${C.borderBright}`,
                    color: C.accent, borderRadius: 6, padding: '2px 9px', fontSize: 10.5,
                    cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500
                  }}>Manage</button>
                </div>
              }>Tasks Breakdown</Label>
              {segments.length > 0 ? (
                <>
                  <SegBar segments={segments} />
                  <div style={{ display: 'flex', gap: 12, marginTop: 11, flexWrap: 'wrap' as const }}>
                    {segments.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: 11, color: C.textMid }}>{s.label}</span>
                        <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: C.textDim }}>{fmt(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: C.textDim, paddingTop: 4 }}>No data for this day</div>
              )}
            </Card>

            {/* Activity Heatmap */}
            <Card>
              <Label right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>Streak</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.accent, fontFamily: 'DM Mono' }}>12d</span>
                  <span style={{ fontSize: 13 }}>🔥</span>
                </div>
              }>Activity · Past Year</Label>
              <Heatmap />
            </Card>

            {/* AI Insight */}
            <Card style={{ border: `1px solid rgba(129,166,198,0.28)`, background: 'rgba(255,255,255,0.55)' }}>
              <Label right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 9, color: C.accent, background: C.accentDim, padding: '2px 7px', borderRadius: 10, border: `1px solid ${C.borderBright}`, letterSpacing: 0.5 }}>AI · Ollama</span>
                  <button onClick={genAI} disabled={aiLoading || data.length === 0} style={{
                    background: 'none', border: `1px solid ${C.borderBright}`, color: C.accent,
                    borderRadius: 6, padding: '2px 9px', fontSize: 10.5,
                    cursor: data.length === 0 || aiLoading ? 'default' : 'pointer',
                    fontFamily: 'DM Sans', fontWeight: 500,
                    opacity: data.length === 0 ? 0.4 : 1
                  }}>
                    {aiLoading ? '…' : aiInsights.length > 0 ? 'Refresh' : 'Analyse'}
                  </button>
                </div>
              }>Insight</Label>
              {displayInsights.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {displayInsights.map((ins, i) => (
                    <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.accent, marginTop: 5.5, flexShrink: 0, opacity: 0.7 }} />
                      <span style={{ fontSize: 12, color: C.textMid, lineHeight: 1.55 }}>{ins}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.textDim }}>Start tracking to see insights</div>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <div style={{
            width: '45%', display: 'flex', flexDirection: 'column', gap: 10,
            padding: '12px 18px 12px 12px', overflow: 'hidden'
          }}>
            <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <Label right={
                <span style={{ fontSize: 9, color: C.textDim, background: 'rgba(44,58,69,0.06)', padding: '2px 8px', borderRadius: 4, letterSpacing: 0.3 }}>Google Calendar API</span>
              }>Calendar</Label>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <WeekCalendar />
              </div>
            </Card>

            <TrackingControls onRefresh={load} />
          </div>
        </div>
      </div>

      {/* Manage Categories Modal */}
      {showCats && (
        <ManageCats
          catDefs={catDefs}
          onUpdate={handleCatUpdate}
          onClose={() => setShowCats(false)}
          appData={data}
          overrides={overrides}
          onSetOverride={setOverride}
        />
      )}
    </>
  )
}
