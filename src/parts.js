// Builds every object in the scene.
// Printed parts come from the real STL files; electronics and tools are
// simple stand-ins placed with the CAD layout (see layout.js).
//
// Each object is a pair of groups: `g` sits at the object's pivot, and
// `inner` is shifted back by the pivot, so meshes are added in absolute CAD
// coordinates. Animating `g` (offset + rotation about the pivot) moves the
// whole part.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { picoPinLocal, maxPin, mpuPin, tpPad, MAX_PINS, MPU_PINS } from './layout.js';

export const COLOR = {
  body: 0xb7bdc8, pad: 0x2a2a2f, tray: 0xe2c47e, lid: 0xf2f1e9,
  pcbGreen: 0x2f8c53, pcbGreenMax: 0x2a8048, pcbBlue: 0x2e6dc8,
  metal: 0xc5c9ce, steel: 0x8e959d, black: 0x1f1f23, dark: 0x34343a, gold: 0xd2a43a,
  battery: 0xcdd1d7, kapton: 0xe09a2e, foam: 0xf4f3ee, glue: 0xf3f6f0,
  strap: 0x2c2e33, clay: 0xd9cfc3, accent: 0xfb923c, white: 0xf5f5f2,
};

export const WIRE = {
  red: 0xd62728, black: 0x2a2a2e, yellow: 0xe6a800, blue: 0x1f77b4,
  green: 0x2ca02c, grey: 0x8c8c8c,
};

const DEG = Math.PI / 180;
const ZERO = [0, 0, 0];

// ---------------------------------------------------------------------------
// geometry helpers (all in CAD coordinates: X across, Y along, Z up)

function boxGeo(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
function rboxGeo(x0, x1, y0, y1, z0, z1, r, seg = 2) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
function cylZGeo(cx, cy, r, z0, z1, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(cx, cy, (z0 + z1) / 2);
  return g;
}
function cylYGeo(cx, cz, r, y0, y1, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg);
  g.translate(cx, (y0 + y1) / 2, cz);
  return g;
}
function cylXGeo(cy, cz, r, x0, x1, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg);
  g.rotateZ(Math.PI / 2);
  g.translate((x0 + x1) / 2, cy, cz);
  return g;
}
function coneGeo(r, h, axis, seg = 24) {
  // tip at the origin, base along +axis
  const g = new THREE.ConeGeometry(r, h, seg);
  g.rotateX(Math.PI); // tip now at -Y
  g.translate(0, h / 2, 0); // tip at origin, base toward +Y
  if (axis === 'z') g.rotateX(Math.PI / 2);
  if (axis === '-y') g.rotateX(Math.PI);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  return g;
}
function tubeGeo(pts, r, seg = 48, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}
class Helix extends THREE.Curve {
  constructor(r, z0, z1, turns) { super(); this.r = r; this.z0 = z0; this.z1 = z1; this.turns = turns; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, Math.sin(a) * this.r, this.z0 + (this.z1 - this.z0) * t);
  }
}

// Canvas texture drawn in millimetres. The canvas top-left is the part's
// (-X, +Y) corner, so x grows to +X and canvas y grows toward -Y.
function canvasTex(wmm, hmm, draw, ppm = 22) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(4, Math.round(wmm * ppm));
  cv.height = Math.max(4, Math.round(hmm * ppm));
  const ctx = cv.getContext('2d');
  ctx.scale(cv.width / wmm, cv.height / hmm);
  draw(ctx, wmm, hmm);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function silk(ctx, text, x, y, size, opts = {}) {
  ctx.save();
  ctx.fillStyle = opts.color || 'rgba(255,255,255,0.92)';
  ctx.font = `${opts.weight || 700} ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function shade(c, k) {
  const col = new THREE.Color(c);
  col.multiplyScalar(k);
  return col.getHex();
}

// ---------------------------------------------------------------------------

export class Parts {
  constructor(L, world) {
    this.L = L;
    this.world = world;
    this.objs = {};
    this.sectionMats = [];
  }

  // Create an object whose pivot is at `pivot` (absolute CAD coordinates).
  obj(id, pivot = ZERO, { parent = null, kind = 'part', section = true, xray = false, initial = {} } = {}) {
    if (this.objs[id]) throw new Error(`object ${id} exists`);
    const g = new THREE.Group();
    g.name = id;
    g.position.set(pivot[0], pivot[1], pivot[2]);
    const inner = new THREE.Group();
    inner.position.set(-pivot[0], -pivot[1], -pivot[2]);
    g.add(inner);
    (parent ? this.objs[parent].inner : this.world).add(g);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x16161b, transparent: true, opacity: 0.5 });
    edgeMat.userData.baseOpacity = 0.5;
    const o = {
      id, g, inner, home: pivot.slice(), kind, section, xray, mats: [edgeMat], edgeMat,
      parentObj: parent ? this.objs[parent] : null,
      initial: { p: [0, 0, 0], r: [0, 0, 0], o: 1, ...initial }, _shown: -1, _effO: 1,
    };
    if (section) this.sectionMats.push(edgeMat);
    this.objs[id] = o;
    return o;
  }

  mat(o, color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.0, ...opts });
    m.userData.baseOpacity = opts.opacity ?? 1;
    if (opts.opacity !== undefined && opts.opacity < 1) m.transparent = true;
    o.mats.push(m);
    if (o.section) this.sectionMats.push(m);
    return m;
  }

  add(o, geo, mat, { edges = true, angle = 40, shadow = true } = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    if (shadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), o.edgeMat));
    o.inner.add(mesh);
    return mesh;
  }

  // A board: box with a textured top, plain sides and bottom.
  board(o, x0, x1, y0, y1, z0, z1, color, topTex) {
    const side = this.mat(o, shade(color, 0.8), { roughness: 0.55 });
    const top = this.mat(o, 0xffffff, { map: topTex, roughness: 0.45 });
    const bot = this.mat(o, shade(color, 0.92), { roughness: 0.6 });
    return this.add(o, boxGeo(x0, x1, y0, y1, z0, z1), [side, side, side, side, top, bot], { angle: 60 });
  }

  // Header pins: top and bottom parts are scaled separately (pose keys pt / pb).
  pins(o, xy, zTop, zBot, mat) {
    const gt = new THREE.BoxGeometry(0.64, 0.64, 1); gt.translate(0, 0, 0.5);
    const gb = new THREE.BoxGeometry(0.64, 0.64, 1); gb.translate(0, 0, -0.5);
    const top = new THREE.InstancedMesh(gt, mat, xy.length);
    const bot = new THREE.InstancedMesh(gb, mat, xy.length);
    const m = new THREE.Matrix4();
    xy.forEach(([x, y], i) => { m.makeTranslation(x, y, 0); top.setMatrixAt(i, m); bot.setMatrixAt(i, m); });
    top.position.z = zTop; bot.position.z = zBot;
    top.castShadow = bot.castShadow = true;
    o.inner.add(top, bot);
    const setLen = (mesh, len) => { mesh.visible = len > 0.02; mesh.scale.z = Math.max(len, 0.001); };
    const prev = o.update;
    o.update = (pose, g) => {
      setLen(top, pose.pt ?? 0); setLen(bot, pose.pb ?? 0);
      if (prev) prev(pose, g);
    };
  }
}

// ---------------------------------------------------------------------------

export function buildParts(L, world, stl) {
  const P = new Parts(L, world);
  const p = L.p;
  const steel = (o) => P.mat(o, COLOR.steel, { metalness: 0.6, roughness: 0.35 });
  const metal = (o) => P.mat(o, COLOR.metal, { metalness: 0.55, roughness: 0.35 });
  const gold = (o) => P.mat(o, COLOR.gold, { metalness: 0.7, roughness: 0.3 });
  const blackM = (o) => P.mat(o, COLOR.black, { roughness: 0.5 });

  // ---------------- printed parts (real STL files) ----------------
  const printed = (id, geo, color, pivot, place, opts = {}) => {
    const o = P.obj(id, pivot, { xray: true });
    const g = toCreasedNormals(geo, 32 * DEG);
    const mat = P.mat(o, color, { roughness: opts.rough ?? 0.72 });
    const mesh = P.add(o, g, mat, { angle: 32 });
    place(mesh);
    return o;
  };
  // body: the STL is already in its worn position
  printed('body', stl.body, COLOR.body, [0, 0, 0], () => {});
  // sensor pad: STL is centred on its bump; put it back under the floor hole
  const padC = [(L.bump_x0 + L.bump_x1) / 2, (L.bump_y0 + L.bump_y1) / 2, -p.boss_h];
  printed('pad', stl.pad, COLOR.pad, padC, (m) => m.position.set(...padC), { rough: 0.5 });
  // tray: centred, bottom at tray_z0
  printed('tray', stl.tray, COLOR.tray, [0, 0, L.tray_z0], (m) => m.position.set(0, 0, L.tray_z0));
  // lid: printed upside down; turn it over (180 deg about X) and lift it to the top
  printed('lid', stl.lid, COLOR.lid, [0, 0, L.H], (m) => { m.rotation.x = Math.PI; m.position.set(0, 0, L.H_total); },
    { rough: 0.8 });

  // ---------------- Raspberry Pi Pico 2 W ----------------
  {
    // built parts-up; the home pose turns it over about its long axis, through the PCB
    const pivot = [L.pico_cx, L.pico_y0, L.pico_mid];
    const o = P.obj('pico', pivot, { initial: { pt: p.hdr_tail, pb: p.hdr_plastic + p.hdr_long, r: [0, 180, 0] } });
    const x0 = L.pico_x0, x1 = L.pico_x1, y0 = L.pico_y0, y1 = L.pico_y1;
    const pinXY = [];
    for (let n = 1; n <= 40; n++) pinXY.push(picoPinLocal(L, n));
    const tex = canvasTex(p.pico_W, p.pico_L, (ctx, W, H) => {
      const X = (x) => x - x0, Y = (y) => y1 - y;
      ctx.fillStyle = hex(COLOR.pcbGreen); ctx.fillRect(0, 0, W, H);
      // antenna keep-out at the far end
      ctx.fillStyle = '#3c9a62'; ctx.fillRect((W - p.pico_ant_w) / 2, 0, p.pico_ant_w, p.pico_ant_l);
      // castellated pins
      for (const [x, y] of pinXY) {
        ctx.fillStyle = '#d9b04a';
        ctx.beginPath(); ctx.arc(X(x), Y(y), 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5b4a1e';
        ctx.beginPath(); ctx.arc(X(x), Y(y), 0.45, 0, Math.PI * 2); ctx.fill();
        const ex = x > L.pico_cx ? W : 0;
        ctx.fillStyle = '#d9b04a'; ctx.beginPath(); ctx.arc(ex, Y(y), 0.8, 0, Math.PI * 2); ctx.fill();
      }
      // mounting holes
      for (const hx of [L.pico_cx - p.pico_hole_dx / 2, L.pico_cx + p.pico_hole_dx / 2]) {
        for (const hy of [y0 + p.pico_hole_from_end, y1 - p.pico_hole_from_end]) {
          ctx.fillStyle = '#d9b04a'; ctx.beginPath(); ctx.arc(X(hx), Y(hy), 1.75, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#202020'; ctx.beginPath(); ctx.arc(X(hx), Y(hy), p.pico_hole_d / 2, 0, Math.PI * 2); ctx.fill();
        }
      }
      silk(ctx, 'Raspberry Pi Pico 2 W', W / 2 - 1.6, H * 0.43, 1.25, { rot: Math.PI / 2 });
      silk(ctx, 'BOOTSEL', X(L.pico_cx + 4.6), Y(y0 + 15.6), 0.8);
      silk(ctx, '1', X(pinXY[0][0]) - 1.7, Y(pinXY[0][1]), 0.9);
      silk(ctx, '20', X(pinXY[19][0]) - 1.9, Y(pinXY[19][1]), 0.9);
      silk(ctx, '40', X(pinXY[39][0]) + 1.9, Y(pinXY[39][1]), 0.9);
      silk(ctx, '21', X(pinXY[20][0]) + 1.9, Y(pinXY[20][1]), 0.9);
      // debug pads
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#d9b04a'; ctx.fillRect(W / 2 - 3 + i * 2.5, 1.0, 1.2, 1.2); }
    });
    P.board(o, x0, x1, y0, y1, L.pico_zb, L.pico_zt, COLOR.pcbGreen, tex);
    const zt = L.pico_zt;
    // micro-USB receptacle: 2.73 mm above the PCB, dipping 0.77 mm past it at the board edge
    const usb = P.add(o, rboxGeo(L.pico_cx - p.pico_usb_w / 2, L.pico_cx + p.pico_usb_w / 2,
      y0 - p.pico_usb_overhang, y0 + 4.0, zt, zt + p.pico_usb_h, 0.5), metal(o));
    usb.name = 'pico-usb';
    P.add(o, rboxGeo(L.pico_cx - p.pico_usb_w / 2, L.pico_cx + p.pico_usb_w / 2,
      y0 - p.pico_usb_overhang, y0, zt - p.pico_usb_sink, zt + p.pico_usb_h, 0.5), metal(o));
    P.add(o, boxGeo(L.pico_cx - 3.2, L.pico_cx + 3.2, y0 - p.pico_usb_overhang - 0.02, y0 - p.pico_usb_overhang + 0.4,
      zt + 0.33, zt + 1.63), blackM(o), { edges: false });
    // RP2350, flash, wireless module can, BOOTSEL button, regulator, LED
    P.add(o, boxGeo(L.pico_cx - 3.5, L.pico_cx + 3.5, y0 + 22, y0 + 29, zt, zt + 0.85), blackM(o));
    P.add(o, boxGeo(L.pico_cx + 1.5, L.pico_cx + 6.5, y0 + 14, y0 + 18.5, zt, zt + 1.2), blackM(o));
    P.add(o, rboxGeo(L.pico_cx - 5.2, L.pico_cx + 5.2, y0 + 32, y0 + 41.5, zt, zt + 1.5, 0.3), metal(o));
    P.add(o, boxGeo(L.pico_cx + 2.9, L.pico_cx + 6.3, y0 + 10.5, y0 + 14.5, zt, zt + 1.3), metal(o));
    P.add(o, cylZGeo(L.pico_cx + 4.6, y0 + 12.5, 1.1, zt + 1.3, zt + 2.1, 16), P.mat(o, COLOR.white));
    P.add(o, boxGeo(L.pico_cx - 2.5, L.pico_cx + 0.5, y0 + 6.5, y0 + 9.5, zt, zt + 1.0), P.mat(o, 0x3a3a3f));
    P.add(o, boxGeo(L.pico_cx + 4.6, L.pico_cx + 5.6, y0 + 4.6, y0 + 5.4, zt, zt + 0.4), P.mat(o, 0x9be29b));
    P.pins(o, pinXY, zt, L.pico_zb, gold(o));
    // plastic header strips (one per row), which stay on
    const s = P.obj('pico_strip', [L.pico_cx, L.pico_y0 + p.pico_L / 2, L.pico_zb], { parent: 'pico' });
    const sm = blackM(s);
    for (const side of [-1, 1]) {
      const x = L.pico_cx + side * p.pico_row_dx / 2;
      P.add(s, boxGeo(x - 1.27, x + 1.27, pinXY[0][1] - 1.27, pinXY[19][1] + 1.27, L.pico_zb - p.hdr_plastic, L.pico_zb), sm);
    }
  }

  // ---------------- MAX30102 (sensor face down, pin row toward the Pico) ----------------
  {
    const bx1 = L.seat_x1, by1 = L.seat_y1, bx0 = bx1 - p.max_W_est, by0 = by1 - p.max_L_est;
    const pivot = [(bx0 + bx1) / 2, (by0 + by1) / 2, L.max_zb];
    const o = P.obj('max', pivot, { initial: { pt: p.stub, pb: 0 } });
    const pinXY = MAX_PINS.map((n) => maxPin(L, n));
    const tex = canvasTex(p.max_W_est, p.max_L_est, (ctx, W, H) => {
      const X = (x) => x - bx0, Y = (y) => by1 - y;
      ctx.fillStyle = hex(COLOR.pcbGreenMax); ctx.fillRect(0, 0, W, H);
      MAX_PINS.forEach((name, i) => {
        const [x, y] = pinXY[i];
        ctx.fillStyle = '#d9b04a'; ctx.beginPath(); ctx.arc(X(x), Y(y), 0.85, 0, Math.PI * 2); ctx.fill();
        silk(ctx, name, X(x) - 1.4, Y(y), 0.85, { align: 'right' });
      });
      silk(ctx, 'MAX30102', W * 0.34, H * 0.5, 1.3, { rot: -Math.PI / 2 });
    });
    P.board(o, bx0, bx1, by0, by1, L.max_zb, L.max_zt, COLOR.pcbGreenMax, tex);
    // optical module on the underside, with its glass window and two LEDs
    const cx = L.chip_x, cy = L.chip_y;
    P.add(o, boxGeo(cx - p.max_chip_W / 2, cx + p.max_chip_W / 2, cy - p.max_chip_L / 2, cy + p.max_chip_L / 2,
      L.chip_face_z, L.max_zb), blackM(o));
    P.add(o, boxGeo(cx - 1.2, cx + 1.2, cy - 2.3, cy + 2.3, L.chip_face_z - 0.03, L.chip_face_z + 0.02),
      P.mat(o, 0x3d4652, { roughness: 0.15, metalness: 0.3 }), { edges: false });
    P.add(o, boxGeo(cx - 0.5, cx + 0.5, cy + 0.6, cy + 1.6, L.chip_face_z - 0.06, L.chip_face_z - 0.02),
      P.mat(o, 0xd84040, { emissive: 0x801010, emissiveIntensity: 0.6 }), { edges: false });
    P.add(o, boxGeo(cx - 0.5, cx + 0.5, cy - 1.6, cy - 0.6, L.chip_face_z - 0.06, L.chip_face_z - 0.02),
      P.mat(o, 0x5a3a7a), { edges: false });
    // tantalum caps and regulators on the sensor side
    const yellow = P.mat(o, 0xe8b53a, { roughness: 0.45 });
    P.add(o, boxGeo(bx1 - 3.8, bx1 - 2.2, by1 - 5.4, by1 - 2.2, L.max_zb - 1.6, L.max_zb), yellow);
    P.add(o, boxGeo(bx1 - 10.2, bx1 - 8.6, by1 - 16.6, by1 - 13.4, L.max_zb - 1.6, L.max_zb), yellow);
    P.add(o, boxGeo(bx1 - 3.8, bx1 - 2.2, by1 - 16.4, by1 - 13.6, L.max_zb - 1.1, L.max_zb), blackM(o));
    P.add(o, boxGeo(bx1 - 10.2, bx1 - 8.6, by1 - 5.2, by1 - 2.4, L.max_zb - 1.1, L.max_zb), blackM(o));
    P.pins(o, pinXY, L.max_zt, L.max_zb, gold(o));
    const s = P.obj('max_strip', [pinXY[3][0], pinXY[3][1], L.max_zb], { parent: 'max', initial: { o: 0 } });
    P.add(s, boxGeo(pinXY[0][0] - 1.27, pinXY[0][0] + 1.27, pinXY[6][1] - 1.27, pinXY[0][1] + 1.27,
      L.max_zb - 2.5, L.max_zb), blackM(s));
  }

  // ---------------- coin vibration motor ----------------
  {
    const o = P.obj('motor', [L.motor_cx, L.motor_cy, L.motor_z0], { initial: { buzz: 0 } });
    const z0 = L.motor_z0, z1 = z0 + p.motor_t;
    P.add(o, cylZGeo(L.motor_cx, L.motor_cy, p.motor_d / 2, z0, z1, 40), metal(o));
    P.add(o, cylZGeo(L.motor_cx, L.motor_cy, p.motor_d / 2 - 0.9, z1, z1 + 0.15, 40), P.mat(o, 0xe9e6dc), { edges: false });
    const lead = (dy, color) => P.add(o, tubeGeo([[L.motor_cx + 4.6, L.motor_cy + dy, z1 - 0.4],
      [L.motor_cx + 5.2, L.motor_cy + dy, z1 + 0.3], [L.motor_cx + 5.4, L.motor_cy + dy, z1 + 0.7]], 0.32, 12, 6),
    P.mat(o, color), { edges: false });
    lead(-0.6, WIRE.red); lead(0.6, WIRE.blue);
    o.update = (pose, g) => {
      const b = pose.buzz || 0;
      if (b > 0) {
        o.g.position.x += Math.sin(g * 210) * 0.35 * b;
        o.g.position.y += Math.cos(g * 170) * 0.35 * b;
      }
    };
  }

  // ---------------- push button (lies on its side, plunger toward +Y) ----------------
  {
    const o = P.obj('button', [L.btn_cx, L.btn_y_back, L.btn_z0]);
    const hw = p.btn_body / 2, zc = (L.btn_z0 + L.btn_z1) / 2;
    const yb = L.btn_y_front - p.btn_plunger_h;
    P.add(o, boxGeo(L.btn_cx - hw, L.btn_cx + hw, L.btn_y_back, yb - 0.3, L.btn_z0, L.btn_z1), blackM(o));
    P.add(o, boxGeo(L.btn_cx - hw, L.btn_cx + hw, yb - 0.3, yb, L.btn_z0, L.btn_z1), metal(o));
    P.add(o, cylYGeo(L.btn_cx, zc, p.btn_plunger_d / 2, yb, L.btn_y_front, 24), P.mat(o, 0x2b2b30));
    for (const s of [-1, 1]) {
      P.add(o, boxGeo(...(s < 0 ? [L.btn_cx - hw - 1.2, L.btn_cx - hw] : [L.btn_cx + hw, L.btn_cx + hw + 1.2]),
        21.7, 22.3, 5.3, 5.7), metal(o), { edges: false });
    }
  }

  // ---------------- small parts (layer 1, small-parts corner) ----------------
  const axial = (id, cx, cy, cz, len, r, bodyColor, bandAt, bandColor, leadL, opts = {}) => {
    const o = P.obj(id, [cx, cy, L.z_floor]);
    P.add(o, cylXGeo(cy, cz, r, cx - len / 2, cx + len / 2, 18), P.mat(o, bodyColor, opts));
    if (bandAt !== null) {
      for (const b of [].concat(bandAt)) {
        P.add(o, cylXGeo(cy, cz, r + 0.03, cx + b.x - b.w / 2, cx + b.x + b.w / 2, 18), P.mat(o, b.c ?? bandColor),
          { edges: false });
      }
    }
    const lead = P.mat(o, COLOR.metal, { metalness: 0.6, roughness: 0.3 });
    P.add(o, cylXGeo(cy, cz, 0.3, cx - len / 2 - leadL, cx - len / 2, 8), lead, { edges: false });
    P.add(o, cylXGeo(cy, cz, 0.3, cx + len / 2, cx + len / 2 + leadL, 8), lead, { edges: false });
    return o;
  };
  // 1N5817 Schottky: stripe end (+X) goes to VSYS
  axial('d5817', -7.8, -23.05, L.z_floor + 1.35, 5.2, 1.35, COLOR.black, { x: 2.2, w: 0.7 }, 0xc9c9c9, 1.6);
  // 1N4148: glass body, black stripe
  axial('d4148', -10.2, -16.95, L.z_floor + 0.85, 3.6, 0.85, 0xe08a2a, { x: 1.3, w: 0.45 }, 0x1a1a1a, 1.8,
    { roughness: 0.15, transparent: true, opacity: 0.9 });
  // 1 kOhm resistor: brown, black, red, gold
  axial('r1k', -10.3, -19.5, L.z_floor + 0.9, 3.3, 0.9, 0xd8c39a,
    [{ x: -1.0, w: 0.35, c: 0x6b3a1e }, { x: -0.4, w: 0.35, c: 0x1a1a1a }, { x: 0.2, w: 0.35, c: 0xc0392b },
      { x: 1.05, w: 0.35, c: 0xc9a43a }], null, 1.4);
  // 2N2222 / S8050 in TO-92, lying on its flat face, legs toward +Y
  {
    const cx = -16.0, cy = -22.3;
    const o = P.obj('q1', [cx, cy, L.z_floor]);
    const half = new THREE.CylinderGeometry(2.3, 2.3, 4.6, 24, 1, false, -Math.PI / 2, Math.PI);
    half.rotateZ(0); // axis along Y already
    half.translate(cx, cy, L.z_floor);
    P.add(o, half, blackM(o), { angle: 50 });
    P.add(o, boxGeo(cx - 2.3, cx + 2.3, cy - 2.3, cy + 2.3, L.z_floor - 0.01, L.z_floor + 0.02), blackM(o), { edges: false });
    const lead = P.mat(o, COLOR.metal, { metalness: 0.6, roughness: 0.3 });
    for (const dx of [-1.3, 0, 1.3]) {
      P.add(o, boxGeo(cx + dx - 0.22, cx + dx + 0.22, cy + 2.3, cy + 5.2, L.z_floor + 0.3, L.z_floor + 0.7), lead, { edges: false });
    }
  }

  // ---------------- layer 2 ----------------
  {
    const o = P.obj('kapton', [L.tp_cx, (L.tp_y0 + L.tp_y1) / 2, L.tray_z1]);
    P.add(o, boxGeo(L.tp_x0 + 0.8, L.tp_x1 - 0.8, L.tp_y0 + 3, L.tp_y1 - 3, L.tray_z1 + 0.02, L.tray_z1 + 0.1),
      P.mat(o, COLOR.kapton, { transparent: true, opacity: 0.75, roughness: 0.25 }), { edges: false, shadow: false });
  }
  {
    const o = P.obj('foam_bat', [(L.bat_x0 + L.bat_x1) / 2, L.bat_y0 + 15, L.tray_z1]);
    P.add(o, boxGeo(L.bat_x0 + 1.2, L.bat_x1 - 1.2, L.bat_y0 + 2, L.bat_y0 + 28, L.tray_z1, L.tray_z1 + 0.4),
      P.mat(o, COLOR.foam, { roughness: 0.95 }), { angle: 60 });
  }
  {
    const o = P.obj('foam_mpu', [L.mpu_x0 + p.mpu_W / 2, L.mpu_y0 + p.mpu_L / 2, L.tray_z1]);
    P.add(o, boxGeo(L.mpu_x0 + 3.4, L.mpu_x0 + p.mpu_W - 1.2, L.mpu_y0 + 1.5, L.mpu_y0 + p.mpu_L - 1.5,
      L.tray_z1, L.mpu_zb), P.mat(o, COLOR.foam, { roughness: 0.95 }), { angle: 60 });
  }

  // ---------------- TP4056 USB-C charger ----------------
  {
    const tcx = L.tp_cx, y0 = L.tp_y0, y1 = L.tp_y1, zb = L.tp_zb, zt = zb + p.tp_t;
    const o = P.obj('tp', [tcx, y0, zb]);
    const tex = canvasTex(p.tp_W, p.tp_L, (ctx, W, H) => {
      const X = (x) => x - L.tp_x0, Y = (y) => y1 - y;
      ctx.fillStyle = hex(COLOR.pcbBlue); ctx.fillRect(0, 0, W, H);
      for (const name of ['OUT-', 'B-', 'B+', 'OUT+']) {
        const [x, y] = tpPad(L, name);
        ctx.fillStyle = '#e0bb55'; ctx.fillRect(X(x) - 1.3, Y(y) - 1.2, 2.6, 2.4);
        ctx.fillStyle = '#5b4a1e'; ctx.beginPath(); ctx.arc(X(x), Y(y), 0.45, 0, Math.PI * 2); ctx.fill();
        silk(ctx, name, X(x), Y(y) + 2.4, 0.95);
      }
      for (const [i, name] of ['IN-', 'IN+'].entries()) {
        const x = X(L.tp_x0 + 1.6 + i * 14.1);
        ctx.fillStyle = '#e0bb55'; ctx.fillRect(x - 1.1, Y(y0 + 3.0) - 1.1, 2.2, 2.2);
        silk(ctx, name, x, Y(y0 + 5.2), 0.85);
      }
      silk(ctx, 'TP4056', W / 2 - 1.6, Y(y0 + 16.3), 1.5);
      silk(ctx, 'TYPE-C', W / 2 - 1.6, Y(y0 + 18.0), 1.0);
      silk(ctx, 'R3', X(tcx + 1.6), Y(y0 + 13.6), 0.8);
      silk(ctx, 'CHRG', X(tcx + 6.7), Y(y0 + 9.0), 0.7, { align: 'left' });
      silk(ctx, 'STBY', X(tcx + 6.7), Y(y0 + 11.0), 0.7, { align: 'left' });
    });
    P.board(o, L.tp_x0, L.tp_x1, y0, y1, zb, zt, COLOR.pcbBlue, tex);
    // USB-C receptacle (front flush with the outside of the case)
    const uz1 = zb + p.tp_h, uz0 = uz1 - p.tp_usbc_h;
    P.add(o, rboxGeo(tcx - p.tp_usbc_w / 2, tcx + p.tp_usbc_w / 2, y0 - p.tp_usbc_over, y0 + 7.0, uz0, uz1, 1.4, 4), metal(o));
    P.add(o, rboxGeo(tcx - 3.6, tcx + 3.6, y0 - p.tp_usbc_over - 0.05, y0 - p.tp_usbc_over + 0.5, uz0 + 0.55, uz1 - 0.55, 0.6, 2),
      blackM(o), { edges: false });
    // support legs of the receptacle down to the board
    P.add(o, boxGeo(tcx - 4.4, tcx - 3.6, y0 + 1, y0 + 6, zt, uz0), metal(o), { edges: false });
    P.add(o, boxGeo(tcx + 3.6, tcx + 4.4, y0 + 1, y0 + 6, zt, uz0), metal(o), { edges: false });
    // TP4056 IC (SOP-8) with legs
    const icx = tcx - 2.6, icy = y0 + 12.2;
    P.add(o, boxGeo(icx - 2.0, icx + 2.0, icy - 2.45, icy + 2.45, zt, zt + 1.45), blackM(o));
    const legM = P.mat(o, COLOR.metal, { metalness: 0.6, roughness: 0.3 });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const yy = icy - 1.905 + i * 1.27;
        P.add(o, boxGeo(...(s < 0 ? [icx - 2.9, icx - 2.0] : [icx + 2.0, icx + 2.9]), yy - 0.2, yy + 0.2, zt, zt + 0.5),
          legM, { edges: false });
      }
    }
    // protection ICs at the battery end
    P.add(o, boxGeo(tcx + 2.2, tcx + 5.1, y1 - 8.6, y1 - 7.0, zt, zt + 1.1), blackM(o));
    P.add(o, boxGeo(tcx - 5.2, tcx - 2.2, y1 - 9.4, y1 - 5.2, zt, zt + 1.0), blackM(o));
    // a few 0603 parts
    const smd = P.mat(o, 0x8a6a45);
    for (const [dx, dy] of [[4.6, 15.2], [-6.2, 7.5], [-6.2, 9.4], [6.4, 20.0], [0.2, 21.4]]) {
      P.add(o, boxGeo(tcx + dx - 0.8, tcx + dx + 0.8, y0 + dy - 0.4, y0 + dy + 0.4, zt, zt + 0.45), smd, { edges: false });
    }
    // charge LEDs: red CHRG and blue STBY (pose of the 'charge' track lights them)
    const ledR = P.mat(o, 0xf0d0d0, { emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.2 });
    const ledB = P.mat(o, 0xd0d8f0, { emissive: 0x2a6bff, emissiveIntensity: 0, roughness: 0.2 });
    P.add(o, boxGeo(tcx + 4.6, tcx + 6.2, y0 + 8.6, y0 + 9.4, zt, zt + 0.6), ledR, { edges: false });
    P.add(o, boxGeo(tcx + 4.6, tcx + 6.2, y0 + 10.6, y0 + 11.4, zt, zt + 0.6), ledB, { edges: false });
    o.leds = { red: ledR, blue: ledB };
    // the PROG resistor: the stock 1.2 kOhm ("122") and its 4.7 kOhm ("472") replacement
    const rx = tcx + 1.6, ry = y0 + 12.2;
    for (const [id, code, initial] of [['r_old', '122', { o: 0 }], ['r_new', '472', { o: 1 }]]) {
      const r = P.obj(id, [rx, ry, zt], { parent: 'tp', initial });
      const t = canvasTex(1.6, 0.8, (ctx, W, H) => {
        ctx.fillStyle = '#18181b'; ctx.fillRect(0, 0, W, H);
        silk(ctx, code, W / 2, H / 2 + 0.03, 0.62, { weight: 800 });
      }, 120);
      const cap = P.mat(r, COLOR.metal, { metalness: 0.6, roughness: 0.3 });
      const body = P.mat(r, 0xffffff, { map: t });
      const side = P.mat(r, 0x18181b);
      P.add(r, boxGeo(rx - 0.55, rx + 0.55, ry - 0.4, ry + 0.4, zt, zt + 0.45), [side, side, side, side, body, side], { edges: false });
      P.add(r, boxGeo(rx - 0.8, rx - 0.55, ry - 0.4, ry + 0.4, zt, zt + 0.45), cap, { edges: false });
      P.add(r, boxGeo(rx + 0.55, rx + 0.8, ry - 0.4, ry + 0.4, zt, zt + 0.45), cap, { edges: false });
    }
  }

  // ---------------- battery 402030PT ----------------
  {
    const bx0 = L.bat_x0 + 0.25, bx1 = bx0 + p.bat_W, by0 = L.bat_y0, by1 = by0 + p.bat_L;
    const z0 = L.tray_z1 + 0.4, z1 = z0 + p.bat_T;
    const o = P.obj('bat', [(bx0 + bx1) / 2, (by0 + L.bat_y1) / 2, z0]);
    P.add(o, rboxGeo(bx0, bx1, by0, by1, z0, z1, 1.2, 3), P.mat(o, COLOR.battery, { metalness: 0.35, roughness: 0.42 }), { angle: 50 });
    const tex = canvasTex(16, 24, (ctx, W, H) => {
      ctx.fillStyle = '#e9ecef'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1d1d22'; ctx.fillRect(0, 0, W, 4.2);
      silk(ctx, 'LiPo 3.7 V', W / 2, 2.1, 1.7, { weight: 800 });
      silk(ctx, '402030PT', W / 2, 9.0, 2.1, { color: '#1d1d22', weight: 800 });
      silk(ctx, '350 mAh', W / 2, 12.4, 1.8, { color: '#1d1d22' });
      silk(ctx, 'do not pierce or bend', W / 2, 20.5, 1.05, { color: '#555' });
    }, 24);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(16, 24), P.mat(o, 0xffffff, { map: tex, roughness: 0.7 }));
    label.position.set((bx0 + bx1) / 2, (by0 + by1) / 2, z1 + 0.02);
    o.inner.add(label);
    // protection board folded at the +Y end, wrapped in kapton
    P.add(o, rboxGeo(bx0 + 0.5, bx1 - 0.5, by1, L.bat_y1, z0 + 0.4, z0 + 3.2, 0.5, 2),
      P.mat(o, COLOR.kapton, { roughness: 0.3 }), { angle: 50 });
    // short leads leaving the protection end (the rest is drawn in step 9)
    const zl = z0 + 2.0;
    P.add(o, tubeGeo([[-11.0, L.bat_y1 - 0.3, zl], [-11.0, L.bat_y1 - 0.1, zl], [-11.0, L.bat_y1 + 0.1, zl]], 0.36, 12, 6),
      P.mat(o, WIRE.red), { edges: false });
    P.add(o, tubeGeo([[-13.0, L.bat_y1 - 0.3, zl], [-13.0, L.bat_y1 - 0.1, zl], [-13.0, L.bat_y1 + 0.1, zl]], 0.36, 12, 6),
      P.mat(o, WIRE.black), { edges: false });
  }

  // ---------------- slide switch (knob out through the ports wall) ----------------
  {
    const cx = L.sw_x_c, y0 = L.sw_y0, z0 = L.tray_z1;
    const o = P.obj('sw', [cx, y0, z0]);
    P.add(o, boxGeo(cx - p.sw_L / 2, cx + p.sw_L / 2, y0, y0 + p.sw_W, z0, z0 + 1.6), blackM(o));
    P.add(o, boxGeo(cx - p.sw_L / 2, cx + p.sw_L / 2, y0, y0 + p.sw_W, z0 + 1.6, z0 + p.sw_H), metal(o));
    const legM = P.mat(o, COLOR.metal, { metalness: 0.6, roughness: 0.3 });
    for (const dx of [-2, 0, 2]) {
      P.add(o, boxGeo(cx + dx - 0.25, cx + dx + 0.25, y0 + 2.05, y0 + 2.35, L.tray_z0 - 1.2, z0), legM, { edges: false });
    }
    const k = P.obj('sw_knob', [cx, y0, z0 + p.sw_H / 2], { parent: 'sw', initial: { p: [1.25, 0, 0] } });
    P.add(k, boxGeo(cx - p.sw_knob_w / 2, cx + p.sw_knob_w / 2, y0 - p.sw_knob_out, y0 + 0.01,
      z0 + p.sw_H / 2 - 1.0, z0 + p.sw_H / 2 + 1.0), P.mat(k, 0x2b2b30));
  }

  // ---------------- MPU-6050 GY-521 ----------------
  {
    const x0 = L.mpu_x0, y0 = L.mpu_y0, x1 = x0 + p.mpu_W, y1 = y0 + p.mpu_L;
    const o = P.obj('mpu', [(x0 + x1) / 2, (y0 + y1) / 2, L.mpu_zb], { initial: { pt: p.stub, pb: 0 } });
    const pinXY = MPU_PINS.map((n) => mpuPin(L, n));
    const tex = canvasTex(p.mpu_W, p.mpu_L, (ctx, W, H) => {
      const X = (x) => x - x0, Y = (y) => y1 - y;
      ctx.fillStyle = hex(COLOR.pcbBlue); ctx.fillRect(0, 0, W, H);
      MPU_PINS.forEach((name, i) => {
        const [x, y] = pinXY[i];
        ctx.fillStyle = '#e0bb55'; ctx.beginPath(); ctx.arc(X(x), Y(y), 0.85, 0, Math.PI * 2); ctx.fill();
        silk(ctx, name, X(x) + 1.5, Y(y), 0.85, { align: 'left' });
      });
      for (const hy of [y0 + p.mpu_hole_from_top, y1 - p.mpu_hole_from_top]) {
        const hx = X(x0 + p.mpu_hole_x);
        ctx.fillStyle = '#e0bb55'; ctx.beginPath(); ctx.arc(hx, Y(hy), 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(hx, Y(hy), p.mpu_hole_d / 2, 0, Math.PI * 2); ctx.fill();
      }
      silk(ctx, 'GY-521', W * 0.62, H * 0.5, 1.6, { rot: -Math.PI / 2, weight: 800 });
    });
    P.board(o, x0, x1, y0, y1, L.mpu_zb, L.mpu_zb + p.mpu_t, COLOR.pcbBlue, tex);
    const zt = L.mpu_zb + p.mpu_t;
    P.add(o, boxGeo(x0 + 6.4, x0 + 10.4, y0 + 8.1, y0 + 12.1, zt, zt + 0.9), blackM(o));
    P.add(o, boxGeo(x0 + 6.5, x0 + 9.4, y0 + 2.2, y0 + 3.8, zt, zt + 1.1), blackM(o));
    const smd = P.mat(o, 0x8a6a45);
    for (const [dx, dy] of [[5.2, 14.5], [7.2, 14.5], [11.2, 9.2], [11.2, 11.4], [5.0, 6.2]]) {
      P.add(o, boxGeo(x0 + dx - 0.4, x0 + dx + 0.4, y0 + dy - 0.8, y0 + dy + 0.8, zt, zt + 0.5), smd, { edges: false });
    }
    P.pins(o, pinXY, zt, L.mpu_zb, gold(o));
    const s = P.obj('mpu_strip', [pinXY[3][0], pinXY[3][1], L.mpu_zb], { parent: 'mpu', initial: { o: 0 } });
    P.add(s, boxGeo(pinXY[0][0] - 1.27, pinXY[0][0] + 1.27, pinXY[0][1] - 1.27, pinXY[7][1] + 1.27,
      L.mpu_zb - 2.5, L.mpu_zb), blackM(s));
  }

  // ---------------- M2 x 6 pan-head screws ----------------
  const headProfile = [[0, 0], [2.0, 0], [2.0, 0.85], [1.82, 1.25], [1.35, 1.52], [0.6, 1.6], [0, 1.6]]
    .map(([r, z]) => new THREE.Vector2(r, z));
  let si = 0;
  for (const sy of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const x = sx * L.screw_x, y = sy * L.screw_y, zh = L.H_total - 0.8;
      const o = P.obj(`screw${si++}`, [x, y, zh]);
      const m = steel(o);
      const head = new THREE.LatheGeometry(headProfile, 28);
      head.rotateX(Math.PI / 2);
      head.translate(x, y, zh);
      P.add(o, head, m, { angle: 50 });
      const rec = P.mat(o, 0x2c2f33);
      P.add(o, boxGeo(x - 1.1, x + 1.1, y - 0.25, y + 0.25, zh + 1.05, zh + 1.62), rec, { edges: false });
      P.add(o, boxGeo(x - 0.25, x + 0.25, y - 1.1, y + 1.1, zh + 1.05, zh + 1.62), rec, { edges: false });
      P.add(o, cylZGeo(x, y, 0.78, zh - 6.0, zh, 16), m, { edges: false });
      const thread = new THREE.TubeGeometry(new Helix(0.82, -5.7, -0.4, 8), 160, 0.16, 5, false);
      thread.translate(x, y, zh);
      P.add(o, thread, m, { edges: false });
      P.add(o, coneGeo(0.78, 0.8, 'z', 16).translate(x, y, zh - 6.6), m, { edges: false });
    }
  }

  // ---------------- spring bars ----------------
  for (const [id, sx] of [['sb_px', 1], ['sb_nx', -1]]) {
    const x = sx * L.sb_x, z = p.sb_z;
    const o = P.obj(id, [x, 0, z], { initial: { tip: 1 } });
    const m = steel(o);
    P.add(o, cylYGeo(x, z, p.sb_body_d / 2, -10.3, 10.3, 20), m, { edges: false });
    P.add(o, cylYGeo(x, z, p.sb_body_d / 2 + 0.12, -10.6, -10.1, 20), m, { edges: false });
    P.add(o, cylYGeo(x, z, p.sb_body_d / 2 + 0.12, 10.1, 10.6, 20), m, { edges: false });
    // quick-release lever
    P.add(o, cylZGeo(x, 5.5, 0.35, z - 2.2, z, 10), m, { edges: false });
    const tips = [];
    for (const sy of [-1, 1]) {
      const tg = new THREE.CylinderGeometry(p.sb_tip_d / 2, p.sb_tip_d / 2, 1, 12);
      tg.translate(0, 0.5 * sy, 0);
      const tip = new THREE.Mesh(tg, m);
      tip.position.set(x, sy * 10.6, z);
      tip.castShadow = true;
      o.inner.add(tip);
      tips.push(tip);
    }
    o.update = (pose) => { for (const t of tips) t.scale.y = 0.2 + 1.4 * (pose.tip ?? 1); };
  }

  // ---------------- watch strap halves (bend 0 = lying flat, 1 = round the wrist) ----------------
  const WR = wristShape();
  for (const [id, sx] of [['strap_px', 1], ['strap_nx', -1]]) {
    const o = P.obj(id, [sx * L.sb_x, 0, p.sb_z], { section: false, initial: { b: 0, o: 0 } });
    buildStrap(P, o, sx, L, WR);
  }

  // ---------------- forearm (step 12) ----------------
  {
    const o = P.obj('arm', [0, 0, WR.cz], { section: false, initial: { o: 0 } });
    const mat = P.mat(o, COLOR.clay, { roughness: 0.9, side: THREE.DoubleSide });
    const geo = armGeometry(WR);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    o.inner.add(mesh);
  }

  // ---------------- direction arrows (step 12) ----------------
  {
    const o = P.obj('arrows', [0, 0, 0], { section: false, kind: 'fx', initial: { o: 0 } });
    const m = P.mat(o, COLOR.accent, { roughness: 0.5 });
    const shaft = (y0, y1) => P.add(o, cylYGeo(0, 6, 1.6, y0, y1, 16), m);
    shaft(72, 86);
    P.add(o, coneGeo(4, 8, 'y').rotateX(Math.PI).translate(0, 94, 6), m);
    shaft(-150, -136);
    P.add(o, coneGeo(4, 8, '-y').rotateX(Math.PI).translate(0, -158, 6), m);
  }

  buildFx(P, L);
  return P;
}

// ---------------------------------------------------------------------------
// wrist cross-section: a rounded rectangle-ish superellipse under the band

export function wristShape() {
  return { a: 29, b: 20, n: 2.6, cz: -21.0 };
}
function superPt(a, b, n, th) {
  const s = Math.sin(th), c = Math.cos(th);
  return [a * Math.sign(s) * Math.pow(Math.abs(s), 2 / n), b * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)];
}
function resample(pts, N) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = d[d.length - 1];
  const out = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = (total * i) / (N - 1);
    while (j < d.length - 2 && d[j + 1] < s) j++;
    const k = (s - d[j]) / Math.max(1e-9, d[j + 1] - d[j]);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * k, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * k]);
  }
  return out;
}

function buildStrap(P, o, sx, L, WR) {
  const N = 90, W = 21.6, T = 2.4;
  const x0 = sx * L.sb_x, z0 = L.p.sb_z;
  // flat: leaves the spring bar, drops to the table and lies flat
  const flat = [];
  for (let i = 0; i <= 120; i++) {
    const s = i * 0.75;
    const drop = s < 22 ? (1 - Math.cos((s / 22) * Math.PI)) / 2 : 1;
    flat.push([x0 + sx * (s - 1.2), z0 - drop * (z0 + 1.2 - T / 2 + 0.05)]);
  }
  // wrapped: out from the bar, then round the wrist past the bottom
  const a = WR.a + T / 2 + 0.2, b = WR.b + T / 2 + 0.2;
  const wrap = [[x0 - sx * 1.2, z0], [x0 + sx * 2.0, z0 - 0.4]];
  for (let th = 0.95; th <= Math.PI + 0.22; th += 0.03) {
    const [u, v] = superPt(a, b, WR.n, th);
    wrap.push([sx * u, WR.cz + v]);
  }
  const F = resample(flat, N), Wp = resample(wrap, N);
  // four faces, 2 vertices per path point each
  const pos = new Float32Array(N * 8 * 3);
  const idx = [];
  for (let f = 0; f < 4; f++) {
    for (let i = 0; i < N - 1; i++) {
      const a0 = f * N * 2 + i * 2, b0 = a0 + 2;
      if (f % 2 === 0) idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      else idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(sx > 0 ? idx : flipIdx(idx));
  const mat = P.mat(o, COLOR.strap, { roughness: 0.85, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  o.inner.add(mesh);
  const pts = new Array(N);
  let lastB = -1;
  o.update = (pose) => {
    const bnd = pose.b ?? 0;
    if (Math.abs(bnd - lastB) < 1e-4) return;
    lastB = bnd;
    for (let i = 0; i < N; i++) pts[i] = [F[i][0] + (Wp[i][0] - F[i][0]) * bnd, F[i][1] + (Wp[i][1] - F[i][1]) * bnd];
    let k = 0;
    const put = (x, y, z) => { pos[k++] = x; pos[k++] = y; pos[k++] = z; };
    const ring = (i) => {
      const a0 = pts[Math.max(0, i - 1)], a1 = pts[Math.min(N - 1, i + 1)];
      let tx = a1[0] - a0[0], tz = a1[1] - a0[1];
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz * sx, nz = tx * sx; // outward normal of the strap
      return { x: pts[i][0], z: pts[i][1], nx, nz };
    };
    const rings = Array.from({ length: N }, (_, i) => ring(i));
    // top (outer), bottom (inner), side -Y, side +Y
    for (const r of rings) { put(r.x + r.nx * T / 2, -W / 2, r.z + r.nz * T / 2); put(r.x + r.nx * T / 2, W / 2, r.z + r.nz * T / 2); }
    for (const r of rings) { put(r.x - r.nx * T / 2, -W / 2, r.z - r.nz * T / 2); put(r.x - r.nx * T / 2, W / 2, r.z - r.nz * T / 2); }
    for (const r of rings) { put(r.x - r.nx * T / 2, -W / 2, r.z - r.nz * T / 2); put(r.x + r.nx * T / 2, -W / 2, r.z + r.nz * T / 2); }
    for (const r of rings) { put(r.x - r.nx * T / 2, W / 2, r.z - r.nz * T / 2); put(r.x + r.nx * T / 2, W / 2, r.z + r.nz * T / 2); }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
  o.update({ b: 0 });
}
function flipIdx(idx) {
  const out = [];
  for (let i = 0; i < idx.length; i += 3) out.push(idx[i], idx[i + 2], idx[i + 1]);
  return out;
}

function armGeometry(WR) {
  // rings along Y; the wrist is narrowest around the band and widens toward the elbow
  const ys = [];
  for (let y = -128; y <= 58; y += 3) ys.push(y);
  const seg = 48;
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const verts = [], idx = [];
  ys.forEach((y) => {
    const toElbow = smooth(-15, -125, y), toHand = smooth(28, 58, y);
    const sxs = 1 + 0.26 * toElbow + 0.12 * toHand;
    const szs = 1 + 0.18 * toElbow - 0.22 * toHand;
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const [u, v] = superPt(WR.a * sxs, WR.b * szs, WR.n, th);
      // keep the top of the arm level with the band
      verts.push(u, y, WR.cz + v + (WR.b - WR.b * szs));
    }
  });
  for (let r = 0; r < ys.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * seg + i, b = r * seg + ((i + 1) % seg), c = a + seg, d = b + seg;
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps
  for (const [r, flip] of [[0, true], [ys.length - 1, false]]) {
    let cx = 0, cz = 0;
    for (let i = 0; i < seg; i++) { cx += verts[(r * seg + i) * 3]; cz += verts[(r * seg + i) * 3 + 2]; }
    const ci = verts.length / 3;
    verts.push(cx / seg, ys[r], cz / seg);
    for (let i = 0; i < seg; i++) {
      const a = r * seg + i, b = r * seg + ((i + 1) % seg);
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.translate(0, 0, 0);
  return g;
}

// ---------------------------------------------------------------------------
// tools and effects

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildFx(P, L) {
  const p = L.p;
  const fx = (id, pivot, initial = {}) => P.obj(id, pivot, { kind: 'fx', section: false, initial: { o: 0, ...initial } });

  // drill bit in a pin vise; tip at the pivot, pointing down (-Z)
  {
    const o = fx('drill', [0, 0, 0]);
    const bit = P.mat(o, 0xb9bec4, { metalness: 0.8, roughness: 0.25 });
    P.add(o, coneGeo(0.8, 1.0, 'z', 16), bit, { edges: false });
    P.add(o, cylZGeo(0, 0, 0.8, 1.0, 14, 16), bit, { edges: false });
    const flute = new THREE.TubeGeometry(new Helix(0.72, 1.2, 10, 6), 120, 0.12, 4, false);
    P.add(o, flute, P.mat(o, 0x5d636b, { metalness: 0.6 }), { edges: false });
    P.add(o, cylZGeo(0, 0, 2.6, 14, 20, 20), P.mat(o, 0x9da3aa, { metalness: 0.7, roughness: 0.3 }));
    P.add(o, cylZGeo(0, 0, 4.2, 20, 52, 24), P.mat(o, 0x3d4148, { roughness: 0.45 }));
  }
  // pointer arrow that presses the button tab (tip at pivot, pointing -Y)
  {
    const o = fx('finger', [L.btn_cx, L.Y_out / 2 + 0.2, L.btn_z0 + p.btn_body / 2 + 1.0]);
    const m = P.mat(o, COLOR.accent, { roughness: 0.5 });
    const [x, y, z] = o.home;
    P.add(o, coneGeo(2.4, 5, '-y', 24).rotateX(Math.PI).translate(x, y, z), m);
    P.add(o, cylYGeo(x, z, 1.1, y + 5, y + 18, 16), m);
  }
  // hot glue / super glue blobs
  const glue = (id, spots) => {
    // glue stays in the section view, so it is cut like the parts
    const o = P.obj(id, spots[0], { kind: 'fx', initial: { o: 0, s: 0 } });
    const m = P.mat(o, COLOR.glue, { roughness: 0.15, transparent: true, opacity: 0.82 });
    const blobs = spots.map(([x, y, z, r = 1.0]) => {
      const g = new THREE.SphereGeometry(r, 16, 10);
      g.scale(1.35, 1.35, 0.6);
      const mesh = P.add(o, g, m, { edges: false });
      mesh.position.set(x, y, z);
      return mesh;
    });
    // each blob grows from its own centre (pose key s)
    o.update = (pose) => { const k = Math.max(0.001, pose.s ?? 1); blobs.forEach((b) => b.scale.setScalar(k)); };
    return o;
  };
  glue('glue_pad', [[L.plug_x1 + 0.4, -9, L.z_floor + 0.2], [L.plug_x1 + 0.4, 2.5, L.z_floor + 0.2],
    [-10, L.plug_y0 - 0.4, L.z_floor + 0.2], [-15.5, L.plug_y1 + 0.3, L.z_floor + 0.2, 0.8]]);
  glue('glue_max', [[L.seat_x1 - p.max_W_est + 0.2, -9, L.max_zt + 0.1], [L.seat_x1 - p.max_W_est + 0.2, 2, L.max_zt + 0.1],
    [-12, L.seat_y1 - p.max_L_est - 0.1, L.max_zt - 0.2]]);
  glue('glue_motor', [[L.motor_cx - 5.3, L.motor_cy - 1.5, L.z_floor + 0.5]]);
  glue('glue_btn', [[L.btn_cx, L.btn_y_back - 0.3, L.btn_z1 - 0.5, 1.1]]);
  glue('glue_tp', [[L.tp_cx - 3, L.tp_y1 + 0.3, L.tp_zb + 0.6], [L.tp_cx + 3, L.tp_y1 + 0.3, L.tp_zb + 0.6, 0.8]]);
  glue('glue_sw', [[L.sw_x_c - p.sw_L / 2 - 0.4, L.sw_y0 + 2.2, L.tray_z1 + 1.0, 0.9],
    [L.sw_x_c + p.sw_L / 2 + 0.4, L.sw_y0 + 2.2, L.tray_z1 + 1.0, 0.9]]);

  // micro-USB cable plug; tip at the pivot, pointing +Y into the Pico
  {
    const tip = [L.pico_cx, L.pico_y0 + 2.6, L.usb_cz];
    const o = fx('usb_micro', tip);
    const [x, y, z] = tip;
    P.add(o, rboxGeo(x - 3.4, x + 3.4, y - 7.5, y, z - 0.9, z + 0.9, 0.3), P.mat(o, COLOR.metal, { metalness: 0.6, roughness: 0.3 }));
    P.add(o, rboxGeo(x - 5.3, x + 5.3, y - 20, y - 7.5, z - 3.2, z + 3.2, 1.6, 3), P.mat(o, 0x2b2d31, { roughness: 0.7 }));
    P.add(o, cylYGeo(x, z, 1.8, y - 75, y - 20, 16), P.mat(o, 0x2b2d31, { roughness: 0.8 }), { edges: false });
  }
  // USB-C cable plug for the charger
  {
    const tip = [L.tp_cx, L.tp_y0 + 5.8, L.tp_zb + p.tp_h - p.tp_usbc_h / 2];
    const o = fx('usb_c', tip);
    const [x, y, z] = tip;
    P.add(o, rboxGeo(x - 4.1, x + 4.1, y - 8.8, y, z - 1.25, z + 1.25, 1.1, 3), P.mat(o, COLOR.metal, { metalness: 0.6, roughness: 0.3 }));
    P.add(o, rboxGeo(x - 6.0, x + 6.0, y - 22, y - 8.8, z - 3.0, z + 3.0, 2.2, 3), P.mat(o, 0xeeeeea, { roughness: 0.6 }));
    P.add(o, cylYGeo(x, z, 1.9, y - 80, y - 22, 16), P.mat(o, 0xeeeeea, { roughness: 0.7 }), { edges: false });
  }
  // soldering iron: tip at the pivot, body along +Z (tilted by its pose)
  {
    const o = fx('iron', [L.tp_cx + 1.6, L.tp_y0 + 12.2, L.tp_zb + p.tp_t + 0.5]);
    const [x, y, z] = o.home;
    P.add(o, coneGeo(1.0, 7, 'z', 16).translate(x, y, z), P.mat(o, 0x9aa0a6, { metalness: 0.7, roughness: 0.3 }), { edges: false });
    P.add(o, cylZGeo(x, y, 1.9, z + 7, z + 34, 20), P.mat(o, 0xc9cdd2, { metalness: 0.7, roughness: 0.25 }), { edges: false });
    P.add(o, cylZGeo(x, y, 6.0, z + 34, z + 110, 28), P.mat(o, 0x2d3036, { roughness: 0.6 }));
  }
  // glow sprites for the charge LED (on the board, and through the lid's light window)
  const tex = glowTexture();
  for (const [id, pos, size] of [['glow_tp', [L.tp_cx + 5.4, L.tp_y0 + 9.0, L.tp_zb + p.tp_t + 0.9], 7],
    ['glow_lid', [L.tp_cx + 5.4, L.tp_y0 + 9.0, L.H_total + 0.3], 13]]) {
    const o = fx(id, pos);
    // on the white lid an additive glow would wash out to white, so it tints instead
    const onLid = id === 'glow_lid';
    const m = new THREE.SpriteMaterial({ map: tex, color: onLid ? 0xff2a14 : 0xff3a22, transparent: true, opacity: 0,
      depthWrite: false, blending: onLid ? THREE.NormalBlending : THREE.AdditiveBlending });
    m.userData.baseOpacity = onLid ? 0.6 : 0.9;
    o.mats.push(m);
    const sp = new THREE.Sprite(m);
    sp.position.set(...pos);
    sp.scale.set(size, size, 1);
    o.inner.add(sp);
    // the board LED itself lights up with its glow
    if (id === 'glow_tp') o.update = (pose) => { P.objs.tp.leds.red.emissiveIntensity = (pose.o ?? 0) * 3.0; };
  }
}
