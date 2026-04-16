import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid
} from "recharts";

const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f5f4f0; }
`;

const DEFAULT_CATEGORIES = {
  work:    { color: "#6366f1", label: "Work"    },
  browse:  { color: "#f59e0b", label: "Browse"  },
  social:  { color: "#ec4899", label: "Social"  },
  leisure: { color: "#10b981", label: "Leisure" },
  system:  { color: "#94a3b8", label: "System"  },
  other:   { color: "#cbd5e1", label: "Other"   },
};

const PALETTE = [
  "#6366f1","#f59e0b","#ec4899","#10b981","#94a3b8","#ef4444",
  "#3b82f6","#8b5cf6","#f97316","#14b8a6","#64748b","#a855f7"
];

function defaultGuessCategory(name, categories) {
  const n = name.toLowerCase();
  if (n.includes(" | ")) {
    const domain = n.split(" | ")[0];
    if (["github.com","stackoverflow.com","docs.","localhost","vercel.app","notion.so","linear.app","jira.","figma.com","cursor.sh","codepen.io","replit.com","npmjs.com","pypi.org"].some(k => domain.includes(k))) return "work";
    if (["youtube.com","twitch.tv","netflix.com","spotify.com","reddit.com","9gag.com","primevideo.com"].some(k => domain.includes(k))) return "leisure";
    if (["instagram.com","twitter.com","x.com","facebook.com","linkedin.com","whatsapp.com","telegram.org","discord.com"].some(k => domain.includes(k))) return "social";
    return "browse";
  }
  if (["cursor","windowsterminal","claude","todoist","snipping","code"].some(k => n.includes(k))) return "work";
  if (["vivaldi","brave","chrome","firefox","searchhost"].some(k => n.includes(k))) return "browse";
  if (["steam","steamwebhelper"].some(k => n.includes(k))) return "leisure";
  if (["whatsapp","discord","telegram"].some(k => n.includes(k))) return "social";
  if (["explorer","lockapp","shellhost"].some(k => n.includes(k))) return "system";
  return "other";
}

function parseAppName(raw) {
  const cleaned = raw.replace(".exe", "");
  if (cleaned.includes(" | ")) {
    const idx = cleaned.indexOf(" | ");
    return { displayName: cleaned.slice(0, idx), detail: cleaned.slice(idx + 3) };
  }
  return { displayName: cleaned, detail: null };
}

// ── Small Components ──────────────────────────────────────────────────────────

const CategoryBadge = ({ category, categories, small, onClick }) => {
  const meta = categories[category] || categories.other || { color: "#cbd5e1", label: category };
  return (
    <span onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: meta.color + "18", color: meta.color,
      borderRadius: 6, padding: small ? "2px 7px" : "3px 9px",
      fontFamily: "DM Sans", fontWeight: 600,
      fontSize: small ? 10 : 11, letterSpacing: "0.03em",
      whiteSpace: "nowrap", flexShrink: 0,
      cursor: onClick ? "pointer" : "default",
      userSelect: "none"
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color, display: "inline-block" }} />
      {meta.label}
      {onClick && <span style={{ marginLeft: 2, opacity: 0.6 }}>▾</span>}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label, categories }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const meta = categories[d.category] || { color: "#cbd5e1", label: d.category };
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", maxWidth: 260 }}>
      <p style={{ fontFamily: "DM Sans", fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{label}</p>
      {d.detail && <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#64748b", marginTop: 3, lineHeight: 1.4, borderBottom: "1px solid #f1f5f9", paddingBottom: 8, marginBottom: 8 }}>{d.detail}</p>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94a3b8" }}>{d.minutes} min</span>
        <CategoryBadge category={d.category} categories={categories} small />
      </div>
    </div>
  );
};

const FocusMeter = ({ score }) => {
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Strong Focus" : score >= 45 ? "Moderate Focus" : "Fragmented Day";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={55} cy={55} r={r} fill="none" stroke="#f1f5f9" strokeWidth={9} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{ marginTop: -90, textAlign: "center", zIndex: 1 }}>
        <p style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 26, color: "#0f172a", lineHeight: 1 }}>{score}</p>
        <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94a3b8", marginTop: 2 }}>/ 100</p>
      </div>
      <div style={{ marginTop: 44 }}>
        <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, background: color + "18", color, padding: "3px 10px", borderRadius: 20 }}>{label}</span>
      </div>
    </div>
  );
};

const InsightPill = ({ type, text }) => {
  const styles = {
    positive: { bg: "#ecfdf5", text: "#065f46", dot: "#10b981" },
    warning:  { bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" },
    neutral:  { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8" },
  };
  const s = styles[type] || styles.neutral;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: s.bg, borderRadius: 10, padding: "10px 12px" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0, marginTop: 5 }} />
      <p style={{ fontFamily: "DM Sans", fontSize: 13, color: s.text, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
};

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1px solid #e5e7eb", flex: 1, minWidth: 0 }}>
    <p style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</p>
    <p style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 28, color: accent || "#0f172a", marginTop: 6, lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94a3b8", marginTop: 5 }}>{sub}</p>}
  </div>
);

// ── Category Picker Dropdown ──────────────────────────────────────────────────
const CategoryPicker = ({ current, categories, onSelect, onClose }) => {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{
      position: "absolute", zIndex: 100, top: "calc(100% + 6px)", right: 0,
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: "6px", minWidth: 150
    }}>
      {Object.entries(categories).map(([key, meta]) => (
        <div key={key} onClick={() => { onSelect(key); onClose(); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", borderRadius: 8, cursor: "pointer",
            background: key === current ? meta.color + "12" : "transparent",
            transition: "background 0.1s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = meta.color + "12"}
          onMouseLeave={e => e.currentTarget.style.background = key === current ? meta.color + "12" : "transparent"}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
          <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#374151" }}>{meta.label}</span>
          {key === current && <span style={{ marginLeft: "auto", color: meta.color, fontSize: 11 }}>✓</span>}
        </div>
      ))}
    </div>
  );
};

// ── App Row ───────────────────────────────────────────────────────────────────
const AppRow = ({ item, totalMin, categories, onCategoryChange }) => {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pct = totalMin > 0 ? Math.round((item.minutes / totalMin) * 100) : 0;
  const meta = categories[item.category] || { color: "#cbd5e1", label: item.category };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: hovered ? "#f8fafc" : "transparent", transition: "background 0.15s" }}
    >
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "DM Sans", fontWeight: 600, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.displayName}
        </p>
        {item.detail && hovered && (
          <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94a3b8", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.detail}
          </p>
        )}
      </div>

      {/* Category badge — click to open picker */}
      <div style={{ position: "relative" }}>
        <CategoryBadge
          category={item.category}
          categories={categories}
          small
          onClick={() => setPickerOpen(p => !p)}
        />
        {pickerOpen && (
          <CategoryPicker
            current={item.category}
            categories={categories}
            onSelect={(cat) => onCategoryChange(item.fullName, cat)}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 70 }}>
        <span style={{ fontFamily: "DM Sans", fontWeight: 600, fontSize: 12, color: "#374151" }}>{item.minutes}m</span>
        <div style={{ width: 70, height: 4, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: meta.color, borderRadius: 999, transition: "width 0.6s ease" }} />
        </div>
      </div>
    </div>
  );
};

// ── Manage Categories Modal ───────────────────────────────────────────────────
const ManageCategoriesModal = ({ categories, onSave, onClose }) => {
  const [local, setLocal] = useState(JSON.parse(JSON.stringify(categories)));
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const LOCKED = ["other"]; // can't delete these

  const addCategory = () => {
    if (!newLabel.trim()) return;
    const key = newLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (local[key]) return;
    setLocal(prev => ({ ...prev, [key]: { color: newColor, label: newLabel.trim() } }));
    setNewLabel("");
  };

  const deleteCategory = (key) => {
    const next = { ...local };
    delete next[key];
    setLocal(next);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "28px", width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 18, color: "#0f172a" }}>Manage Categories</p>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>✕</button>
        </div>

        {/* Existing categories */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, maxHeight: 260, overflowY: "auto" }}>
          {Object.entries(local).map(([key, meta]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", borderRadius: 10 }}>
              <input type="color" value={meta.color}
                onChange={e => setLocal(prev => ({ ...prev, [key]: { ...prev[key], color: e.target.value } }))}
                style={{ width: 28, height: 28, border: "none", borderRadius: 6, cursor: "pointer", padding: 0, background: "none" }} />
              <input value={meta.label}
                onChange={e => setLocal(prev => ({ ...prev, [key]: { ...prev[key], label: e.target.value } }))}
                style={{ flex: 1, fontFamily: "DM Sans", fontWeight: 600, fontSize: 13, border: "none", background: "transparent", color: "#0f172a", outline: "none" }} />
              <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94a3b8" }}>{key}</span>
              {!LOCKED.includes(key) && (
                <button onClick={() => deleteCategory(key)}
                  style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "DM Sans", fontSize: 11, fontWeight: 600 }}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginBottom: 20 }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Add Category</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              style={{ width: 36, height: 36, border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", padding: 2 }} />
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCategory()}
              placeholder="Category name..."
              style={{ flex: 1, fontFamily: "DM Sans", fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", outline: "none", color: "#0f172a" }}
            />
            <button onClick={addCategory}
              style={{ fontFamily: "DM Sans", fontWeight: 600, fontSize: 13, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
              Add
            </button>
          </div>
          {/* Color palette shortcuts */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {PALETTE.map(c => (
              <div key={c} onClick={() => setNewColor(c)}
                style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: newColor === c ? "2px solid #0f172a" : "2px solid transparent", transition: "border 0.1s" }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ fontFamily: "DM Sans", fontWeight: 600, fontSize: 13, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { onSave(local); onClose(); }}
            style={{ fontFamily: "DM Sans", fontWeight: 600, fontSize: 13, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function TimeScope() {
  const [appData, setAppData] = useState([]);
  const [totalMin, setTotalMin] = useState(0);
  const [topApp, setTopApp] = useState({ displayName: "-", minutes: 0 });
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [categoryOverrides, setCategoryOverrides] = useState({});
  const [manageOpen, setManageOpen] = useState(false);

  const resolveCategory = (fullName, autoCategory) =>
    categoryOverrides[fullName] || autoCategory;

  const fetchData = () => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`http://localhost:8080/api/usage?date=${today}`)
      .then(r => r.json())
      .then(data => {
        const cleaned = data.map(d => {
          const { displayName, detail } = parseAppName(d.appName);
          const autoCategory = defaultGuessCategory(d.appName, categories);
          const category = resolveCategory(d.appName, autoCategory);
          return { name: displayName, displayName, detail, fullName: d.appName, minutes: d.minutes, category };
        });
        setAppData(cleaned);
        setTotalMin(cleaned.reduce((s, d) => s + d.minutes, 0));
        setTopApp([...cleaned].sort((a, b) => b.minutes - a.minutes)[0] || { displayName: "-", minutes: 0 });
      })
      .catch(console.error);
  };

  useEffect(() => { fetchData(); }, []);

  // Re-apply overrides when categories or overrides change
  useEffect(() => {
    setAppData(prev => prev.map(d => ({
      ...d,
      category: resolveCategory(d.fullName, defaultGuessCategory(d.fullName, categories))
    })));
  }, [categoryOverrides, categories]);

  const handleReset = async () => {
    if (!confirm("Reset all tracked data for today?")) return;
    const today = new Date().toISOString().split("T")[0];
    await fetch(`http://localhost:8080/api/reset?date=${today}`, { method: "DELETE" });
    setAppData([]); setTotalMin(0); setTopApp({ displayName: "-", minutes: 0 });
    setInsights(null); setCategoryFilter(null);
  };

  const handleCategoryChange = (fullName, newCategory) => {
    setCategoryOverrides(prev => ({ ...prev, [fullName]: newCategory }));
  };

  const handleCategorySave = (newCategories) => {
    setCategories(newCategories);
    // Remove overrides pointing to deleted categories
    setCategoryOverrides(prev => {
      const cleaned = {};
      for (const [k, v] of Object.entries(prev)) {
        if (newCategories[v]) cleaned[k] = v;
      }
      return cleaned;
    });
  };

  const categoryTotals = appData.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + d.minutes;
    return acc;
  }, {});

  const filteredData = categoryFilter
    ? appData.filter(d => d.category === categoryFilter)
    : appData;

  const generateInsights = async () => {
    setLoading(true); setError(null); setInsights(null);
    const appSummary = appData.map(d => `${d.displayName}: ${d.minutes} min (${d.category})`).join(", ");
    const prompt = `You are a productivity analyst. Analyze this Windows screen time data for ${new Date().toDateString()}: ${appSummary}. Total: ${totalMin} min across ${appData.length} apps.

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "focusScore": <integer 0-100>,
  "headline": "<one sharp sentence describing the day's productivity pattern>",
  "insights": [
    {"type": "positive|warning|neutral", "text": "<specific insight with numbers>"},
    {"type": "positive|warning|neutral", "text": "<second insight>"},
    {"type": "positive|warning|neutral", "text": "<third insight>"}
  ],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"],
  "deepWorkMin": <integer>,
  "contextSwitches": <integer>
}`;
    try {
      const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama3", prompt, stream: false })
      });
      const data = await res.json();
      setInsights(JSON.parse(data.response.replace(/```json|```/g, "").trim()));
    } catch (e) {
      setError("Failed to generate insights. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{FONT_IMPORT}</style>
      {manageOpen && <ManageCategoriesModal categories={categories} onSave={handleCategorySave} onClose={() => setManageOpen(false)} />}

      <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "DM Sans, sans-serif", padding: "32px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>⏱</span>
                <h1 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 32, color: "#0f172a", letterSpacing: "-0.02em" }}>TimeScope</h1>
              </div>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 14px", textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Last updated</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            <StatCard label="Total Tracked" value={`${totalMin}m`} sub={`≈ ${(totalMin / 60).toFixed(1)} hours`} />
            <StatCard label="Top App" value={topApp.displayName} sub={totalMin > 0 ? `${topApp.minutes} min · ${Math.round(topApp.minutes / totalMin * 100)}% of day` : "-"} accent="#6366f1" />
            <StatCard label="Apps Used" value={appData.length} sub="distinct applications" />
          </div>

          {/* Category breakdown */}
          {totalMin > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: "18px 22px", border: "1px solid #e5e7eb", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>Time Breakdown</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {categoryFilter && (
                    <button onClick={() => setCategoryFilter(null)} style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>✕ Clear</button>
                  )}
                  <button onClick={() => setManageOpen(true)} style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>⚙ Manage</button>
                </div>
              </div>
              <div style={{ height: 10, borderRadius: 999, overflow: "hidden", display: "flex", background: "#f1f5f9", cursor: "pointer" }}>
                {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, min]) => (
                  <div key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                    title={`${categories[cat]?.label || cat}: ${min}m`}
                    style={{ width: `${(min / totalMin) * 100}%`, background: categories[cat]?.color || "#cbd5e1", opacity: categoryFilter && categoryFilter !== cat ? 0.3 : 1, transition: "width 0.8s ease, opacity 0.2s" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, min]) => {
                  const meta = categories[cat] || { color: "#cbd5e1", label: cat };
                  const active = categoryFilter === cat;
                  return (
                    <button key={cat} onClick={() => setCategoryFilter(active ? null : cat)} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: active ? meta.color : meta.color + "18", color: active ? "#fff" : meta.color,
                      border: "none", borderRadius: 20, padding: "4px 10px", cursor: "pointer",
                      fontFamily: "DM Sans", fontWeight: 600, fontSize: 11, transition: "all 0.15s"
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "#fff" : meta.color }} />
                      {meta.label} · {min}m
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chart */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "22px 22px 10px", border: "1px solid #e5e7eb", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Time per App — Minutes
                {categoryFilter && <span style={{ color: categories[categoryFilter]?.color, marginLeft: 6 }}>· {categories[categoryFilter]?.label} only</span>}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={fetchData} style={{ fontFamily: "DM Sans", fontWeight: 600, fontSize: 12, background: "#f8fafc", color: "#64748b", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>↻ Refresh</button>
                <button onClick={handleReset} style={{ fontFamily: "DM Sans", fontWeight: 600, fontSize: 12, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Reset</button>
              </div>
            </div>
            {filteredData.length === 0 ? (
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>
                {appData.length === 0 ? "No data yet — make sure Spring Boot and the logger are running." : "No apps in this category yet."}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={filteredData} barSize={28} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="0" />
                  <XAxis dataKey="displayName" tick={{ fontFamily: "DM Sans", fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontFamily: "DM Sans", fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip categories={categories} />} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                    {filteredData.map((entry, i) => (
                      <Cell key={i} fill={categories[entry.category]?.color || "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* All Activities — Collapsible */}
          {appData.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
              {/* Header row — always visible */}
              <button
                onClick={() => setActivitiesOpen(o => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
                  borderBottom: activitiesOpen ? "1px solid #f1f5f9" : "none", transition: "border 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "DM Sans" }}>
                    All Activities
                    {categoryFilter && <span style={{ color: categories[categoryFilter]?.color, marginLeft: 6 }}>· {categories[categoryFilter]?.label}</span>}
                  </p>
                  <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94a3b8", background: "#f1f5f9", borderRadius: 20, padding: "1px 8px" }}>
                    {filteredData.length}
                  </span>
                </div>
                <span style={{ color: "#94a3b8", fontSize: 12, transition: "transform 0.2s", display: "inline-block", transform: activitiesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </button>

              {/* Collapsible body */}
              {activitiesOpen && (
                <div style={{ padding: "8px 6px" }}>
                  {filteredData.slice().sort((a, b) => b.minutes - a.minutes).map((item, i) => (
                    <AppRow key={i} item={item} totalMin={totalMin} categories={categories} onCategoryChange={handleCategoryChange} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Insights */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 22px", borderBottom: insights || loading ? "1px solid #f1f5f9" : "none" }}>
              <div>
                <p style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, color: "#0f172a" }}>AI Insights</p>
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Focus analysis · Context switching · Recommendations</p>
              </div>
              <button onClick={generateInsights} disabled={loading || appData.length === 0} style={{
                fontFamily: "DM Sans", fontWeight: 600, fontSize: 13,
                background: loading || appData.length === 0 ? "#e5e7eb" : "#0f172a",
                color: loading || appData.length === 0 ? "#94a3b8" : "#fff",
                border: "none", borderRadius: 10, padding: "10px 18px",
                cursor: loading || appData.length === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s"
              }}>
                <span style={{ fontSize: 14 }}>{loading ? "⏳" : "✦"}</span>
                {loading ? "Analyzing..." : "Generate"}
              </button>
            </div>

            {loading && (
              <div style={{ padding: "32px 22px", textAlign: "center" }}>
                <div style={{ width: 36, height: 36, border: "3px solid #f1f5f9", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94a3b8" }}>Analyzing your productivity patterns...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {error && <div style={{ padding: "20px 22px" }}><p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#ef4444" }}>{error}</p></div>}

            {insights && !loading && (
              <div style={{ padding: "22px" }}>
                <div style={{ background: "#fafafa", borderRadius: 12, padding: "14px 16px", marginBottom: 20, borderLeft: "3px solid #6366f1" }}>
                  <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0f172a", lineHeight: 1.5 }}>{insights.headline}</p>
                </div>
                <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
                  <div style={{ flex: "0 0 160px", background: "#fafafa", borderRadius: 14, padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", border: "1px solid #f1f5f9" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Focus Score</p>
                    <FocusMeter score={insights.focusScore} />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1, background: "#ecfdf5", borderRadius: 12, padding: "14px 16px" }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#065f46", letterSpacing: "0.06em", textTransform: "uppercase" }}>Deep Work</p>
                        <p style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 24, color: "#065f46", marginTop: 4 }}>{insights.deepWorkMin}m</p>
                      </div>
                      <div style={{ flex: 1, background: "#fffbeb", borderRadius: 12, padding: "14px 16px" }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#92400e", letterSpacing: "0.06em", textTransform: "uppercase" }}>App Switches</p>
                        <p style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 24, color: "#92400e", marginTop: 4 }}>{insights.contextSwitches}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {insights.insights?.map((ins, i) => <InsightPill key={i} type={ins.type} text={ins.text} />)}
                    </div>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Recommendations</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {insights.recommendations?.map((rec, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne", fontWeight: 700, fontSize: 12, color: "#6366f1", flexShrink: 0 }}>{i + 1}</span>
                        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#374151", lineHeight: 1.6, paddingTop: 2 }}>{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!insights && !loading && !error && (
              <div style={{ padding: "28px 22px", textAlign: "center" }}>
                <p style={{ fontFamily: "DM Sans", fontSize: 32, marginBottom: 8 }}>✦</p>
                <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#94a3b8" }}>
                  Click Generate to get focus analysis, context switching insights, and personalized recommendations.
                </p>
              </div>
            )}
          </div>

          <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#cbd5e1", textAlign: "center", marginTop: 24 }}>
            TimeScope · Built with Python + Spring Boot + React · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  );
}