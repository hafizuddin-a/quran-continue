# Privacy Policy

**Quran Resume (Account)** does not collect, sell, or share personal data, and it has no server of its
own. It sends nothing over the network until you sign in with your Quran.com account.

## What the extension stores

- **Your last verse** (for example `2:9`) and the time it was saved, in your browser's local extension
  storage (`chrome.storage.local`) on your own device. If "Sync my place" is on (the default) and you use
  Chrome sync, Chrome also keeps a copy in `chrome.storage.sync`, which Chrome syncs to your other signed-in
  browsers through your Google account. Turn this off in the toolbar menu.
- **Your Quran.com sign-in tokens** (only after you sign in): an access token and a refresh token, kept in
  `chrome.storage.local` on your device. They are used only to call Quran Foundation, and are deleted when you sign
  out.
- The date of the last once-a-day wake prompt, and your on/off settings.

## Quran.com account sync (optional, off until you sign in)

When you choose **Sign in** in the toolbar menu, the extension signs you in through Quran Foundation's
OAuth2 service (oauth2.quran.foundation) and then talks to the Quran Foundation API (apis.quran.foundation).
It asks for permission to read and write your **reading sessions** (your "continue reading" place) and nothing else.

- It sends your last verse (surah and verse number) to your Quran.com account, and reads back the newest
  place on your account, so quran.com on your phone and other computers can pick up where you stopped.
- It never sees your Quran.com password. You enter it on Quran Foundation's own sign-in page.
- Quran Foundation handles that data under its own policies. This extension does not send it anywhere else.
- **Sign out** in the toolbar menu deletes the tokens from your browser and asks Quran Foundation to revoke the
  refresh token. Removing the extension also deletes everything it stored. Your reading sessions on Quran.com stay
  on your account, and you can manage them there.

## What the extension accesses

- **quran.com pages:** a content script reads which verse is near the top of the screen so it can remember your
  place. It does not read your account, notes, bookmarks, or anything else on the page.
- **Unlock and sleep detection:** it notices when the screen is unlocked or the computer wakes, so it can bring the
  Quran tab forward once a day. Nothing is sent anywhere.
- **Browser tabs:** on startup it looks for an open quran.com tab and opens or focuses one. It does not read or record
  any other tab.
- **Sign-in window:** the `identity` permission opens the Quran Foundation sign-in page.

## What the extension does not do

- No analytics, tracking, advertising, or telemetry, and no remote code.
- No network requests unless you are signed in.

## Contact

Questions: open an issue at https://github.com/hafizuddin-a/quran-resume-account/issues
