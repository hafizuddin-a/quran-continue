// Quran Foundation account: sign-in (Authorization Code + PKCE, public client)
// and the Reading Sessions calls. Loaded by background.js through importScripts.
//
// This replaces the old phone server. quran.com and its mobile apps write the
// same reading session, so signing in is all it takes to share your place.

const QF_TOKENS = "qfTokens"; // { access, refresh, expiresAt }

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomString = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

function qfRedirectUri() {
  return chrome.identity && chrome.identity.getRedirectURL
    ? chrome.identity.getRedirectURL()
    : `https://${chrome.runtime.id}.chromiumapp.org/`;
}

function jwtClaims(token) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))));
  } catch (err) {
    return {};
  }
}

// Runs the browser sign-in window and returns the redirect URL it ended on.
// Some Chromium browsers lack chrome.identity.launchWebAuthFlow; there we open a
// normal tab and watch for the redirect instead.
function runAuthWindow(url, redirect) {
  if (chrome.identity && chrome.identity.launchWebAuthFlow) {
    return chrome.identity.launchWebAuthFlow({ url, interactive: true });
  }
  return new Promise(async (resolve, reject) => {
    const tab = await chrome.tabs.create({ url });
    const done = (fn, value) => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      chrome.tabs.remove(tab.id).catch(() => {});
      fn(value);
    };
    const onUpdated = (id, info, t) => {
      const u = info.url || t.url || "";
      if (id === tab.id && u.startsWith(redirect)) done(resolve, u);
    };
    const onRemoved = (id) => {
      if (id === tab.id) {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
        reject(new Error("Sign-in was cancelled."));
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

async function tokenRequest(params) {
  const res = await fetch(`${QF.authBase}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: QF.clientId, ...params }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error_description || body.error || String(res.status)), { status: res.status, code: body.error });
  return body;
}

async function saveTokens(t) {
  await chrome.storage.local.set({
    [QF_TOKENS]: { access: t.access_token, refresh: t.refresh_token, expiresAt: Date.now() + (t.expires_in || 3600) * 1000 },
  });
}

async function qfSignIn() {
  if (!QF.clientId || QF.clientId.startsWith("PASTE")) throw new Error("Add your Quran Foundation client id to config.js first.");
  const verifier = randomString(48);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = randomString(16);
  const nonce = randomString(16);
  const redirect = qfRedirectUri();
  const url = `${QF.authBase}/oauth2/auth?` + new URLSearchParams({
    response_type: "code", client_id: QF.clientId, redirect_uri: redirect, scope: QF.scope,
    state, nonce, code_challenge: challenge, code_challenge_method: "S256",
  });
  const back = new URL(await runAuthWindow(url, redirect));
  if (back.searchParams.get("error")) throw new Error(back.searchParams.get("error_description") || back.searchParams.get("error"));
  if (back.searchParams.get("state") !== state) throw new Error("Sign-in failed (state mismatch).");
  const t = await tokenRequest({
    grant_type: "authorization_code", code: back.searchParams.get("code"), redirect_uri: redirect, code_verifier: verifier,
  });
  const claims = t.id_token ? jwtClaims(t.id_token) : {};
  if (claims.nonce && claims.nonce !== nonce) throw new Error("Sign-in failed (nonce mismatch).");
  await saveTokens(t);
  const name = [claims.first_name, claims.last_name].filter(Boolean).join(" ") || claims.email || "your account";
  await chrome.storage.local.set({ qfUser: name });
  return name;
}

let refreshing = null;
async function refreshAccess() {
  refreshing ||= (async () => {
    const { [QF_TOKENS]: tokens } = await chrome.storage.local.get(QF_TOKENS);
    if (!tokens || !tokens.refresh) throw Object.assign(new Error("Signed out"), { status: 401 });
    try {
      await saveTokens(await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh }));
    } catch (err) {
      if (err.code === "invalid_grant" || err.code === "invalid_client") await qfClear(); // the session was ended elsewhere
      throw err;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function accessToken() {
  const { [QF_TOKENS]: tokens } = await chrome.storage.local.get(QF_TOKENS);
  if (!tokens) return null;
  if (tokens.expiresAt - 60000 > Date.now()) return tokens.access;
  await refreshAccess();
  return (await chrome.storage.local.get(QF_TOKENS))[QF_TOKENS].access;
}

async function qfSignedIn() {
  return !!(await chrome.storage.local.get(QF_TOKENS))[QF_TOKENS];
}

async function qfClear() {
  await chrome.storage.local.remove([QF_TOKENS, "qfUser", "qfLastPushed", "qfLastSync", "qfError"]);
}

async function qfSignOut() {
  const { [QF_TOKENS]: tokens } = await chrome.storage.local.get(QF_TOKENS);
  if (tokens && tokens.refresh) {
    // Best effort: tell Quran Foundation to forget the refresh token.
    fetch(`${QF.authBase}/oauth2/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: QF.clientId, token: tokens.refresh, token_type_hint: "refresh_token" }).toString(),
    }).catch(() => {});
  }
  await qfClear();
}

// Calls a User API endpoint. Refreshes the token once on 401. Also learns how far
// this computer's clock is from Quran Foundation's, so "newest wins" is fair.
async function qfApi(path, init = {}, retried = false) {
  const token = await accessToken();
  if (!token) throw Object.assign(new Error("Signed out"), { status: 401 });
  const res = await fetch(`${QF.apiBase}/auth${path}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", "x-auth-token": token, "x-client-id": QF.clientId },
  });
  const date = Date.parse(res.headers.get("date") || "");
  if (date) await chrome.storage.local.set({ qfSkew: date - Date.now() });
  const body = await res.json().catch(() => ({}));
  // An expired token comes back as 401, 403 or 400 invalid_token depending on the gateway: refresh once and retry.
  if (!retried && (res.status === 401 || res.status === 403 || body.type === "invalid_token")) {
    await refreshAccess();
    return qfApi(path, init, true);
  }
  if (!res.ok) throw Object.assign(new Error(body.message || String(res.status)), { status: res.status });
  return body;
}

const qfPushPlace = (verseKey) => {
  const [chapterNumber, verseNumber] = verseKey.split(":").map(Number);
  return qfApi("/v1/reading-sessions", { method: "POST", body: JSON.stringify({ chapterNumber, verseNumber }) });
};

// The most recent place on the account, or null.
async function qfLatestPlace() {
  const out = await qfApi("/v1/reading-sessions?first=1");
  const s = out.data && out.data[0];
  if (!s || !s.chapterNumber || !s.verseNumber) return null;
  const { qfSkew = 0 } = await chrome.storage.local.get("qfSkew");
  return { verseKey: `${s.chapterNumber}:${s.verseNumber}`, savedAt: Date.parse(s.updatedAt) - qfSkew };
}
