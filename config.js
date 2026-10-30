// Quran Foundation OAuth settings. The client is a public one (Authorization
// Code + PKCE, no secret), so nothing here is confidential.
//
// 1. In the Quran Foundation Developer Console create a "Frontend or mobile app".
// 2. Register this exact redirect URI (it is fixed by the "key" in manifest.json):
//      https://hgcgipbcmganempbllnbfmefckmipgoc.chromiumapp.org/
// 3. Paste the client id below. Use "prelive" while testing, "production" when live.
const QF = {
  clientId: "fcc4aa0c-ead8-42b4-a1c2-fea66199e93e", // prelive; production has its own id,
  env: "prelive", // "prelive" | "production"
  // Request exactly the scopes your client was approved for.
  scope: "openid offline_access reading_session",
};
QF.authBase = QF.env === "production" ? "https://oauth2.quran.foundation" : "https://prelive-oauth2.quran.foundation";
QF.apiBase = QF.env === "production" ? "https://apis.quran.foundation" : "https://apis-prelive.quran.foundation";
