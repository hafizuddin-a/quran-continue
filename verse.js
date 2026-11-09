// Shared by the background worker and the toolbar menu.

const DEFAULT_URL = "https://quran.com/1";

// verseKey looks like "2:255"; anything else gives the start of the Quran.
function urlForVerse(verseKey) {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(verseKey || "");
  if (!match) return DEFAULT_URL;
  // ?startingVerse= opens the whole surah positioned at that verse
  // (plain /2/9 opens a single-verse view instead).
  return `https://quran.com/${match[1]}?startingVerse=${match[2]}`;
}

// True when verse key `a` is in the same surah as `b` but earlier in it ("3:13" is earlier than "3:23").
function isEarlierInSameSurah(a, b) {
  const [sa, va] = String(a).split(":").map(Number);
  const [sb, vb] = String(b).split(":").map(Number);
  return sa === sb && va < vb;
}
