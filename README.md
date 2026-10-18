# 周易六十四卦 · The 64 Hexagrams

A web app for learning the 64 hexagrams of the 周易 and the logic of their order (序卦傳).

**Live:** https://ruoli2015.github.io/yijing/

- **認卦 Identify:** see a hexagram, then give its name, number, and the hexagrams before and after it.
- **畫卦 Draw:** see a name, then draw the hexagram line by line and give its number.
- **六十四卦 Browse:** grid, pairs or trigram table. Search by name, pinyin, number, or by tapping in the lines you remember.
- **Hexagram pages:** 序卦傳 in and out with modern bilingual explanations, plus 卦辭, 彖傳, 大象 and 爻辭 with 小象.
- **卦序之理 Logic of the order:** essays, 朱熹's rhyme, and the whole chain in 17 stages.
- **聽卦序 Listen:** an audiobook of all 64 in order: number and name, the 序卦傳 sentence leading to the next, and the modern reading. The transcript follows along, and it keeps playing while you browse or with the screen locked.
- **占卦 Divination:** three-coin cast read by 朱熹's rules, with a journal.
- Works offline (except the audiobook, which streams). Add it to your home screen on iPhone (Safari → Share → Add to Home Screen) or Android (Chrome → Install app).

## Develop

```sh
npm install
npm run build   # validate content, write app/data/yijing.json, stamp app/sw.js
npm test
npm run serve   # http://localhost:8080
```

### Audiobook

`npm run build` writes the script to `content/audiobook/script.json` (and `script.md` to read). It is built from
the 序卦 sentences and modern readings plus `content/audiobook.yaml`, which holds the intro, the outro, and the
pronunciation rules that pin polyphonic readings (屯 zhūn, 否 pǐ, 說 yuè…) with SSML `<phoneme>`. To record:

```sh
# once: .env with AZURE_SPEECH_KEY=… and AZURE_SPEECH_REGION=… (gitignored)
# Python env with numpy soundfile requests lameenc (the one from sanskrit-buddhist-terms works)
~/.cache/sbt-tts/env/bin/python scripts/audiobook/make.py   # → app/audio/xugua.mp3 + app/data/audiobook.json
npm run build && npm test
```

Clips are cached by content in `~/.cache/yijing-tts/`, so after editing one explanation only its sentences are
re-synthesized. The build warns when the recording is older than the script. Voice: Azure `zh-CN-YunyiMultilingualNeural`.

| Path | Contents |
|---|---|
| `content/sources/wikisource/` | raw wikitext from Chinese Wikisource (`scripts/fetch-sources.mjs`) |
| `content/classics.json` | parsed and corrected classical texts (`scripts/extract-classics.mjs`) |
| `content/hexagrams/*.yaml` | English names, gists, 序卦 translations, link types, modern explanations |
| `content/order.yaml` | essays, stages, 卦序歌 |
| `content/audiobook.yaml` | audiobook intro/outro and pronunciation rules; `content/audiobook/` holds the generated script |
| `app/` | the static site deployed to GitHub Pages |

Classical texts: 維基文庫《周易》, checked against the received editions (王弼本 / 朱熹本).
The modern explanations were written for this app and draw on 程頤《伊川易傳》 and 朱熹《周易本義》.
See [PLAN.md](PLAN.md) for the design.
