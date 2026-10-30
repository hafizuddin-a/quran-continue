const INSTAGRAM_URL = "https://www.instagram.com/madebyhafiz/";

const $ = (id) => document.getElementById(id);

// Show the shortcut in words, with "Option" on a Mac (Chrome may return symbols like ⌥⇧Q there).
function prettyShortcut(s) {
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  const symbols = { "⌘": "Command", "⌥": "Option", "⇧": "Shift", "⌃": "Control" };
  if (/[⌘⌥⇧⌃]/.test(s)) {
    const parts = [];
    let key = "";
    for (const ch of s) {
      if (symbols[ch]) parts.push(symbols[ch]);
      else if (ch !== "+") key += ch;
    }
    return [...parts, key].filter(Boolean).join("+");
  }
  const words = s.split("+").map((w) => (isMac && w === "Alt" ? "Option" : isMac && w === "Ctrl" ? "Command" : w));
  return words.join("+");
}

async function render() {
  const { verseKey, wakeEnabled = true, startupEnabled = true } =
    await chrome.storage.local.get(["verseKey", "wakeEnabled", "startupEnabled"]);
  $("wake").checked = wakeEnabled;
  $("startup").checked = startupEnabled;

  // Some Chromium browsers (Ecosia, for one) do not offer the shortcuts API: hide the hint there.
  if (chrome.commands && chrome.commands.getAll) {
    const cmds = await chrome.commands.getAll();
    const open = cmds.find((c) => c.name === "open-quran");
    $("shortcut").textContent = open && open.shortcut ? `Shortcut ${prettyShortcut(open.shortcut)}` : "Set a shortcut";
  } else {
    $("shortcut").hidden = true;
  }

  const m = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey || "");
  if (m && SURAH_NAMES[Number(m[1]) - 1]) {
    $("verse").textContent = `${m[1]}:${m[2]}`;
    $("verse-sub").textContent = `Surah ${SURAH_NAMES[Number(m[1]) - 1]}, verse ${m[2]}`;
  }
}

$("startup").addEventListener("change", (e) => chrome.storage.local.set({ startupEnabled: e.target.checked }));
$("shortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  window.close();
});
$("wake").addEventListener("change", (e) => chrome.storage.local.set({ wakeEnabled: e.target.checked }));

$("open").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "qr-open" });
  window.close();
});

// ---- Your Quran.com account ----
function accountMessage(text) {
  $("acct-msg").textContent = text;
  $("acct-msg").hidden = !text;
}

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function renderAccount(status) {
  const on = !!(status && status.signedIn);
  $("acct-off").hidden = on;
  $("acct-on").hidden = !on;
  if (on) {
    $("acct-user").textContent = status.user || "your account";
    $("acct-sub").textContent = status.lastSync ? `Last synced ${ago(status.lastSync)}` : "Not synced yet";
  }
  accountMessage(status && status.error ? status.error : "");
}

async function refreshAccount() {
  renderAccount(await chrome.runtime.sendMessage({ type: "qf-status" }));
  // Opening the menu is a good moment to check for a place read elsewhere.
  const synced = await chrome.runtime.sendMessage({ type: "qf-sync" });
  if (synced && synced.ok) renderAccount(synced);
}

$("signin").addEventListener("click", async () => {
  accountMessage("");
  $("signin").disabled = true;
  const out = await chrome.runtime.sendMessage({ type: "qf-signin" });
  $("signin").disabled = false;
  if (out && out.ok) renderAccount(out);
  else accountMessage((out && out.error) || "Sign-in did not finish. Please try again.");
});

$("signout").addEventListener("click", async () => {
  $("signout").disabled = true;
  const out = await chrome.runtime.sendMessage({ type: "qf-signout" });
  $("signout").disabled = false;
  renderAccount(out);
});

// ---- On your phone ----
// Draws the link as a QR code (dark squares on white, with the quiet border scanners need).
function drawQr(canvas, text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const dpr = window.devicePixelRatio || 1;
  const cell = Math.max(1, Math.floor((104 * dpr) / (n + quiet * 2)));
  const px = cell * (n + quiet * 2);
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
}

$("phone-toggle").addEventListener("click", () => {
  const open = $("phone-steps").hidden;
  $("phone-steps").hidden = !open;
  $("phone-toggle").textContent = open ? "Hide steps" : "Show steps";
  $("phone-toggle").setAttribute("aria-expanded", String(open));
  if (open) drawQr($("qr"), "https://quran.com");
});

$("dev").addEventListener("click", () => {
  chrome.tabs.create({ url: INSTAGRAM_URL });
  window.close();
});

// A place synced in from your phone or another computer while the menu is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.verseKey) render();
});

render();
refreshAccount();
