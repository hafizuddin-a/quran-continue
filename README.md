# Quran Resume (Account)

Same as Quran Resume: reopens quran.com in a pinned tab at the verse where you
last stopped (browser start, once a day after wake, Alt/Option+Shift+Q), and
syncs between computers with Chrome sync (only while you are signed out).

The difference: no phone server. Sign in with your Quran.com account and your
place is stored as a Quran.com *reading session*, the same "continue reading"
place quran.com and its apps use.

## Setup

1. In the [Quran Foundation Developer Console](https://dev-console.quran.foundation/projects/new)
   create a **Frontend or mobile app** (public client, PKCE, no secret).
2. Register this exact redirect URI (fixed by the `key` in `manifest.json`):
   `https://hgcgipbcmganempbllnbfmefckmipgoc.chromiumapp.org/`
3. Put the client id in `config.js` (`env: "prelive"` to test, `"production"` live).
   Request only scopes your client is approved for (`reading_session`).
4. `chrome://extensions` > Developer mode > Load unpacked > this folder.

## Files

- `qf.js` sign-in (Authorization Code + PKCE), token refresh, reading-session calls
- `background.js` startup/wake/shortcut, Chrome sync, account sync (newest wins)
- `content.js` records the verse nearest the top of quran.com
- `key.pem` private key behind the fixed extension id. Git-ignored; keep a backup.
