// Quran Continue launcher: a tiny installable page that signs in with Quran.com
// (Authorization Code + PKCE, public client) and sends you to quran.com at your
// last verse. No server of our own; tokens stay in this browser's localStorage.

const QF = {
  env: "production", // "prelive" | "production"
  clientIds: { prelive: "fcc4aa0c-ead8-42b4-a1c2-fea66199e93e", production: "f4d6e10e-9956-448d-af78-b807bd5a376e" },
  scope: "openid offline_access reading_session",
};
QF.clientId = QF.clientIds[QF.env];
QF.authBase = QF.env === "production" ? "https://oauth2.quran.foundation" : "https://prelive-oauth2.quran.foundation";
QF.apiBase = QF.env === "production" ? "https://apis.quran.foundation" : "https://apis-prelive.quran.foundation";

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

// The sign-in comes back to this very page (folder URL, trailing slash).
const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomString = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

function message(text) {
  $("msg").textContent = text || "";
  $("msg").hidden = !text;
}

async function signIn() {
  const verifier = randomString(48);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = randomString(16);
  const nonce = randomString(16);
  // localStorage, not sessionStorage: on some phones the sign-in returns in a fresh browsing context.
  store.set("pkce", { verifier, state, nonce, env: QF.env });
  location.href = `${QF.authBase}/oauth2/auth?` + new URLSearchParams({
    response_type: "code", client_id: QF.clientId, redirect_uri: redirectUri(), scope: QF.scope,
    state, nonce, code_challenge: challenge, code_challenge_method: "S256",
  });
}

async function tokenRequest(params) {
  const res = await fetch(`${QF.authBase}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: QF.clientId, ...params }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error_description || body.error || String(res.status)), { code: body.error, status: res.status });
  return body;
}

function saveTokens(t) {
  store.set("tokens", { access: t.access_token, refresh: t.refresh_token, expiresAt: Date.now() + (t.expires_in || 3600) * 1000, env: QF.env });
}

// Finishes the sign-in when Quran.com sends us back with ?code=...
async function finishSignIn() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return;
  const saved = store.get("pkce");
  history.replaceState(null, "", location.pathname); // never leave the code in the address bar
  store.del("pkce");
  if (q.get("error")) throw new Error(q.get("error_description") || q.get("error"));
  if (!saved || saved.state !== q.get("state")) throw new Error("Sign-in could not be verified. Please try again.");
  saveTokens(await tokenRequest({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirectUri(), code_verifier: saved.verifier }));
}

const tokens = () => { const t = store.get("tokens"); return t && t.env === QF.env ? t : null; };

async function accessToken() {
  const t = tokens();
  if (!t) return null;
  if (t.expiresAt - 60000 > Date.now()) return t.access;
  try {
    saveTokens(await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh }));
  } catch (err) {
    if (err.code === "invalid_grant") store.del("tokens");
    throw err;
  }
  return tokens().access;
}

async function latestVerse(retried) {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(`${QF.apiBase}/auth/v1/reading-sessions?first=1`, { headers: { "x-auth-token": token, "x-client-id": QF.clientId } });
  const body = await res.json().catch(() => ({}));
  if (!retried && (res.status === 401 || res.status === 403 || body.type === "invalid_token")) {
    const t = tokens();
    if (t) { t.expiresAt = 0; store.set("tokens", t); }
    return latestVerse(true);
  }
  if (!res.ok) throw Object.assign(new Error(body.message || String(res.status)), { status: res.status });
  const s = body.data && body.data[0];
  return s && s.chapterNumber && s.verseNumber ? `${s.chapterNumber}:${s.verseNumber}` : "";
}

function show(signedIn) {
  $("signed-out").hidden = signedIn;
  $("signed-in").hidden = !signedIn;
}

async function start() {
  $("signin").addEventListener("click", signIn);
  $("signout").addEventListener("click", () => { store.del("tokens"); show(false); message(""); });
  $("auto").checked = !!store.get("auto");
  $("auto").addEventListener("change", () => store.set("auto", $("auto").checked));

  try {
    await finishSignIn();
  } catch (err) {
    message(err.message);
  }
  if (!tokens()) return show(false);
  show(true);
  try {
    const key = await latestVerse();
    const m = /^(\d{1,3}):(\d{1,3})$/.exec(key || "");
    if (!m) { $("verse").textContent = "Nothing yet"; $("verse-sub").textContent = "Read on quran.com while signed in and your place shows here."; return; }
    $("verse").textContent = key;
    $("verse-sub").textContent = `Surah ${SURAH_NAMES[Number(m[1]) - 1]}, verse ${m[2]}`;
    $("go").href = urlForVerse(key);
    // Only jump on a fresh open, not when you come back here from quran.com.
    if ($("auto").checked && !/^https:\/\/quran\.com\//.test(document.referrer)) location.replace(urlForVerse(key));
  } catch (err) {
    if (!tokens()) return show(false);
    message(err.status ? `Quran.com error ${err.status}.` : "Can't reach Quran.com. Check your connection.");
  }
}

start();
