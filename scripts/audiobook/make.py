"""Record the audiobook: content/audiobook/script.json → app/audio/xugua.mp3 + app/data/audiobook.json.

  ~/.cache/sbt-tts/env/bin/python scripts/audiobook/make.py           synthesize what's new, then build
  ~/.cache/sbt-tts/env/bin/python scripts/audiobook/make.py tts       only synthesize
  ~/.cache/sbt-tts/env/bin/python scripts/audiobook/make.py build     only assemble the MP3 and manifest
  ~/.cache/sbt-tts/env/bin/python scripts/audiobook/make.py voices    check the voice exists in your region

Run `npm run build` first (it writes script.json) and again afterwards (it restamps the service worker).
Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env (gitignored). Clips are cached by their SSML under
~/.cache/yijing-tts/, outside Google Drive, so editing one sentence re-synthesizes only that sentence.
"""
import hashlib, json, os, re, sys, time
from pathlib import Path

import numpy as np, requests, soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'content' / 'audiobook' / 'script.json'
MP3 = ROOT / 'app' / 'audio' / 'xugua.mp3'
MANIFEST = ROOT / 'app' / 'data' / 'audiobook.json'
CACHE = Path.home() / '.cache' / 'yijing-tts'
VOICE, RATE, KBPS, SR = 'zh-CN-YunyiMultilingualNeural', '-5%', 32, 24000
CHAPTER_GAP = 2.0  # seconds of silence between chapters


def env():
    for line in (ROOT / '.env').read_text().splitlines() if (ROOT / '.env').exists() else []:
        m = re.match(r'\s*([A-Z_]+)\s*=\s*(.*?)\s*$', line)
        if m: os.environ.setdefault(m[1], m[2].strip('"\''))
    key = os.environ.get('AZURE_SPEECH_KEY')
    if not key:
        sys.exit('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env')
    return key, os.environ.get('AZURE_SPEECH_REGION', 'eastus')


def doc(ssml):
    return ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            'xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">'
            f'<voice name="{VOICE}"><prosody rate="{RATE}"><lang xml:lang="zh-CN">{ssml}</lang></prosody></voice></speak>')


def clip_path(ssml):
    return CACHE / f'{hashlib.sha1(doc(ssml).encode()).hexdigest()[:16]}.wav'


def check_voice():
    key, region = env()
    r = requests.get(f'https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list',
                     headers={'Ocp-Apim-Subscription-Key': key}, timeout=30)
    r.raise_for_status()
    v = next((x for x in r.json() if x['ShortName'] == VOICE), None)
    print(f'✓ {VOICE} in {region}' if v else f'✗ {VOICE} is not offered in {region}')


def synth(cues):
    todo = list({c['ssml']: c for c in cues if not clip_path(c['ssml']).exists()}.values())
    print(f'Azure: {len(cues)} clips, {len(todo)} to synthesize, ~{sum(len(c["text"]) for c in todo)} characters', flush=True)
    if not todo:
        return
    key, region = env()
    CACHE.mkdir(parents=True, exist_ok=True)
    url = f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1'
    hdr = {'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
           'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'User-Agent': 'yijing-audiobook'}
    for i, c in enumerate(todo, 1):
        for wait in (0, 10, 20, 40, 60, 90):  # the free tier allows about 20 requests a minute
            time.sleep(wait or 3)
            try:
                r = requests.post(url, headers=hdr, data=doc(c['ssml']).encode('utf-8'), timeout=60)
            except requests.RequestException as e:
                print(f'  retry after {e.__class__.__name__}', flush=True)
                continue
            if r.status_code not in (429, 500, 502, 503, 504):
                break
        if r.status_code != 200:
            sys.exit(f'Azure error {r.status_code}: {r.text[:300]}\n{c["ssml"][:300]}')
        clip_path(c['ssml']).write_bytes(r.content)
        print(f'[{i}/{len(todo)}] {c["text"][:40]}', flush=True)


def level(a, target_db=-20.0, peak=0.89):
    """Even out loudness: RMS of the voiced frames → target, without clipping."""
    f = int(SR * 0.02)
    m = len(a) // f
    if m == 0:
        return a
    e = np.sqrt((a[:m * f].reshape(m, f) ** 2).mean(1))
    voiced = e[e > e.max() * 10 ** (-30 / 20)]
    g = 10 ** (target_db / 20) / (np.sqrt((voiced ** 2).mean()) + 1e-9)
    return (a * min(g, peak / (np.abs(a).max() + 1e-9))).astype(np.float32)


def trim(a, floor_db=-45):
    """Cut leading and trailing silence (Azure pads every clip), keeping 50 ms on each side."""
    loud = np.flatnonzero(np.abs(a) > np.abs(a).max() * 10 ** (floor_db / 20))
    if len(loud) == 0:
        return a
    pad = int(0.05 * SR)
    return a[max(0, loud[0] - pad):loud[-1] + pad]


def build(script, script_hash):
    import lameenc
    pieces, t, chapters = [], 0.0, []
    for ch in script['chapters']:
        start, cues = t, []
        for c in ch['cues']:
            a, sr = sf.read(clip_path(c['ssml']), dtype='float32')
            assert sr == SR, f'unexpected sample rate {sr}'
            a = level(trim(a))
            cue = dict(role=c['role'], text=c['text'], start=round(t, 2), end=round(t + len(a) / SR, 2))
            if c.get('en'): cue['en'] = c['en']
            cues.append(cue)
            gap = np.zeros(int(c['pause'] * SR), np.float32)
            pieces += [a, gap]
            t += (len(a) + len(gap)) / SR
        pieces.append(np.zeros(int(CHAPTER_GAP * SR), np.float32))
        t += CHAPTER_GAP
        chapters.append(dict(n=ch['n'], start=round(start, 2), end=round(t, 2), cues=cues))
    audio = np.concatenate(pieces)
    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    MP3.parent.mkdir(parents=True, exist_ok=True)
    MP3.write_bytes(enc.encode((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes()) + enc.flush())
    manifest = dict(script=script_hash, titleZh=script['titleZh'], titleEn=script['titleEn'],
                    introEn=script['introEn'], outroEn=script['outroEn'],
                    audio=f'audio/{MP3.name}?v={script_hash}', duration=round(len(audio) / SR, 2),
                    bytes=MP3.stat().st_size, voice=VOICE, chapters=chapters)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
    print(f'✓ {MP3.relative_to(ROOT)}  {len(audio) / SR / 60:.1f} min, {MP3.stat().st_size / 1e6:.1f} MB')
    print(f'✓ {MANIFEST.relative_to(ROOT)}  {len(chapters)} chapters (script {script_hash})')


def main():
    step = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if step == 'voices':
        return check_voice()
    raw = SCRIPT.read_bytes()
    script = json.loads(raw)
    cues = [c for ch in script['chapters'] for c in ch['cues']]
    if step in ('tts', 'all'): synth(cues)
    if step in ('build', 'all'): build(script, hashlib.sha256(raw).hexdigest()[:10])


if __name__ == '__main__':
    main()
