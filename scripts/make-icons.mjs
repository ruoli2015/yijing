#!/usr/bin/env node
// Render the app icons (䷊ 泰 in paper white on seal vermilion) as PNGs, with no image libraries.
//   node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'icons');
const BG = [168, 50, 30];
const FG = [244, 239, 228];
const LINES = '111000'; // 泰, bottom → top

function roundRectHit(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function shapes(scale) {
  const fw = 0.58 * scale;
  const t = 0.072 * scale;
  const g = 0.046 * scale;
  const h = 6 * t + 5 * g;
  const x0 = 0.5 - fw / 2;
  const y0 = 0.5 - h / 2;
  const bars = [];
  for (let i = 5; i >= 0; i--) {
    const y = y0 + (5 - i) * (t + g);
    if (LINES[i] === '1') bars.push([x0, y, x0 + fw, y + t]);
    else {
      const half = fw * 0.41;
      bars.push([x0, y, x0 + half, y + t], [x0 + fw - half, y, x0 + fw, y + t]);
    }
  }
  return { bars, r: t * 0.18 };
}

function render(size, { rounded, scale }) {
  const { bars, r } = shapes(scale);
  const px = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let qx = 0; qx < size; qx++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (qx + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const inBg = rounded ? roundRectHit(x, y, 0, 0, 1, 1, 0.22) : true;
          if (!inBg) continue;
          bg++;
          if (bars.some(([a, b, c, d]) => roundRectHit(x, y, a, b, c, d, r))) fg++;
        }
      }
      const n = SS * SS;
      const alpha = bg / n;
      const mix = bg ? fg / bg : 0;
      const o = (py * size + qx) * 4;
      for (let k = 0; k < 3; k++) px[o + k] = Math.round(BG[k] * (1 - mix) + FG[k] * mix);
      px[o + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS = [
  ['icon-192.png', 192, { rounded: true, scale: 1 }],
  ['icon-512.png', 512, { rounded: true, scale: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, scale: 0.78 }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.92 }],
];
for (const [name, size, opts] of ICONS) {
  writeFileSync(join(OUT, name), png(size, render(size, opts)));
  console.log('✓', name);
}
