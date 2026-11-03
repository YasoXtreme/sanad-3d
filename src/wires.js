// Wires, following the pin map in the assembly guide (page 5).
// Routes are drawn as tubes that "draw on" (pose key k: 0..1). The paths are
// schematic: they follow the real pins, slots and channel, but your wires
// will bend differently.

import * as THREE from 'three';
import { picoPin, maxPin, mpuPin, tpPad } from './layout.js';
import { WIRE } from './parts.js';

const R = 0.36; // 28 AWG silicone wire, ~0.7 mm outer diameter

function tube(pts, radius = R) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const seg = Math.max(24, Math.round(curve.getLength() * 1.6));
  const g = new THREE.TubeGeometry(curve, seg, radius, 6, false);
  g.userData.seg = seg;
  return g;
}

function setDraw(mesh, k) {
  const g = mesh.geometry;
  const n = Math.round(Math.min(1, Math.max(0, k)) * g.userData.seg);
  g.setDrawRange(0, n * 6 * 6);
  mesh.visible = n > 0;
}

const up = (p, dz) => [p[0], p[1], p[2] + dz];

export function buildWires(P) {
  const L = P.L;
  const wires = [];
  const matFor = (o, color) => P.mat(o, color, { roughness: 0.55 });

  // a route is one object with one tube
  const route = (id, color, pts) => {
    const o = P.obj(id, [0, 0, 0], { kind: 'wire', initial: { o: 0, k: 0 } });
    const mesh = new THREE.Mesh(tube(pts), matFor(o, color));
    mesh.castShadow = true;
    o.inner.add(mesh);
    o.update = (pose) => setDraw(mesh, pose.k ?? 0);
    wires.push(o);
    return o;
  };
  // leads: short wires soldered to one board in step 4, moving with it
  const leads = (id, parent, list) => {
    const o = P.obj(id, P.objs[parent].home, { parent, kind: 'wire', initial: { o: 0, k: 0 } });
    const meshes = list.map(({ at, color, dir, down }) => {
      const s = down ? -1 : 1;
      const pts = [at, up(at, s * 2.2), [at[0] + dir[0] * 1.6, at[1] + dir[1] * 1.6, at[2] + s * 4.2],
        [at[0] + dir[0] * 4.8, at[1] + dir[1] * 4.8, at[2] + s * 5.2]];
      const m = new THREE.Mesh(tube(pts), matFor(o, color));
      m.castShadow = true;
      o.inner.add(m);
      return m;
    });
    o.update = (pose) => meshes.forEach((m) => setDraw(m, pose.k ?? 0));
    wires.push(o);
    return o;
  };

  const pp = (n) => picoPin(L, n);
  const C = WIRE;

  // ---------------- leads (step 4) ----------------
  const picoA = [[6, C.yellow], [7, C.blue], [8, C.black], [9, C.grey], [13, C.black], [18, C.black],
    [19, C.green], [20, C.green]];
  const picoB = [[31, C.yellow], [32, C.blue], [33, C.black], [34, C.grey], [36, C.red], [38, C.black], [39, C.red]];
  leads('lead_pico_a', 'pico', picoA.map(([n, color]) => ({ at: pp(n), color, dir: [1, 0] })));
  leads('lead_pico_b', 'pico', picoB.map(([n, color]) => ({ at: pp(n), color, dir: [-1, 0] })));
  leads('lead_max', 'max', [['VIN', C.red], ['SCL', C.blue], ['SDA', C.yellow], ['INT', C.grey], ['GND', C.black]]
    .map(([n, color]) => ({ at: maxPin(L, n), color, dir: [-1, 0] })));
  leads('lead_mpu', 'mpu', [['VCC', C.red], ['GND', C.black], ['SCL', C.blue], ['SDA', C.yellow], ['INT', C.grey]]
    .map(([n, color]) => ({ at: mpuPin(L, n), color, dir: [-1, 0], down: true })));

  // ---------------- layer 1 (step 6) ----------------
  const mx = (n) => maxPin(L, n);
  // MAX30102 -> Pico, across the 1 mm gap between the columns
  route('w_max_sda', C.yellow, [mx('SDA'), up(mx('SDA'), 0.8), [3.6, -9.6, 5.9], up(pp(6), 0.7), pp(6)]);
  route('w_max_scl', C.blue, [mx('SCL'), up(mx('SCL'), 0.6), [3.4, -9.8, 5.4], up(pp(7), 0.5), pp(7)]);
  route('w_max_int', C.grey, [mx('INT'), up(mx('INT'), 0.7), [3.5, -4.6, 5.6], up(pp(9), 0.6), pp(9)]);
  route('w_max_gnd', C.black, [mx('GND'), up(mx('GND'), 0.9), [4.2, 0.2, 6.0], [2.0, -5.2, 6.0], up(pp(8), 0.7), pp(8)]);
  route('w_max_vin', C.red, [mx('VIN'), up(mx('VIN'), 1.0), [3.0, -13.1, 6.4], [-8.0, -13.7, 6.5], up(pp(36), 0.8), pp(36)]);
  // push button legs -> GP14 (pin 19) and GND (pin 18)
  route('w_btn_sig', C.green, [[8.1, 22.0, 5.5], [6.0, 21.9, 6.2], [2.0, 21.5, 6.0], up(pp(19), 0.6), pp(19)]);
  route('w_btn_gnd', C.black, [[17.3, 22.0, 5.5], [17.6, 21.6, 7.4], [12.7, 21.0, 8.7], [8.0, 20.4, 7.6],
    [3.0, 19.2, 6.2], up(pp(18), 0.6), pp(18)]);
  // coin motor: red + joins MAX VIN (3V3), blue - to the transistor collector
  const motR = [L.motor_cx - 5.7, L.motor_cy + 0.5, L.motor_z0 + L.p.motor_t + 1.7];
  const motB = [L.motor_cx - 5.7, L.motor_cy - 0.5, L.motor_z0 + L.p.motor_t + 1.7];
  route('w_mot_red', C.red, [motR, [5.2, 13.0, 5.9], [4.3, 6.0, 5.8], [4.3, -8.0, 5.8], [5.4, -12.6, 5.6], up(mx('VIN'), 0.4), mx('VIN')]);
  route('w_mot_blue', C.grey, [motB, [5.0, 11.0, 6.4], [4.9, -6.0, 6.3], [5.0, -15.4, 6.0], [12.0, -16.2, 4.2], [16.8, -16.6, 2.6], [16.8, -17.0, 2.1]]);
  // transistor emitter -> GND (pin 13)
  route('w_q_e', C.black, [[14.2, -17.0, 2.1], [14.0, -16.3, 4.4], [6.0, -15.8, 5.5], [3.2, -12.0, 5.4], [3.0, 4.0, 5.4], up(pp(13), 0.6), pp(13)]);
  // GP15 (pin 20) -> 1 kOhm -> transistor base
  route('w_gp15', C.green, [pp(20), up(pp(20), 0.7), [2.4, 20.0, 5.6], [2.4, -12.0, 5.1], [4.6, -16.6, 3.8], [6.45, -17.4, 2.5]]);
  route('w_r_base', C.green, [[12.55, -17.4, 2.5], [14.0, -16.9, 3.1], [15.5, -16.8, 2.6], [15.5, -17.0, 2.1]]);
  // 1N5817 stripe end -> VSYS (pin 39), across the Pico
  route('w_vsys', C.red, [[4.8, -22.5, 2.95], [4.0, -21.2, 5.4], [1.0, -20.3, 6.5], [-10.0, -20.3, 6.6],
    [-16.6, -20.7, 6.2], up(pp(39), 0.6), pp(39)]);

  // ---------------- up through the tray (step 7) ----------------
  const mp = (n) => mpuPin(L, n);
  const lanes = { VCC: -18.0, GND: -18.45, SCL: -18.9, SDA: -19.3, INT: -18.7 };
  const mpuWire = (id, color, pin, name, zr) => {
    const a = pp(pin), b = mp(name), x = lanes[name];
    route(id, color, [a, up(a, 0.7), [x, a[1] + 1.2, zr], [x, b[1] - 1.6, zr], [x, b[1] - 0.4, b[2] - 0.6], b]);
  };
  mpuWire('w_mpu_vcc', C.red, 36, 'VCC', 6.0);
  mpuWire('w_mpu_gnd', C.black, 33, 'GND', 6.3);
  mpuWire('w_mpu_scl', C.blue, 32, 'SCL', 6.0);
  mpuWire('w_mpu_sda', C.yellow, 31, 'SDA', 6.4);
  mpuWire('w_mpu_int', C.grey, 34, 'INT', 6.6);
  // TP4056 OUT- -> GND (pin 38): down from the pad's underside through the slot / channel
  const outm = tpPad(L, 'OUT-', true), outp = tpPad(L, 'OUT+', true);
  route('w_tp_outm', C.black, [outm, [outm[0], outm[1] - 0.3, 6.6], [-18.5, -6.0, 6.2], [-18.5, -17.6, 6.0], up(pp(38), 0.7), pp(38)]);
  // TP4056 OUT+ -> switch middle leg, under the tray
  const swMid = [L.sw_x_c, L.sw_y0 + 2.2, L.tray_z0 - 1.1], swOut = [L.sw_x_c + 2, L.sw_y0 + 2.2, L.tray_z0 - 1.1];
  route('w_tp_outp', C.red, [outp, [outp[0], outp[1] - 0.3, 6.6], [1.5, -8.0, 6.6], [7.8, -19.5, 6.5], [swMid[0] - 0.4, swMid[1] + 0.8, 6.3], swMid]);
  // switch outer leg -> 1N5817 (end without the stripe)
  route('w_sw_out', C.red, [swOut, [swOut[0] + 0.6, swOut[1] + 0.4, 4.8], [13.4, -22.6, 3.6], [13.2, -22.5, 2.95]]);

  // ---------------- battery -> B+ / B- (step 9) ----------------
  const bp = tpPad(L, 'B+'), bm = tpPad(L, 'B-');
  const bx0 = L.bat_x0 + 0.25, zl = L.tray_z1 + 0.4 + 2.2;
  route('w_bat_red', C.red, [[bx0 - 0.4, L.bat_y1 + 0.6, zl + 0.5], [-1.7, L.bat_y1 - 0.5, zl + 0.7], [-1.7, 6.0, zl + 0.6],
    [-2.4, 2.4, zl + 0.3], [bp[0] + 1.0, bp[1] + 1.0, bp[2] + 0.8], bp]);
  route('w_bat_black', C.black, [[bx0 - 0.2, L.bat_y1 + 1.5, zl + 0.6], [-1.3, L.bat_y1 + 0.2, zl + 1.0], [-1.3, 5.0, zl + 1.0],
    [-3.0, 2.0, zl + 0.8], [bm[0] + 1.0, bm[1] + 1.2, bm[2] + 1.0], bm]);

  return wires;
}
