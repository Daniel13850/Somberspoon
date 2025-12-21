const dotenv = require("dotenv");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const http = require("http");
const multer = require("multer");
const { Server } = require("socket.io");
const { spawn } = require("child_process");

dotenv.config({ path: '~/kaboom/config.env' });

let pty = null;
try {
  // Optional: für echte Live-Konsole via dtach attach
  pty = require("node-pty");
} catch (e) {
  // bleibt null -> UI zeigt Hinweis
}

const HOME = path.join(os.homedir(), "kaboom");
const DTACH_SOCKET = path.join(HOME, "minecraft.sock");

const LOG_DIR = path.join(HOME, "logs");
const SCHEM_DIR = path.join(HOME, "schematics");

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}
ensureDir(LOG_DIR);
ensureDir(SCHEM_DIR);

function safeName(name) {
  // verhindert ../ und Pfadtricks
  const base = path.basename(name);
  if (base !== name) return null;
  if (base.includes("..")) return null;
  return base;
}

async function listFiles(dir) {
  const names = await fs.promises.readdir(dir).catch(() => []);
  const out = [];
  for (const n of names) {
    const full = path.join(dir, n);
    try {
      const st = await fs.promises.stat(full);
      if (!st.isFile()) continue;

      // "Erstellungsdatum": birthtime wenn vorhanden, sonst ctime
      const createdMs = (st.birthtimeMs && st.birthtimeMs > 0) ? st.birthtimeMs : st.ctimeMs;

      out.push({
        name: n,
        size: st.size,
        createdMs
      });
    } catch {}
  }
  out.sort((a, b) => b.createdMs - a.createdMs);
  return out;
}

// Skripte (fixe Pfade wie gewünscht, ohne "~")
const SCRIPTS = {
  start: path.join(HOME, "framework", "script", "init.sh"),
  stop: path.join(HOME, "framework", "script", "shutdown.sh"),
  restart: path.join(HOME, "framework", "script", "restart.sh"),
  reset: path.join(HOME, "framework", "script", "reset.sh")
};

// ----- Zustand / Lock (serverseitig) -----
let actionLock = {
  running: false,
  action: null,
  startedAt: null
};

// ---- Shared dtach attach + console buffer (since this webui process start) ----
let term = null;               // node-pty term (single shared)
let lastRunning = false;

const MAX_BUFFER = 2 * 1024 * 1024; // 2MB
let consoleBuffer = "";             // keeps ANSI output
function bufferAppend(s) {
  consoleBuffer += s;
  if (consoleBuffer.length > MAX_BUFFER) {
    consoleBuffer = consoleBuffer.slice(consoleBuffer.length - MAX_BUFFER);
  }
}
function bufferClear() {
  consoleBuffer = "";
}

function setLock(running, action = null) {
  actionLock.running = running;
  actionLock.action = action;
  actionLock.startedAt = running ? Date.now() : null;
}

// Prüfe ob dtach-Prozess läuft, der unseren Socket nutzt
function isServerRunning() {
  try {
    const base = path.basename(DTACH_SOCKET); // "kaboom"
    const procDirs = fs.readdirSync("/proc", { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d+$/.test(d.name))
      .map(d => d.name);

    for (const pid of procDirs) {
      let cmdline;
      try {
        cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
      } catch {
        continue;
      }
      if (!cmdline) continue;

      const args = cmdline.split("\u0000").filter(Boolean);
      if (args.length === 0) continue;

      const exe = path.basename(args[0] || "");
      if (exe !== "dtach") continue;

      // Suche nach: dtach -n kaboom  (oder -n /home/.../kaboom)
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "-n" && args[i + 1]) {
          const sockArg = args[i + 1];
          if (path.basename(sockArg) === base) return true;
        }
        // selten: -nkaboom oder -n/home/...
        if (a.startsWith("-n") && a.length > 2) {
          const sockArg = a.slice(2);
          if (path.basename(sockArg) === base) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function getStatus() {
  const running = await isServerRunning();
  return {
    running,
    lock: { ...actionLock },
    dtachSocket: DTACH_SOCKET,
    ptyAvailable: !!pty
  };
}

function attachIfNeeded() {
  if (!pty) return;
  if (term) return;

  term = pty.spawn("dtach", ["-a", DTACH_SOCKET], {
    name: "xterm-256color",
    cols: 120,
    rows: 30,
    cwd: HOME,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      LANG: process.env.LANG || "C.UTF-8"
    }
  });

  term.onData((data) => {
    bufferAppend(data);
    io.emit("console", { type: "data", data });
  });

  term.onExit(({ exitCode }) => {
    io.emit("console", { type: "system", data: `\n[dtach exited: ${exitCode}]\n` });
    term = null;
  });
}

function detachIfNeeded() {
  if (!term) return;
  try {
    // detach sequence (Ctrl+\) – dtach default
    term.write("\x1c");
  } catch {}
  try { term.kill?.(); } catch {}
  term = null;
}

function runScript(action) {
  return new Promise((resolve, reject) => {
    const scriptPath = SCRIPTS[action];
    if (!scriptPath) return reject(new Error("Unknown action"));
    if (!fs.existsSync(scriptPath)) return reject(new Error(`Script not found: ${scriptPath}`));

    // bash -lc "<script>" sorgt für saubere Shell-Umgebung
    const child = spawn("bash", ["-lc", scriptPath], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.on("error", (err) => reject(err));
  });
}

// ----- Webserver -----
const app = express();
app.use(express.static(path.join(__dirname, "public")));

// Liste abrufen
app.get("/api/files/:type", async (req, res) => {
  const type = req.params.type;
  if (type !== "logs" && type !== "schematics") return res.status(400).json({ error: "bad type" });

  const dir = type === "logs" ? LOG_DIR : SCHEM_DIR;
  const files = await listFiles(dir);
  res.json({ files });
});

// Download
app.get("/download/:type/:name", (req, res) => {
  const type = req.params.type;
  const name = safeName(req.params.name);
  if (!name) return res.status(400).send("bad name");
  if (type !== "logs" && type !== "schematics") return res.status(400).send("bad type");

  const dir = type === "logs" ? LOG_DIR : SCHEM_DIR;
  const full = path.join(dir, name);

  // res.download setzt Content-Disposition korrekt
  res.download(full, name, (err) => {
    if (err) res.status(404).send("not found");
  });
});

// Löschen (nur schematics)
app.delete("/api/files/schematics/:name", async (req, res) => {
  const name = safeName(req.params.name);
  if (!name) return res.status(400).json({ error: "bad name" });

  const full = path.join(SCHEM_DIR, name);
  try {
    await fs.promises.unlink(full);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ ok: false, error: "not found" });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SCHEM_DIR),
  filename: (req, file, cb) => {
    const original = safeName(file.originalname) || "upload.schem";
    let name = original;

    // Overwrite verhindern: wenn existiert -> timestamp anhängen
    const full = path.join(SCHEM_DIR, name);
    if (fs.existsSync(full)) {
      const ext = path.extname(original);
      const base = path.basename(original, ext);
      name = `${base}_${Date.now()}${ext}`;
    }
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 // 1 MB
  }
});

app.post("/api/files/schematics/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      // Multer: Datei zu groß
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ ok: false, error: "File too large (max 1 MB)" });
      }
      return res.status(400).json({ ok: false, error: err.message || "Upload failed" });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: "no file" });
    res.json({ ok: true, name: req.file.filename });
  });
});

const server = http.createServer(app);
const io = new Server(server);

async function broadcastStatus() {
  io.emit("status", await getStatus());
}

// ----- Socket.IO -----
io.on("connection", async (socket) => {
  const st = await getStatus();
  socket.emit("status", st);
  socket.emit("consoleBuffer", { data: consoleBuffer });

  // Wenn Server läuft, aber (warum auch immer) term noch nicht attached ist:
  if (st.running) attachIfNeeded();

  socket.on("requestStatus", async () => {
    socket.emit("status", await getStatus());
  });

  socket.on("action", async ({ type }) => {
    try {
      // serverseitige Blockade: niemals parallel
      if (actionLock.running) {
        socket.emit("actionResult", { ok: false, error: "A script is already running (locked)." });
        return;
      }

      const running = await isServerRunning();

      // Regeln wie gewünscht
      if (type === "start" && running) {
        socket.emit("actionResult", { ok: false, error: "Server is already running." });
        return;
      }
      if ((type === "stop" || type === "restart") && !running) {
        socket.emit("actionResult", { ok: false, error: "Server is not running." });
        return;
      }
      if (type !== "start" && type !== "stop" && type !== "restart" && type !== "reset") {
        socket.emit("actionResult", { ok: false, error: "Invalid action." });
        return;
      }

      setLock(true, type);
      await broadcastStatus();

      const result = await runScript(type);

      setLock(false, null);
      await broadcastStatus();

      socket.emit("actionResult", {
        ok: result.code === 0,
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr
      });
    } catch (e) {
      setLock(false, null);
      await broadcastStatus();
      socket.emit("actionResult", { ok: false, error: e?.message || String(e) });
    }
  });

  socket.on("consoleInput", (data) => {
    if (term) term.write(data);
  });
});

async function statusLoop() {
  const running = await isServerRunning();

  // Übergang AUS -> AN: Buffer leeren + attach starten
  if (!lastRunning && running) {
    bufferClear();
    io.emit("consoleClear");
    attachIfNeeded();
  }

  // Übergang AN -> AUS: detach
  if (lastRunning && !running) {
    detachIfNeeded();
  }

  lastRunning = running;
  io.emit("status", await getStatus());
}

// alle 1s Status pushen (kein Button mehr nötig)
setInterval(() => {
  statusLoop().catch(() => {});
}, 1000);

statusLoop().catch(() => {});

server.listen(process.env.webinterface_port, process.env.webinterface_host, () => {
  console.log(`mc-webui listening on http://${process.env.webinterface_host}:${process.env.webinterface_port}`);
});
