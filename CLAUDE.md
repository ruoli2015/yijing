# Notes for Claude

- The user is learning the 64 hexagrams and the 序卦傳 order. Chinese is traditional characters only, and every explanation is bilingual (`*_zh` and `*_en`).
- Modern explanations build on 程頤《伊川易傳》 and 朱熹《周易本義》; other interpretations may be synthesized where they make better sense.
- Never type classical text from memory. It comes from `content/sources/wikisource/` through `scripts/extract-classics.mjs`; corrections go in that script's `FIXES` / `VARIANT_CHOICE` tables, each with its reason.
- Authored content lives in `content/hexagrams/*.yaml` and `content/order.yaml`.
- `npm run build && npm test` must pass. `app/data/yijing.json` and `app/sw.js` are generated; commit them along with the content.
- The folder lives in Google Drive, so do not add heavy dependencies. Vendor browser libraries into `app/vendor/`.
- Deploys happen automatically on push to `main` (GitHub Actions → Pages): https://ruoli2015.github.io/yijing/
