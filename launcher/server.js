const express = require("express");
const cors = require("cors");
const { spawn, exec } = require("child_process");
const path = require("path");
const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());

const ROOT = path.resolve(__dirname, "..");

const processes = {};

const SERVICES = {
  backend: {
    name: "Spring Boot Backend",
    port: 8080,
    cmd: "mvn",
    args: ["spring-boot:run"],
    cwd: path.join(ROOT, "backend"),
    color: "#6366f1",
  },
  logger: {
    name: "Python Logger",
    port: null,
    cmd: "python",
    args: ["main.py"],
    cwd: path.join(ROOT, "logger"),
    color: "#10b981",
  },
  ollama: {
    name: "Ollama (Llama3)",
    port: 11434,
    cmd: "ollama",
    args: ["serve"],
    cwd: ROOT,
    color: "#f59e0b",
  },
  frontend: {
    name: "React Frontend",
    port: 5173,
    cmd: "npm",
    args: ["run", "dev"],
    cwd: path.join(ROOT, "frontend"),
    color: "#ec4899",
  },
};

function pingPort(port) {
  return new Promise((resolve) => {
    if (!port) return resolve(false);
    const req = http.get({ hostname: "localhost", port, path: "/", timeout: 1500 }, () => resolve(true));
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

// GET /status — check all services
app.get("/status", async (req, res) => {
  const status = {};
  for (const [id, svc] of Object.entries(SERVICES)) {
    const running = processes[id] && !processes[id].killed;
    const reachable = svc.port ? await pingPort(svc.port) : running;
    status[id] = {
      running: running || reachable,
      pid: processes[id]?.pid || null,
      port: svc.port,
      logs: logs[id]?.slice(-50) || [],
    };
  }
  res.json(status);
});

const logs = {};

// POST /start/:service
app.post("/start/:id", (req, res) => {
  const id = req.params.id;
  const svc = SERVICES[id];
  if (!svc) return res.status(404).json({ error: "Unknown service" });
  if (processes[id] && !processes[id].killed) {
    return res.json({ ok: false, message: "Already running" });
  }

  logs[id] = [];

  const proc = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    shell: true,
    env: { ...process.env },
  });

  processes[id] = proc;

  const addLog = (data) => {
    const lines = data.toString().split("\n").filter(Boolean);
    logs[id] = [...(logs[id] || []), ...lines].slice(-200);
  };

  proc.stdout.on("data", addLog);
  proc.stderr.on("data", addLog);
  proc.on("close", (code) => {
    logs[id]?.push(`[process exited with code ${code}]`);
    delete processes[id];
  });

  res.json({ ok: true, pid: proc.pid, message: `${svc.name} started` });
});

// POST /stop/:service
app.post("/stop/:id", (req, res) => {
  const id = req.params.id;
  const proc = processes[id];

  if (id === "ollama") {
    exec("taskkill /IM ollama.exe /F", () => {});
    delete processes[id];
    return res.json({ ok: true, message: "Ollama stopped" });
  }

  if (id === "frontend") {
    exec(`taskkill /IM node.exe /F`, () => {});
    delete processes[id];
    return res.json({ ok: true, message: "Frontend stopped" });
  }
  if (!proc || proc.killed) return res.json({ ok: false, message: "Not running" });

  exec(`taskkill /PID ${proc.pid} /T /F`, (err) => {
    if (err) proc.kill();
  });
  delete processes[id];
  res.json({ ok: true, message: "Stopped" });
});

// GET /logs/:service
app.get("/logs/:id", (req, res) => {
  const id = req.params.id;
  res.json({ logs: logs[id] || [] });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n  TimeScope Launcher running on http://localhost:${PORT}\n`);
});