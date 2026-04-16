import { useState, useEffect, useRef } from "react";

const LAUNCHER = "http://localhost:3001";

const SERVICES = {
  backend:  { name: "Spring Boot",    port: 8080,  icon: "☕", color: "#6366f1", desc: "API · SQLite · Port 8080" },
  logger:   { name: "Python Logger",  port: null,  icon: "🐍", color: "#10b981", desc: "Win32 activity tracker"    },
  ollama:   { name: "Ollama / Llama3",port: 11434, icon: "🦙", color: "#f59e0b", desc: "Local AI · Port 11434"     },
  frontend: { name: "React Dev",      port: 5173,  icon: "⚛",  color: "#ec4899", desc: "Vite · Port 5173"          },
};

const FONT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');`;

function StatusDot({ running }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", display: "inline-flex", borderRadius: "50%",
        width: "100%", height: "100%",
        background: running ? "#10b981" : "#e5e7eb",
        animation: running ? "ping 1.5s ease infinite" : "none",
        opacity: 0.6,
      }} />
      <span style={{
        borderRadius: "50%", width: 10, height: 10,
        background: running ? "#10b981" : "#d1d5db",
        display: "inline-block", position: "relative",
      }} />
      <style>{`@keyframes ping { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.8);opacity:0} }`}</style>
    </span>
  );
}

function LogPane({ id }) {
  const [lines, setLines] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${LAUNCHER}/logs/${id}`);
        const d = await r.json();
        setLines(d.logs || []);
      } catch {}
    }, 1500);
    return () => clearInterval(poll);
  }, [id]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div ref={ref} style={{
      background: "#0f172a", borderRadius: "0 0 14px 14px",
      padding: "12px 14px", height: 140, overflowY: "auto",
      fontFamily: "'Courier New', monospace", fontSize: 11,
      color: "#94a3b8", lineHeight: 1.7, marginTop: 0,
    }}>
      {lines.length === 0
        ? <span style={{ color: "#334155" }}>No output yet…</span>
        : lines.map((l, i) => (
          <div key={i} style={{ color: l.includes("ERROR") || l.includes("error") ? "#f87171" : l.includes("Started") || l.includes("running") ? "#34d399" : "#94a3b8" }}>
            {l}
          </div>
        ))
      }
    </div>
  );
}

function ServiceCard({ id, meta, status, onStart, onStop }) {
  const [showLogs, setShowLogs] = useState(false);
  const running = status?.running;

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
      overflow: "hidden", transition: "box-shadow 0.2s",
    }}>
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: meta.color + "15", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 20
            }}>{meta.icon}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{meta.name}</p>
                <StatusDot running={running} />
              </div>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{meta.desc}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setShowLogs(v => !v)}
              style={{
                fontFamily: "DM Sans", fontSize: 11, fontWeight: 600,
                background: "#f8fafc", color: "#64748b",
                border: "1px solid #e5e7eb", borderRadius: 8,
                padding: "6px 10px", cursor: "pointer"
              }}
            >{showLogs ? "Hide logs" : "Logs"}</button>

            {running ? (
              <button onClick={() => onStop(id)} style={{
                fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
                background: "#fef2f2", color: "#dc2626",
                border: "1px solid #fecaca", borderRadius: 8,
                padding: "7px 14px", cursor: "pointer"
              }}>Stop</button>
            ) : (
              <button onClick={() => onStart(id)} style={{
                fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
                background: meta.color, color: "#fff",
                border: "none", borderRadius: 8,
                padding: "7px 14px", cursor: "pointer"
              }}>Start</button>
            )}
          </div>
        </div>

        {status?.pid && (
          <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
            PID {status.pid}{meta.port ? ` · localhost:${meta.port}` : ""}
          </p>
        )}
      </div>

      {showLogs && <LogPane id={id} />}
    </div>
  );
}

export default function SetupDashboard() {
  const [status, setStatus] = useState({});
  const [launcherUp, setLauncherUp] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchStatus = async () => {
    try {
      const r = await fetch(`${LAUNCHER}/status`, { signal: AbortSignal.timeout(2000) });
      setStatus(await r.json());
      setLauncherUp(true);
    } catch {
      setLauncherUp(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 3000);
    return () => clearInterval(t);
  }, []);

  const handleStart = async (id) => {
    try {
      const r = await fetch(`${LAUNCHER}/start/${id}`, { method: "POST" });
      const d = await r.json();
      showToast(d.message);
      setTimeout(fetchStatus, 1000);
    } catch { showToast("Launcher not reachable"); }
  };

  const handleStop = async (id) => {
    try {
      const r = await fetch(`${LAUNCHER}/stop/${id}`, { method: "POST" });
      const d = await r.json();
      showToast(d.message);
      setTimeout(fetchStatus, 800);
    } catch { showToast("Launcher not reachable"); }
  };

  const startAll = () => Object.keys(SERVICES).forEach(id => handleStart(id));
  const stopAll  = () => Object.keys(SERVICES).forEach(id => handleStop(id));

  const allRunning = Object.keys(SERVICES).every(id => status[id]?.running);
  const anyRunning = Object.keys(SERVICES).some(id => status[id]?.running);

  return (
    <>
      <style>{FONT}</style>
      <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "DM Sans, sans-serif", padding: "32px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 28, color: "#0f172a", letterSpacing: "-0.02em" }}>
                ⏱ TimeScope Setup
              </h1>
              <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Control panel · All services</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot running={launcherUp} />
              <span style={{ fontSize: 12, color: launcherUp ? "#10b981" : "#94a3b8", fontWeight: 600 }}>
                {launcherUp ? "Launcher connected" : "Launcher offline"}
              </span>
            </div>
          </div>

          {/* Launcher offline warning */}
          {!launcherUp && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14,
              padding: "14px 18px", marginBottom: 20
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>Launcher server not running</p>
              <p style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>
                Run <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>start.bat</code> or{" "}
                <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>cd launcher && npm start</code> first.
              </p>
            </div>
          )}

          {/* Global actions */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <button onClick={startAll} disabled={!launcherUp} style={{
              fontFamily: "DM Sans", fontWeight: 600, fontSize: 13,
              background: launcherUp ? "#0f172a" : "#e5e7eb",
              color: launcherUp ? "#fff" : "#94a3b8",
              border: "none", borderRadius: 10, padding: "10px 20px",
              cursor: launcherUp ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6
            }}>▶ Start All</button>
            <button onClick={stopAll} disabled={!launcherUp || !anyRunning} style={{
              fontFamily: "DM Sans", fontWeight: 600, fontSize: 13,
              background: "#fef2f2", color: anyRunning ? "#dc2626" : "#94a3b8",
              border: "1px solid #fecaca", borderRadius: 10, padding: "10px 20px",
              cursor: launcherUp && anyRunning ? "pointer" : "not-allowed"
            }}>■ Stop All</button>
            {allRunning && (
              <a href="/" style={{
                fontFamily: "DM Sans", fontWeight: 600, fontSize: 13,
                background: "#ecfdf5", color: "#065f46",
                border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 20px",
                textDecoration: "none", display: "flex", alignItems: "center", gap: 6
              }}>→ Open Dashboard</a>
            )}
          </div>

          {/* Service cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(SERVICES).map(([id, meta]) => (
              <ServiceCard
                key={id} id={id} meta={meta}
                status={status[id]}
                onStart={handleStart} onStop={handleStop}
              />
            ))}
          </div>

          {/* Toast */}
          {toast && (
            <div style={{
              position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
              background: "#0f172a", color: "#fff", borderRadius: 10,
              padding: "10px 20px", fontSize: 13, fontWeight: 500,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 999
            }}>{toast}</div>
          )}
        </div>
      </div>
    </>
  );
}