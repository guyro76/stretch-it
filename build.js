// Build step: copy the app into public/ and draw the home-screen icons as PNG (pure Node, no dependencies)
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const out = path.join(__dirname, 'public');
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) fs.copyFileSync(path.join(__dirname, f), path.join(out, f));

const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
function png(n, px) { const raw = Buffer.alloc(n * (n * 3 + 1)); for (let y = 0; y < n; y++) { raw[y * (n * 3 + 1)] = 0; px.copy(raw, y * (n * 3 + 1) + 1, y * n * 3, (y + 1) * n * 3); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(n, 0); ih.writeUInt32BE(n, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cov = d => Math.max(0, Math.min(1, 0.5 - d)); // signed distance -> coverage
function rrect(x, y, x0, y0, x1, y1, r) { const cx = Math.max(x0 + r, Math.min(x, x1 - r)), cy = Math.max(y0 + r, Math.min(y, y1 - r)); return Math.hypot(x - cx, y - cy) - r; }
// design in a 1024 grid
function shade(X, Y, s) {
  const x = X / s, y = Y / s;
  let c = [8, 10, 20];
  const glow = (gx, gy, r, col, a) => { const d = Math.hypot(x - gx, y - gy) / r; if (d < 1) c = mix(c, col, a * (1 - d) * (1 - d)); };
  glow(880, 120, 650, [255, 204, 0], .55); glow(120, 900, 650, [255, 59, 48], .5); glow(560, 560, 420, [10, 132, 255], .35);
  const put = (d, col) => { const k = cov(d * s); if (k > 0) c = mix(c, col, k); };
  put(rrect(x, y, 150, 640, 870, 676, 18), [242, 242, 247]);              // ledge
  put(rrect(x, y, 395, 600, 455, 640, 0), [140, 145, 165]);              // piston rod
  { const d = rrect(x, y, 330, 560, 520, 600, 20); if (d < 30 && d > 0) c = mix(c, [255, 204, 0], .35 * (1 - d / 30)); put(d, [255, 204, 0]); } // piston head + glow
  put(rrect(x, y, 600, 630, 720, 682, 20), [255, 59, 48]);               // red trap
  { const d = Math.hypot(x - 730, y - 460) - 40; put(d, [10, 132, 255]); } // blue hub
  { const t = Math.max(0, Math.min(1, ((x - 730) * 70 + (y - 460) * -60) / (70 * 70 + 60 * 60))); const d = Math.hypot(x - (730 + 70 * t), y - (460 - 60 * t)) - 13; put(d, [10, 132, 255]); }
  for (let i = 0; i < 6; i++) { const r = 58 - i * 6, by = 430 + i * 28, d = Math.hypot(x - 425, y - by) - r; if (d < 0) c = mix(c, [180, 220, 255], (70 - i * 10) / 255); }
  { const d = Math.hypot(x - 430, y - 330) - 110; if (d < 0.5) { const f = Math.min(1, Math.hypot(x - 395, y - 290) / 150); const v = 250 - 170 * f; const ball = [v, Math.min(255, v + 4), Math.min(255, v + 14)]; c = mix(c, ball, cov(d * s)); }
    const hd = Math.hypot((x - 395) / 26, (y - 265) / 15) - 1; if (hd < 0) c = mix(c, [255, 255, 255], .9); }
  return c;
}
for (const n of [180, 192, 512]) {
  const s = n / 1024, px = Buffer.alloc(n * n * 3), ss = 2;
  for (let Y = 0; Y < n; Y++) for (let X = 0; X < n; X++) {
    let acc = [0, 0, 0];
    for (let a = 0; a < ss; a++) for (let b = 0; b < ss; b++) { const c = shade(X + (a + .5) / ss, Y + (b + .5) / ss, s); acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; }
    const i = (Y * n + X) * 3; px[i] = Math.min(255, acc[0] / 4); px[i + 1] = Math.min(255, acc[1] / 4); px[i + 2] = Math.min(255, acc[2] / 4);
  }
  fs.writeFileSync(path.join(out, `icon-${n}.png`), png(n, px));
}
console.log('built', fs.readdirSync(out));
