# 周易六十四卦 · The 64 Hexagrams

A web app for learning the 64 hexagrams of the 周易 and the logic of their order (序卦傳).

**Live:** https://ruoli2015.github.io/yijing/

- **認卦 Identify:** see a hexagram, then give its name, number, and the hexagrams before and after it.
- **畫卦 Draw:** see a name, then draw the hexagram line by line and give its number.
- **六十四卦 Browse:** grid, pairs or trigram table. Search by name, pinyin, number, or by tapping in the lines you remember.
- **Hexagram pages:** 序卦傳 in and out with modern bilingual explanations, plus 卦辭, 彖傳, 大象 and 爻辭 with 小象.
- **卦序之理 Logic of the order:** essays, 朱熹's rhyme, and the whole chain in 17 stages.
- **占卦 Divination:** three-coin cast read by 朱熹's rules, with a journal.
- Works offline. Add it to your home screen on iPhone (Safari → Share → Add to Home Screen) or Android (Chrome → Install app).

## Develop

```sh
npm install
npm run build   # validate content, write app/data/yijing.json, stamp app/sw.js
npm test
npm run serve   # http://localhost:8080
```

| Path | Contents |
|---|---|
| `content/sources/wikisource/` | raw wikitext from Chinese Wikisource (`scripts/fetch-sources.mjs`) |
| `content/classics.json` | parsed and corrected classical texts (`scripts/extract-classics.mjs`) |
| `content/hexagrams/*.yaml` | English names, gists, 序卦 translations, link types, modern explanations |
| `content/order.yaml` | essays, stages, 卦序歌 |
| `app/` | the static site deployed to GitHub Pages |

Classical texts: 維基文庫《周易》, checked against the received editions (王弼本 / 朱熹本).
The modern explanations were written for this app and draw on 程頤《伊川易傳》 and 朱熹《周易本義》.
See [PLAN.md](PLAN.md) for the design.
