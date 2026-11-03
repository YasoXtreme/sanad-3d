// Checks that the STL files in models/ still match the numbers in src/layout.js.
// Run it after replacing the STLs or changing PARAMS:  node tools/check-layout.mjs
import { readFileSync } from 'node:fs';
import { computeLayout } from '../src/layout.js';

const L = computeLayout();
const p = L.p;

function bbox(file) {
  const buf = readFileSync(new URL(`../models/${file}`, import.meta.url));
  const n = buf.readUInt32LE(80);
  if (84 + n * 50 !== buf.length) throw new Error(`${file}: not a binary STL`);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < 3; v++) {
      for (let k = 0; k < 3; k++) {
        const x = buf.readFloatLE(84 + i * 50 + 12 + v * 12 + k * 4);
        if (x < lo[k]) lo[k] = x;
        if (x > hi[k]) hi[k] = x;
      }
    }
  }
  return hi.map((h, k) => h - lo[k]);
}

// sizes in print orientation (x, y, z), as the CAD layout predicts them
const expected = {
  'sanad-body.stl': [2 * L.ear_x1, L.Y_out, L.H],
  'sanad-sensor-pad.stl': [L.bump_x1 - L.bump_x0, L.bump_y1 - L.bump_y0, p.boss_h + p.floor + 1.2],
  'sanad-tray.stl': [L.X_in - 0.5, L.Y_in - 0.5, p.tray_t + 2.2],
  'sanad-lid.stl': [2 * L.ear_x1, L.Y_out, L.H_total - (L.tray_z1 + p.sw_H + 0.2)],
};

let ok = true;
for (const [file, want] of Object.entries(expected)) {
  const got = bbox(file);
  const bad = got.some((g, k) => Math.abs(g - want[k]) > 0.01);
  ok &&= !bad;
  const f = (a) => a.map((v) => v.toFixed(2)).join(' × ');
  console.log(`${bad ? 'MISMATCH' : 'ok      '} ${file.padEnd(22)} STL ${f(got)}  layout ${f(want)}`);
}
console.log(ok ? '\nAll four parts match the layout.' : '\nSome parts differ: update PARAMS in src/layout.js.');
process.exit(ok ? 0 : 1);
