// Quran Foundation OAuth settings. The client is a public one (Authorization
// Code + PKCE, no secret), so nothing here is confidential.
//
// App: "Quran Resume Account" in the Quran Foundation Developer Console. Its redirect
// URI is fixed by the "key" in manifest.json:
//   https://hgcgipbcmganempbllnbfmefckmipgoc.chromiumapp.org/
// Use "prelive" while testing and "production" once the permissions are approved.
const QF = {
  env: "prelive", // "prelive" | "production"
  // Each environment has its own client id (public, not a secret).
  clientIds: {
    prelive: "fcc4aa0c-ead8-42b4-a1c2-fea66199e93e",
    production: "f4d6e10e-9956-448d-af78-b807bd5a376e",
  },
  // Request exactly the scopes your client was approved for.
  scope: "openid offline_access reading_session",
};
QF.clientId = QF.clientIds[QF.env];
QF.authBase = QF.env === "production" ? "https://oauth2.quran.foundation" : "https://prelive-oauth2.quran.foundation";
QF.apiBase = QF.env === "production" ? "https://apis.quran.foundation" : "https://apis-prelive.quran.foundation";
