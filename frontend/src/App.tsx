import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

const API    = "http://localhost:8080"
const OLLAMA = "http://localhost:11434"

const CAT = {
  Work:          { color: "#6366F1", dim: "#6366F120" },
  Browsing:      { color: "#10B981", dim: "#10B98120" },
  Communication: { color: "#F59E0B", dim: "#F59E0B20" },
  Entertainment: { color: "#EF4444", dim: "#EF444420" },
  System:        { color: "#6B7280", dim: "#6B728020" },
  Other:         { color: "#8B5CF6", dim: "#8B5CF620" },
}
const BUILT_IN_CATS = Object.keys(CAT)

const PALETTE = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#F59E0B", "#84CC16", "#10B981", "#14B8A6", "#06B6D4",
  "#3B82F6", "#6B7280",
]

function guessCategory(name) {
  const n = name.toLowerCase()
  if (/code|intellij|idea|eclipse|terminal|cmd|powershell|git|postman|figma|xcode|android studio|vim|neovim|sublime/.test(n)) return "Work"
  if (/chrome|brave|firefox|vivaldi|edge|safari|opera/.test(n)) return "Browsing"
  if (/slack|discord|teams|zoom|mail|outlook|gmail|telegram|whatsapp|skype/.test(n)) return "Communication"
  if (/spotify|youtube|netflix|vlc|steam|game|twitch|music|player/.test(n)) return "Entertainment"
  if (/explorer|finder|system|settings|task manager|control panel|registry/.test(n)) return "System"
  return "Other"
}

function fmt(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function toDs(d) { return d.toISOString().split("T")[0] }
function isToday(d) { return d.toDateString() === new Date().toDateString() }
function fmtLabel(d) {
  return isToday(d) ? "Today" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

const BG       = "#09090C"
const SURFACE  = "#111116"
const SURFACE2 = "#18181E"
const BORDER   = "rgba(255,255,255,0.08)"
const TEXT     = "#EEEDE7"
const MUTED    = "#8888A0"
const ACCENT   = "#6366F1"

const card = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "24px 28px" }
const lbl  = { fontSize: 13, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500 }
const btn  = (active = false, danger = false) => ({
  background: danger ? "#EF444414" : active ? `${ACCENT}18` : "transparent",
  border: `1px solid ${danger ? "#EF444435" : active ? `${ACCENT}50` : BORDER}`,
  color: danger ? "#EF4444" : active ? ACCENT : MUTED,
  borderRadius: 9, padding: "0 14px", height: 32, cursor: "pointer",
  fontSize: 13, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em",
  transition: "all 0.15s", whiteSpace: "nowrap",
})

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  const meta = CAT[name] || { color: "#8B5CF6" }
  return (
    <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color }} />
        <span style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{name}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: meta.color, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(value)}</div>
    </div>
  )
}

// ── Setup / Status modal ──────────────────────────────────────────────────────
const SERVICE_STEPS = [
  { key: "api",       label: "Spring Boot backend", port: "8080",  desc: "Java API that stores app logs",    cmd: "mvn spring-boot:run" },
  { key: "ollama",    label: "Ollama (Llama3)",      port: "11434", desc: "Local AI for time analysis",       cmd: "$env:OLLAMA_ORIGINS='*'; ollama serve" },
  { key: "logger",    label: "Python logger",         port: "—",    desc: "Tracks active windows every 30s",  cmd: "python logger.py" },
  { key: "extension", label: "Browser extension",     port: "—",    desc: "Tracks Brave / Vivaldi tabs",      cmd: "Load timescope-extension/ unpacked" },
]

function StatusDot({ ok, label }) {
  const color = ok === null ? MUTED : ok ? "#10B981" : "#EF4444"
  const text  = label || (ok === null ? "Unknown" : ok ? "Active" : "Not detected")
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color }}>{text}</span>
    </div>
  )
}

function SetupModal({ onClose, services, onCheck }) {
  const [copied, setCopied] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs]         = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      // Fetch today + yesterday to get recent entries
      const today = new Date()
      const yday  = new Date(today); yday.setDate(yday.getDate() - 1)
      const [r1, r2] = await Promise.all([
        fetch(`${API}/api/usage?date=${toDs(today)}`).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/usage?date=${toDs(yday)}`).then(r => r.json()).catch(() => []),
      ])
      // Combine and sort by minutes desc, show as log entries
      const all = [...r1.map(e => ({ ...e, day: "today" })), ...r2.map(e => ({ ...e, day: "yesterday" }))]
        .sort((a, b) => b.minutes - a.minutes)
      setLogs(all)
    } catch { setLogs([]) }
    setLogsLoading(false)
  }

  const toggleLogs = () => {
    if (!showLogs) loadLogs()
    setShowLogs(v => !v)
  }

  const statusFor = key => {
    if (key === "api")       return { ok: services.api }
    if (key === "ollama")    return { ok: services.ollama }
    if (key === "logger")    return { ok: services.logger,    label: services.logger === null ? "Unknown" : services.logger ? "Sending data" : "No native data" }
    if (key === "extension") return { ok: services.extension, label: services.extension === null ? "Unknown" : services.extension ? "Sending data" : "No browser data" }
    return { ok: null }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 22, padding: "36px", width: 560, maxHeight: "90vh", overflow: "auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: TEXT }}>Setup & Status</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={toggleLogs} style={btn(showLogs)}>{showLogs ? "Hide logs" : "View logs"}</button>
            <button onClick={onCheck} style={btn(false)}>Re-check</button>
          </div>
        </div>
        <div style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>
          4 components power TimeScope. Python logger and browser extension are detected via incoming data.
        </div>

        {SERVICE_STEPS.map(s => {
          const { ok, label } = statusFor(s.key)
          return (
            <div key={s.key} style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 13, color: MUTED }}>{s.desc}{s.port !== "—" ? ` · port ${s.port}` : ""}</div>
                </div>
                <StatusDot ok={ok} label={label} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#A5B4FC", fontFamily: "'JetBrains Mono', monospace", overflow: "auto", whiteSpace: "nowrap" }}>
                  {s.cmd}
                </code>
                <button onClick={() => copy(s.cmd, s.key)} style={{ ...btn(copied === s.key), height: 36, padding: "0 12px", flexShrink: 0, fontSize: 12 }}>
                  {copied === s.key ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )
        })}

        {/* Logs panel */}
        {showLogs && (
          <div style={{ marginTop: 4, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Recent log entries</div>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", maxHeight: 280, overflow: "auto" }}>
              {logsLoading
                ? <div style={{ color: MUTED, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading…</div>
                : logs.length === 0
                  ? <div style={{ color: MUTED, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>No entries found. Is the logger running?</div>
                  : logs.map((e, i) => {
                      const isExt = e.appName.includes("|")
                      const name  = isExt ? e.appName.split("|")[0].trim() : e.appName
                      const title = isExt ? e.appName.split("|").slice(1).join("|").trim() : null
                      return (
                        <div key={i} style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: i < logs.length - 1 ? `1px solid ${BORDER}` : "none", alignItems: "baseline" }}>
                          <span style={{ fontSize: 11, color: MUTED, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, minWidth: 72 }}>{e.day} · {fmt(e.minutes)}</span>
                          <span style={{ fontSize: 11, color: isExt ? "#10B981" : ACCENT, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>[{isExt ? "browser" : "native"}]</span>
                          <span style={{ fontSize: 12, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{name}{title ? ` — ${title}` : ""}</span>
                        </div>
                      )
                    })}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
              Green = browser extension · Blue = Python logger · Sorted by time spent
            </div>
          </div>
        )}

        <div style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}30`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT, marginBottom: 6 }}>Start order</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
            1. Spring Boot backend<br />
            2. Python logger<br />
            3. Browser extension (load unpacked in brave://extensions)<br />
            4. Ollama — only needed for AI analysis
          </div>
        </div>

        <button onClick={onClose} style={{ ...btn(), width: "100%", height: 40, fontSize: 14 }}>Close</button>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [date, setDate]             = useState(new Date())
  const [data, setData]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [overrides, setOverrides]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("ts_overrides") || "{}") } catch { return {} }
  })
  const [customCats, setCustomCats] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("ts_cats") || "[]")
      // migrate old string[] format to {name, color}[]
      return raw.map(c => typeof c === "string" ? { name: c, color: "#8B5CF6" } : c)
    } catch { return [] }
  })
  const [expanded, setExpanded]     = useState(false)
  const [aiText, setAiText]         = useState("")
  const [aiLoading, setAiLoading]   = useState(false)
  const [resetMode, setResetMode]   = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [setupOpen, setSetupOpen]   = useState(false)
  const [services, setServices]     = useState({ api: null, ollama: null, logger: null, extension: null })
  const [newCat, setNewCat]         = useState("")
  const [newCatColor, setNewCatColor] = useState(PALETTE[0])
  const [colorPickFor, setColorPickFor] = useState(null)  // name of cat whose picker is open
  const [hoveredCat, setHoveredCat] = useState(null)

  const ds      = toDs(date)
  const allCats     = useMemo(() => [...BUILT_IN_CATS, ...customCats.map(c => c.name)], [customCats])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/usage?date=${ds}`)
      setData(await r.json())
    } catch { setData([]) }
    setLoading(false)
  }, [ds])

  const checkServices = useCallback(async () => {
    setServices({ api: null, ollama: null, logger: null, extension: null })
    const todayDs = toDs(new Date())
    const [apiRes, ollamaOk] = await Promise.all([
      fetch(`${API}/api/usage?date=${todayDs}`).then(r => r.json()).catch(() => null),
      fetch(`${OLLAMA}/api/tags`).then(r => r.ok).catch(() => false),
    ])
    const apiOk       = Array.isArray(apiRes)
    const hasNative   = apiOk && apiRes.some(e => !e.appName.includes("|"))
    const hasExtension = apiOk && apiRes.some(e => e.appName.includes("|"))
    setServices({ api: apiOk, ollama: ollamaOk, logger: hasNative, extension: hasExtension })
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!isToday(date)) return
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [date, load])

  const getCat  = useCallback(n => overrides[n] || guessCategory(n), [overrides])
  const catMeta = useCallback(c => {
    if (CAT[c]) return CAT[c]
    const custom = customCats.find(x => x.name === c)
    const color  = custom?.color || "#8B5CF6"
    return { color, dim: color + "20" }
  }, [customCats])

  const setCat = (n, c) => {
    const next = { ...overrides, [n]: c }
    setOverrides(next)
    localStorage.setItem("ts_overrides", JSON.stringify(next))
  }

  const sorted = useMemo(() => [...data].sort((a, b) => b.minutes - a.minutes), [data])
  const total  = useMemo(() => data.reduce((s, d) => s + d.minutes, 0), [data])
  const maxMin = sorted[0]?.minutes || 1

  const byCat = useMemo(() => {
    const m = {}
    data.forEach(({ appName, minutes }) => {
      const c = overrides[appName] || guessCategory(appName)
      m[c] = (m[c] || 0) + minutes
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [data, overrides])

  const pieData = byCat.map(([name, value]) => ({ name, value }))
  const topApp  = sorted[0]
  const topCat  = byCat[0]

  // ── AI analysis (not tips) ───────────────────────────────────────────────
  const genAI = async () => {
    setAiLoading(true)
    setAiText("")
    const catSummary = byCat.map(([c, m]) => `${c}: ${fmt(m)} (${total > 0 ? Math.round(m / total * 100) : 0}%)`).join(", ")
    const appList    = sorted.map(d => `${d.appName}: ${fmt(d.minutes)}`).join(", ")
    const prompt = `You are a time-use analyst. Here is someone's computer usage for ${ds}:

Categories: ${catSummary}
Apps (${sorted.length} total): ${appList}

Write a factual analysis in 3 short paragraphs. No bullet points, no tips, no advice — only analysis:
1. How their time was distributed across categories and what that pattern says about their day.
2. Their focus and context-switching pattern — were they focused deeply on one thing, or jumping between many apps and domains?
3. Any notable patterns in how they moved between apps and categories — e.g. bursts of productivity, stretches of browsing, or mixing of work and distraction.

Be specific and reference real numbers and app names. No intro or outro sentence. Plain paragraphs only.`

    try {
      const r = await fetch(`${OLLAMA}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama3", prompt, stream: false }),
      })
      const j = await r.json()
      setAiText(j.response || "No response received.")
    } catch {
      setAiText("Could not reach Ollama.\nStart it with: $env:OLLAMA_ORIGINS='*'; ollama serve")
    }
    setAiLoading(false)
  }

  const doReset = async () => {
    await fetch(`${API}/api/reset?date=${ds}`, { method: "DELETE" })
    setResetMode(false)
    setAiText("")
    load()
  }

  const addCat = () => {
    const t = newCat.trim()
    if (!t || allCats.includes(t)) return
    const next = [...customCats, { name: t, color: newCatColor }]
    setCustomCats(next)
    localStorage.setItem("ts_cats", JSON.stringify(next))
    setNewCat("")
    setNewCatColor(PALETTE[0])
  }

  const delCat = name => {
    const next = customCats.filter(x => x.name !== name)
    setCustomCats(next)
    localStorage.setItem("ts_cats", JSON.stringify(next))
  }

  const updateCatColor = (name, color) => {
    const next = customCats.map(x => x.name === name ? { ...x, color } : x)
    setCustomCats(next)
    localStorage.setItem("ts_cats", JSON.stringify(next))
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${BG}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        select { appearance: none; -webkit-appearance: none; cursor: pointer; }
        select option { background: #18181E; }
        input:focus, select:focus { outline: none; }
      `}</style>

      <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'DM Sans', sans-serif", padding: "36px 48px 60px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 44 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: "-1px", color: TEXT }}>TimeScope</span>
            <span style={{ fontSize: 13, color: MUTED, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>2.0</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d); setAiText("") }}
              style={{ ...btn(), width: 32, height: 32, padding: 0, display: "grid", placeItems: "center", fontSize: 16 }}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 500, minWidth: 136, textAlign: "center", color: TEXT }}>{fmtLabel(date)}</span>
            <button
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d); setAiText("") }}
              disabled={isToday(date)}
              style={{ ...btn(), width: 32, height: 32, padding: 0, display: "grid", placeItems: "center", fontSize: 16, opacity: isToday(date) ? 0.25 : 1 }}>›</button>
            {!isToday(date) && (
              <button onClick={() => { setDate(new Date()); setAiText("") }} style={btn()}>Today</button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setSetupOpen(true); checkServices() }} style={btn()}>Setup</button>
            <button onClick={() => setManageOpen(true)} style={btn()}>Categories</button>
            {!resetMode
              ? <button onClick={() => setResetMode(true)} style={btn()}>Reset day</button>
              : <>
                  <button onClick={doReset} style={btn(false, true)}>Confirm reset</button>
                  <button onClick={() => setResetMode(false)} style={btn()}>Cancel</button>
                </>}
          </div>
        </div>

        {/* ── Hero Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lbl}>Total screen time</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 58, fontWeight: 800, letterSpacing: "-3px", lineHeight: 1, color: TEXT }}>
              {loading ? <span style={{ color: MUTED, fontSize: 32 }}>…</span> : total === 0 ? <span style={{ color: MUTED }}>—</span> : fmt(total)}
            </div>
            <div style={{ fontSize: 14, color: MUTED }}>{data.length} app{data.length !== 1 ? "s" : ""} tracked · {isToday(date) ? "live" : fmtLabel(date)}</div>
          </div>

          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lbl}>Most used app</div>
            {topApp
              ? <>
                  <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: "'Syne', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {topApp.appName.includes("|") ? topApp.appName.split("|")[0].trim() : topApp.appName}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 500, color: ACCENT }}>{fmt(topApp.minutes)}</div>
                  <div style={{ fontSize: 13, color: MUTED }}>{total > 0 ? Math.round(topApp.minutes / total * 100) : 0}% of total time</div>
                </>
              : <div style={{ color: MUTED, fontSize: 14 }}>No data</div>}
          </div>

          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={lbl}>Top category</div>
            {topCat
              ? <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: catMeta(topCat[0]).color }} />
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: TEXT }}>{topCat[0]}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 500, color: catMeta(topCat[0]).color }}>{fmt(topCat[1])}</div>
                  <div style={{ fontSize: 13, color: MUTED }}>{byCat.length} categor{byCat.length !== 1 ? "ies" : "y"} active</div>
                </>
              : <div style={{ color: MUTED, fontSize: 14 }}>No data</div>}
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

          {/* Pie Chart */}
          <div style={card}>
            <div style={{ ...lbl, marginBottom: 20 }}>By category</div>
            {byCat.length === 0
              ? <div style={{ color: MUTED, fontSize: 14 }}>No data for this day</div>
              : <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", width: 190, height: 190, flexShrink: 0 }}>
                    <ResponsiveContainer width={190} height={190}>
                      <PieChart>
                        <Pie
                          data={pieData} cx={90} cy={90}
                          innerRadius={58} outerRadius={88}
                          paddingAngle={2} dataKey="value" stroke="none"
                          onMouseEnter={(_, i) => setHoveredCat(pieData[i]?.name)}
                          onMouseLeave={() => setHoveredCat(null)}>
                          {pieData.map(entry => (
                            <Cell key={entry.name} fill={catMeta(entry.name).color} opacity={hoveredCat && hoveredCat !== entry.name ? 0.25 : 1} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      {hoveredCat
                        ? <>
                            <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 }}>{hoveredCat}</div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: catMeta(hoveredCat).color, fontFamily: "'JetBrains Mono', monospace" }}>
                              {fmt(byCat.find(([n]) => n === hoveredCat)?.[1] || 0)}
                            </div>
                          </>
                        : <>
                            <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 }}>Total</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(total)}</div>
                          </>}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                    {byCat.map(([c, min]) => {
                      const pct  = total > 0 ? Math.round(min / total * 100) : 0
                      const meta = catMeta(c)
                      const isHov = hoveredCat === c
                      return (
                        <div key={c} onMouseEnter={() => setHoveredCat(c)} onMouseLeave={() => setHoveredCat(null)}
                          style={{ display: "flex", alignItems: "center", gap: 9, cursor: "default", opacity: hoveredCat && !isHov ? 0.4 : 1, transition: "opacity 0.15s" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, color: TEXT, flex: 1 }}>{c}</span>
                          <span style={{ fontSize: 13, color: TEXT, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(min)}</span>
                          <span style={{ fontSize: 11, color: meta.color, background: meta.dim, borderRadius: 5, padding: "2px 7px", minWidth: 38, textAlign: "center" }}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>}
          </div>

          {/* Top 5 Apps */}
          <div style={card}>
            <div style={{ ...lbl, marginBottom: 20 }}>Top 5 apps</div>
            {sorted.length === 0
              ? <div style={{ color: MUTED, fontSize: 14 }}>No data for this day</div>
              : sorted.slice(0, 5).map(({ appName, minutes }, i) => {
                  const pct        = minutes / maxMin * 100
                  const c          = getCat(appName)
                  const meta       = catMeta(c)
                  const name       = appName.includes("|") ? appName.split("|")[0].trim() : appName
                  const pctOfTotal = total > 0 ? Math.round(minutes / total * 100) : 0
                  return (
                    <div key={appName} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: MUTED, fontFamily: "'JetBrains Mono', monospace", minWidth: 16 }}>{i + 1}</span>
                        <span style={{ fontSize: 14, color: TEXT, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        <span style={{ fontSize: 11, color: meta.color, background: meta.dim, borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>{c}</span>
                        <span style={{ fontSize: 13, color: TEXT, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, minWidth: 44, textAlign: "right" }}>{fmt(minutes)}</span>
                        <span style={{ fontSize: 12, color: MUTED, minWidth: 32, textAlign: "right" }}>{pctOfTotal}%</span>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 3, marginLeft: 24 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: meta.color, borderRadius: 3, opacity: 0.7, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  )
                })}
          </div>
        </div>

        {/* ── All Activities ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0, color: TEXT }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={lbl}>All activities</span>
              <span style={{ fontSize: 12, background: SURFACE2, color: MUTED, borderRadius: 20, padding: "2px 9px" }}>{data.length}</span>
            </div>
            <span style={{ color: MUTED, fontSize: 13 }}>{expanded ? "▴ collapse" : "▾ expand"}</span>
          </button>

          {expanded && (
            <>
              <div style={{ height: 1, background: BORDER, margin: "20px -28px 0" }} />
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 90px", gap: "0 16px" }}>
                  {["App / Page", "Category", "Time"].map(h => (
                    <div key={h} style={{ ...lbl, paddingBottom: 10, borderBottom: `1px solid ${BORDER}`, textAlign: h === "Time" ? "right" : "left" }}>{h}</div>
                  ))}
                  {sorted.map(({ appName, minutes }) => {
                    const isTab = appName.includes("|")
                    const name  = isTab ? appName.split("|")[0].trim() : appName
                    const title = isTab ? appName.split("|").slice(1).join("|").trim() : null
                    const c     = getCat(appName)
                    const meta  = catMeta(c)
                    return (
                      <Fragment key={appName}>
                        <div style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                          <div style={{ fontSize: 14, color: TEXT }}>{name}</div>
                          {title && <div style={{ fontSize: 12, color: MUTED, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>}
                        </div>
                        <div style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                          <select value={c} onChange={e => setCat(appName, e.target.value)}
                            style={{ background: meta.dim, border: `1px solid ${meta.color}40`, color: meta.color, borderRadius: 7, padding: "4px 10px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                            {allCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                        <div style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}`, textAlign: "right", fontSize: 13, color: TEXT, fontFamily: "'JetBrains Mono', monospace" }}>
                          {fmt(minutes)}
                        </div>
                      </Fragment>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── AI Analysis ── */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={lbl}>Time analysis</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>How you spent your time · powered by Ollama Llama3, runs locally</div>
            </div>
            <button onClick={genAI} disabled={aiLoading || data.length === 0} style={btn(!!aiText || aiLoading)}>
              {aiLoading ? "Analysing…" : aiText ? "Regenerate" : "Analyse my day"}
            </button>
          </div>
          {aiText && (
            <>
              <div style={{ height: 1, background: BORDER, margin: "18px -28px" }} />
              <div style={{ fontSize: 15, color: TEXT, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{aiText}</div>
            </>
          )}
        </div>
      </div>

      {/* ── Setup Modal ── */}
      {setupOpen && <SetupModal onClose={() => setSetupOpen(false)} services={services} onCheck={checkServices} />}

      {/* ── Manage Categories Modal ── */}
      {manageOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setManageOpen(false); setColorPickFor(null) } }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 32, width: 420, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 24, color: TEXT }}>Manage categories</div>

            <div style={{ ...lbl, marginBottom: 12 }}>Built-in</div>
            {BUILT_IN_CATS.map(c => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: CAT[c].color }} />
                <span style={{ fontSize: 14, color: TEXT, flex: 1 }}>{c}</span>
                <span style={{ fontSize: 12, color: MUTED }}>built-in</span>
              </div>
            ))}

            {customCats.length > 0 && (
              <>
                <div style={{ ...lbl, marginTop: 20, marginBottom: 12 }}>Custom</div>
                {customCats.map(({ name, color }) => (
                  <div key={name}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: colorPickFor === name ? "none" : `1px solid ${BORDER}` }}>
                      {/* Clickable color dot */}
                      <button
                        onClick={() => setColorPickFor(colorPickFor === name ? null : name)}
                        style={{ width: 20, height: 20, borderRadius: "50%", background: color, border: `2px solid ${colorPickFor === name ? TEXT : "transparent"}`, cursor: "pointer", flexShrink: 0, transition: "border-color 0.15s" }} />
                      <span style={{ fontSize: 14, color: TEXT, flex: 1 }}>{name}</span>
                      <span style={{ fontSize: 11, color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>{color}</span>
                      <button onClick={() => { delCat(name); setColorPickFor(null) }} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>
                    </div>
                    {/* Inline color palette */}
                    {colorPickFor === name && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 0 14px", borderBottom: `1px solid ${BORDER}` }}>
                        {PALETTE.map(p => (
                          <button
                            key={p}
                            onClick={() => { updateCatColor(name, p); setColorPickFor(null) }}
                            style={{ width: 26, height: 26, borderRadius: "50%", background: p, border: `2px solid ${color === p ? TEXT : "transparent"}`, cursor: "pointer", transition: "border-color 0.1s, transform 0.1s", transform: color === p ? "scale(1.2)" : "scale(1)" }} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* New category row */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Pick a color, then name it:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
                {PALETTE.map(p => (
                  <button
                    key={p}
                    onClick={() => setNewCatColor(p)}
                    style={{ width: 24, height: 24, borderRadius: "50%", background: p, border: `2px solid ${newCatColor === p ? TEXT : "transparent"}`, cursor: "pointer", transition: "border-color 0.1s, transform 0.1s", transform: newCatColor === p ? "scale(1.2)" : "scale(1)" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: newCatColor, flexShrink: 0, alignSelf: "center" }} />
                <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()}
                  placeholder="Category name…"
                  style={{ flex: 1, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 14px", color: TEXT, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
                <button onClick={addCat} style={btn(true)}>Add</button>
              </div>
            </div>

            <button onClick={() => { setManageOpen(false); setColorPickFor(null) }} style={{ ...btn(), width: "100%", marginTop: 20, height: 40, fontSize: 14 }}>Done</button>
          </div>
        </div>
      )}
    </>
  )
}