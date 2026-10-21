# 周易六十四卦 · Plan

A web app for getting familiar with the 64 hexagrams and the logic of their order, based on 序卦傳.
Hosted on GitHub Pages, installable on iPhone, Android and desktop.

## Decisions

| Question | Decision |
|---|---|
| Interface language | Traditional Chinese with English; English can be hidden in Settings |
| Characters | Traditional only (typed answers in simplified are accepted and converted) |
| Modern explanations | Bilingual (中文 + English), based on 程頤《伊川易傳》 and 朱熹《周易本義》, with other readings worked in where they make better sense |
| Repo | Public: `ruoli2015/yijing`; the folder stays in Google Drive |
| Extras | No 文言傳, no 雜卦傳 view, no yarrow-stalk divination |

## Architecture

- **Static site with no framework build step.** Plain ES modules plus a vendored Preact/htm bundle (`app/vendor/preact.js`), so `node_modules` holds only two small build tools (`yaml` and `opencc-js`). This keeps the Google Drive folder light.
- **Offline PWA.** A service worker precaches the whole app, and `manifest.webmanifest` lets it be added to the home screen.
- **Hash routes** (`#/h/24`) work on GitHub Pages without server rewrites, and every hexagram has a shareable link.
- **Progress lives in `localStorage`**, with export/import as a JSON file. There are no accounts.
- **Deploy:** GitHub Actions runs the build and tests on every push to `main`, then publishes `app/` to Pages.

## Data pipeline

1. `scripts/fetch-sources.mjs` downloads the 64 hexagram pages and 序卦傳 from Chinese Wikisource into `content/sources/wikisource/`. These are committed, so builds never depend on the network.
2. `scripts/extract-classics.mjs` parses them into `content/classics.json`:
   - 卦辭, 爻辭, 彖傳, 大象, 小象 and the 63 序卦 sentences;
   - Wikisource's `{{另|…}}` variant readings resolved to the received text (王弼本/朱熹本), each choice documented;
   - simplified-character slips fixed (願, 醜, 覿, 雲, 塗, 甕, 繫…).
3. `content/hexagrams/*.yaml` holds the authored content for each hexagram:
   - pinyin and English name;
   - a one-line gist (中/英);
   - an English translation of its 序卦 sentence;
   - the kind of link from the previous hexagram (承 consequence / 反 reversal / 補 remedy / 始 beginning);
   - the modern explanation (中/英).
4. `content/order.yaml` holds the essays, the 17 stages of the sequence, and 朱熹's 卦名次序歌.
5. `scripts/build.mjs` checks everything and writes `app/data/yijing.json`:
   - line patterns cross-checked against an independent King Wen table;
   - the 非覆即變 pair rule;
   - every 序卦 sentence names its hexagram;
   - the stages cover 1–64;
   - the rhyme names all 64 in order.

## Features

1. **認卦 Identify.** Shows a random hexagram figure. You answer its name, number, and the previous and next hexagrams. Two modes: multiple choice (distractors are neighbors, pair partners and hexagrams sharing a trigram) or typed (name, full name like 水雷屯, or pinyin; simplified OK).
2. **畫卦 Draw.** Shows a name. You tap six lines bottom-up to draw the hexagram and give its number. Mistakes are highlighted next to the correct figure.
3. **Answer card.** After every question it shows the hexagram, its neighbors, and the 序卦 sentences leading in and out, each with an English translation and the modern explanation.
4. **Spaced repetition.** Leitner boxes per hexagram for each quiz; weak items come back more often. Quizzes can be limited to a range: all, 上經, 下經, 1–16 … 49–64, or weak items only.
5. **六十四卦 Browse.**
   - Three views: grid in order (上經/下經), the 32 pairs (覆/變 marked), or an 8×8 upper/lower trigram table.
   - Search by number, name (traditional or simplified), pinyin or English name.
   - **以象尋卦:** tap in the lines you remember and the matches narrow as you go.
6. **Hexagram page.**
   - Figure, number, name, pinyin, full name, English name, trigrams, pair partner (綜/錯).
   - Its stage in the sequence.
   - 序卦 in (with translation and modern explanation) and 序卦 out.
   - 卦辭, 彖傳, 大象傳, and 爻辭 with 小象.
   - Swipe or arrow keys move to the previous/next hexagram.
7. **卦序之理 Order.**
   - Six essays: what 序卦傳 is; the two canons (18 shapes each); 非覆即變; the three kinds of link; the "物不可以終…" rhythm; memorization tips.
   - 朱熹's rhyme.
   - The whole chain in 17 stages, each link expandable to its translation and modern explanation.
8. **占卦 Divination.**
   - Three-coin cast (火珠林: 字 = 2, 背 = 3) with animation and `crypto` randomness.
   - Shows 本卦 → 之卦 with the changing lines marked.
   - Highlights which texts to read, following 朱熹《易學啟蒙·考變占》 (0–6 changing lines, 用九/用六).
   - A journal with notes, saved on the device.
9. **聽卦序 Audiobook.**
   - One chapter per hexagram: 「第三卦，水雷屯。」 → its own 序卦傳 sentence (how it follows 坤) → its modern reading; the next chapter opens with the next name.
   - A second recording reads only the 64 headings (「第一卦，乾為天。第二卦，坤為地。…」, about 3 minutes); the page switches between the two and remembers the place in each. The names-only version also comes with 0.5, 1, 2 or 3 s of silence after each 「第N卦」 and each name (separate recordings, so pauses survive a locked screen).
   - Script generated from the content (`scripts/audiobook/script.mjs`), recorded with Azure Yunyi (`scripts/audiobook/make.py`) into one MP3 plus a timing manifest.
   - Transcript highlights the sentence being read; tap a sentence to jump there. Chapter grid, ±15 s, speed, repeat (loops either version until turned off), 區間循環 range loop between any two hexagrams, download for offline listening (cache `yj-audio`, served with byte ranges by `sw.js`), lock-screen controls (Media Session), resume where you stopped, mini player on other pages.
   - The MP3 is not precached (about 10 MB); it streams.
10. **進度 Progress.** Mastery grid for each quiz, accuracy, the English on/off setting, and backup export/import/reset.

## Status (2026-10-01)

All of the above is built and tested: 17 unit tests, plus a browser walkthrough at phone size in light and dark mode.

## Possible next steps

- English translations of 卦辭, 爻辭, 彖 and 象 (Legge's 1882 translation is in the public domain).
- A "sequence chain" drill: given a hexagram, keep naming the next one.
- Syncing progress across devices (would need an account backend such as Supabase, as in the Sanskrit app).
