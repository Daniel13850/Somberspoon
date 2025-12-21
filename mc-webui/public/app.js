const socket = io();

const el = (id) => document.getElementById(id);

const btnStart = el("btnStart");
const btnStop = el("btnStop");
const btnRestart = el("btnRestart");
const btnReset = el("btnReset");

const statusLine = el("statusLine");
const lockLine = el("lockLine");
const ptyHint = el("ptyHint");

const logsList = el("logsList");
const schemList = el("schemList");
const btnUpload = el("btnUpload");
const uploadInput = el("uploadInput");

function fmtDate(ms){
  try { return new Date(ms).toLocaleString(); } catch { return ""; }
}

function rowHtml(type, f, withDelete){
  const safe = encodeURIComponent(f.name);
  const dl = `/download/${type}/${safe}`;
  return `
    <div class="fileRow">
      <div style="min-width:0">
        <div class="fileName" title="${f.name}">${f.name}</div>
        <div class="fileMeta">${fmtDate(f.createdMs)} · ${f.size} bytes</div>
      </div>
      <div class="fileBtns">
        <a href="${dl}"><button class="secondary">Download</button></a>
        ${withDelete ? `<button class="secondary" data-del="${f.name}">Löschen</button>` : ""}
      </div>
    </div>
  `;
}

async function refreshLists(){
  const [logs, schem] = await Promise.all([
    fetch("/api/files/logs").then(r=>r.json()),
    fetch("/api/files/schematics").then(r=>r.json())
  ]);

  logsList.innerHTML = (logs.files || []).map(f => rowHtml("logs", f, false)).join("");
  schemList.innerHTML = (schem.files || []).map(f => rowHtml("schematics", f, true)).join("");

  // Delete-Buttons binden
  schemList.querySelectorAll("button[data-del]").forEach(btn => {
    btn.onclick = async () => {
      const name = btn.getAttribute("data-del");
      btn.disabled = true;
      await fetch(`/api/files/schematics/${encodeURIComponent(name)}`, { method: "DELETE" });
      await refreshLists();
    };
  });
}

btnUpload.onclick = () => uploadInput.click();

uploadInput.onchange = async () => {
  const file = uploadInput.files?.[0];
  if (!file) return;
  const MAX = 1024 * 1024; // 1 MB
  if (file.size > MAX) {
    alert("Die Datei ist größer als 1 MB und kann nicht hochgeladen werden.");
    uploadInput.value = "";
    return;
  }

  const fd = new FormData();
  fd.append("file", file);

  btnUpload.disabled = true;
  try{
    await fetch("/api/files/schematics/upload", { method: "POST", body: fd });
  } finally {
    btnUpload.disabled = false;
    uploadInput.value = "";
  }
  await refreshLists();
};

let lastStatus = null;

// xterm (ANSI Farben/Formatierung)
const term = new Terminal({
  convertEol: true,
  scrollback: 5000,
  disableStdin: false,
  cursorBlink: true
});
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

const termDiv = el("terminal");
term.open(termDiv);
fitAddon.fit();

// Fokus beim Klick ins Terminal erzwingen
termDiv.addEventListener("mousedown", () => term.focus());
termDiv.addEventListener("touchstart", () => term.focus(), { passive: true });

// Beim Laden direkt fokusieren (kleiner Delay hilft auf Mobile/WebViews)
setTimeout(() => term.focus(), 50);

window.addEventListener("resize", () => fitAddon.fit());

// Eingaben aus dem Terminal an den Server schicken
term.onData((data) => {
  // Nur senden wenn Server läuft & nicht gelockt
  if (!lastStatus?.running) return;
  if (lastStatus.lock?.running) return;
  if (!lastStatus.ptyAvailable) return;

  socket.emit("consoleInput", data);
});

function setButtonsEnabled(status) {
  const running = status.running;
  const locked = status.lock?.running;
  const disableAll = !!locked;

  btnStart.disabled = disableAll || running;
  btnStop.disabled = disableAll || !running;
  btnRestart.disabled = disableAll || !running;
  btnReset.disabled = disableAll;
}

function renderStatus(status) {
  lastStatus = status;

  statusLine.textContent = `Status: ${status.running ? "LÄUFT" : "AUS"} (dtach: ${status.dtachSocket})`;
  const lock = status.lock;
  lockLine.textContent = lock?.running
    ? `Lock: AKTIV (läuft: ${lock.action})`
    : "Lock: frei";

  ptyHint.textContent = status.ptyAvailable
    ? ""
    : "Hinweis: node-pty fehlt → Live-Konsole deaktiviert (npm i node-pty).";

  setButtonsEnabled(status);
}

function doAction(type) {
  socket.emit("action", { type });
  // optional: kleines Feedback ins Terminal
  term.write(`\r\n[webui] action: ${type}\r\n`);
}

btnStart.onclick = () => doAction("start");
btnStop.onclick = () => doAction("stop");
btnRestart.onclick = () => doAction("restart");
btnReset.onclick = () => doAction("reset");

// Status kommt automatisch vom Server (periodisch + bei Changes)
socket.on("status", (status) => {
  renderStatus(status);
});

socket.on("actionResult", (res) => {
  if (!res.ok) {
    term.write(`\r\n[webui] ✗ Fehler: ${res.error || "unbekannt"}\r\n`);
    return;
  }
  term.write(`\r\n[webui] ✓ Exit-Code: ${res.code}\r\n`);
  if (res.stdout) term.write(`\r\n[stdout]\r\n${res.stdout}\r\n`);
  if (res.stderr) term.write(`\r\n[stderr]\r\n${res.stderr}\r\n`);
});

// Konsole: Server sendet Buffer + Live-Daten
socket.on("consoleClear", () => {
  term.reset();
  fitAddon.fit();
});

socket.on("consoleBuffer", ({ data }) => {
  if (data) term.write(data);
  fitAddon.fit();
});

socket.on("console", (msg) => {
  term.write(msg.data);
});

// initial: Server schickt Status & Buffer von allein nach connect
refreshLists();
setInterval(refreshLists, 5000);
