// Wires, following the pin map in the assembly guide (page 5).
// Routes are drawn as tubes that "draw on" (pose key k: 0..1). They are the
// routes checked for clashes in cad/wires.py, but your wires
// will bend differently.

import * as THREE from 'three';
import { picoPin, picoPinLocal, maxPin, mpuPin, tpPad } from './layout.js';
import { WIRE } from './parts.js';

const R = 0.36; // 30 AWG silicone wire

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
  const p = L.p;
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
  const leads = (id, parent, list, shape) => {
    const o = P.obj(id, P.objs[parent].home, { parent, kind: 'wire', initial: { o: 0, k: 0 } });
    const meshes = list.map(({ at, color, dir }) => {
      const m = new THREE.Mesh(tube(shape(at, dir)), matFor(o, color));
      m.castShadow = true;
      o.inner.add(m);
      return m;
    });
    o.update = (pose) => meshes.forEach((m) => setDraw(m, pose.k ?? 0));
    wires.push(o);
    return o;
  };
  // a wire that rises off the pin before it bends away
  const rising = (at, dir) => [at, up(at, 2.2), [at[0] + dir[0] * 1.6, at[1] + dir[1] * 1.6, at[2] + 4.2],
    [at[0] + dir[0] * 4.8, at[1] + dir[1] * 4.8, at[2] + 5.2]];
  // on the Pico the wires leave the short pin ends sideways, to stay low once it's upside-down
  const flat = (at, dir) => [at, [at[0] + dir[0] * 1.6, at[1] + dir[1] * 1.6, at[2] + 0.1],
    [at[0] + dir[0] * 4.8, at[1] + dir[1] * 4.8, at[2] + 0.3]];

  const C = WIRE;
  const onPin = (n) => { const q = picoPinLocal(L, n); return [q[0], q[1], L.pico_zt + 1.0]; };

  // ---------------- leads (step 4) ----------------
  const picoA = [[6, C.yellow], [7, C.blue], [8, C.black], [9, C.grey], [13, C.black], [18, C.black],
    [19, C.green], [20, C.green]];
  const picoB = [[31, C.yellow], [32, C.blue], [33, C.black], [34, C.grey], [36, C.red], [38, C.black], [39, C.red]];
  leads('lead_pico_a', 'pico', picoA.map(([n, color]) => ({ at: onPin(n), color, dir: [1, 0] })), flat);
  leads('lead_pico_b', 'pico', picoB.map(([n, color]) => ({ at: onPin(n), color, dir: [1, 0] })), flat);
  leads('lead_max', 'max', [['VIN', C.red], ['SCL', C.blue], ['SDA', C.yellow], ['INT', C.grey], ['GND', C.black]]
    .map(([n, color]) => ({ at: maxPin(L, n), color, dir: [1, 0] })), rising);
  leads('lead_mpu', 'mpu', [['VCC', C.red], ['GND', C.black], ['SCL', C.blue], ['SDA', C.yellow], ['INT', C.grey]]
    .map(([n, color]) => ({ at: mpuPin(L, n), color, dir: [-1, 0] })), rising);

  // ---------------- shared route pieces ----------------
  const pin = (i) => L.pico_y0 + p.pico_pin1_from_end + i * p.pico_pin_pitch;
  const PI = (n) => picoPin(L, n);
  const lane = L.row_wall - 1.25;   // along the inside of the wall-side pin row
  const zl = 2.0, zx = 1.45, zu = L.pico_zb - 0.45;
  const xe = -0.45;                 // just inside the Pico edge
  const zt2 = L.tray_z1;
  const gapF = pin(0) + 1.27;       // between pins 1 and 2
  const gapM = pin(15) + 1.27;      // between pins 16 and 17

  // wall-row short end, along the lane, under the Pico, out at the sensor side
  const under = (n, yc) => {
    const t = PI(n);
    return [t, [lane, t[1], zl], [lane, yc, zl], [lane - 0.6, yc, zx], [-0.9, yc, zx], [-2.0, yc, zl]];
  };
  const mp = (name) => { const q = mpuPin(L, name); return [q[0], q[1], q[2] - 0.3]; };
  const toMpu = (name) => {
    const q = mp(name);
    return [[-2.0, 14.6, 3.0], [-2.0, 14.6, 9.0], [L.row_in, gapM, 9.7], [2.2, gapM, 11.0], [2.2, q[1], 11.0], q];
  };

  // ---------------- layer 1 (step 6) ----------------
  const mx = (n) => { const q = maxPin(L, n); return [q[0], q[1], q[2] - 0.3]; };
  const maxTo = (name, n) => {
    const m = mx(name), t = PI(n);
    return [m, up(m, 0.6), [-3.0, (m[1] + t[1]) / 2, 4.4], [-1.6, t[1], zu], [xe, t[1], zu], t];
  };
  route('w_max_sda', C.yellow, maxTo('SDA', 6));
  route('w_max_scl', C.blue, maxTo('SCL', 7));
  route('w_max_int', C.grey, maxTo('INT', 9));
  route('w_max_gnd', C.black, maxTo('GND', 8));
  {
    const m = mx('VIN'), t = PI(36);
    route('w_max_vin', C.red, [m, up(m, 0.6), [-3.0, 2.0, 4.4], [-2.6, -18.0, 3.0], [-2.0, -20.5, zl], [-0.9, -20.5, zx],
      [lane - 0.6, -20.5, zx], [lane, -20.5, zl], [lane, t[1], zl], t]);
  }
  // push button legs -> GP14 (pin 19) and GND (pin 18)
  const b = L.btn_cx;
  {
    const t = PI(19);
    route('w_btn_sig', C.green, [[b + 4.45, 22.0, 5.5], [-3.0, 22.2, 4.6], [-1.6, t[1], zu], [xe, t[1], zu], t]);
  }
  {
    const t = PI(18);
    route('w_btn_gnd', C.black, [[b - 4.45, 22.0, 5.5], [b - 5.1, 22.0, 5.6], [b - 5.1, 17.9, 5.0], [-3.0, 18.0, 4.6],
      [-1.6, t[1], zu], [xe, t[1], zu], t]);
  }
  // coin motor: red + joins MAX VIN (3V3), blue - to the transistor collector
  const q = [-16.0, -19.7, 2.6];
  const mz = L.motor_z0 + p.motor_t + 0.7, mxx = L.motor_cx + p.motor_d / 2 + 0.4;
  route('w_mot_red', C.red, [[mxx, L.motor_cy - 0.6, mz], [-5.0, 9.0, 5.0], [-6.6, 4.9, 5.0], mx('VIN')]);
  route('w_mot_blue', C.grey, [[mxx, L.motor_cy + 0.6, mz], [-3.6, 10.0, 5.6], [-3.6, -15.0, 5.6], [-14.5, -19.0, 5.2],
    [-16.0, -19.4, 4.4], q]);
  // transistor emitter -> GND (pin 13)
  {
    const t = PI(13);
    route('w_q_e', C.black, [q, [-15.6, -19.2, 5.2], [-4.0, -16.0, 5.4], [-3.0, 5.0, 5.0], [-1.6, t[1], zu], [xe, t[1], zu], t]);
  }
  // GP15 (pin 20) -> 1 kOhm -> transistor base
  {
    const t = PI(20);
    route('w_gp15', C.green, [t, [xe, t[1], zu], [-1.6, t[1], zu], [-2.6, 20.0, 5.0], [-3.0, -14.0, 5.4], [-6.0, -19.0, 4.6],
      [-7.5, -19.5, 2.7]]);
  }
  route('w_r_base', C.green, [[-13.1, -19.5, 2.7], [-13.6, -19.4, 3.6], [-15.6, -19.4, 3.6], q]);
  // 1N5817 stripe end -> VSYS (pin 39), under the Pico
  {
    const t = PI(39);
    route('w_vsys', C.red, [[-3.5, -23.0, 2.95], [-2.6, -21.6, 2.6], [-0.9, -20.05, zx], [lane - 0.6, -20.05, zx],
      [lane, -20.05, zl], [lane, t[1], zl], t]);
  }

  // ---------------- up through the tray (step 7) ----------------
  route('w_mpu_sda', C.yellow, [...under(31, 12.1), ...toMpu('SDA')]);
  route('w_mpu_scl', C.blue, [...under(32, 12.5), ...toMpu('SCL')]);
  route('w_mpu_gnd', C.black, [...under(33, 12.9), ...toMpu('GND')]);
  route('w_mpu_int', C.grey, [...under(34, 12.1), ...toMpu('INT')]);
  route('w_mpu_vcc', C.red, [...under(36, 12.5), ...toMpu('VCC')]);

  const leg = (dx) => [L.sw_x_c + dx, L.sw_y0 + 2.2, zt2 - 1.8];
  const op = tpPad(L, 'OUT+'), om = tpPad(L, 'OUT-'), bp = tpPad(L, 'B+'), bm = tpPad(L, 'B-');
  const across = [[3.0, -0.5, 11.2], [3.0, -21.0, 11.2], [2.6, gapF, 10.6], [L.row_in, gapF, 10.0], [-1.5, gapF, 9.8]];
  // TP4056 OUT+ -> switch middle leg
  route('w_tp_outp', C.red, [op, [op[0], op[1], 11.2], ...across, [-3.4, gapF, 9.0], [-3.4, gapF, 6.6], [-6.5, -22.6, 5.6],
    [-9.6, -22.6, 5.8], leg(0)]);
  // TP4056 OUT- -> GND (pin 38), down the switch slot and under the Pico
  {
    const t = PI(38);
    route('w_tp_outm', C.black, [om, [om[0], om[1], 11.2], ...across, [-2.9, gapF, 9.0], [-2.9, gapF, 6.0], [-2.2, -21.2, 2.6],
      [-0.9, -20.95, zx], [lane - 0.6, -20.95, zx], [lane, -20.95, zl], [lane, t[1], zl], t]);
  }
  // switch outer leg -> 1N5817 (end without the stripe)
  route('w_sw_out', C.red, [leg(2), [-8.0, -22.9, 5.2], [-12.5, -22.9, 5.0], [-12.6, -23.0, 3.0], [-12.1, -23.05, 2.95]]);

  // ---------------- battery -> B+ / B- (step 9) ----------------
  const zb = L.tray_z1 + 0.4 + 2.0;
  const batTo = (x, pad) => [[x, L.bat_y1 + 0.1, zb], [x, 13.4, zb], [-2.0, 14.6, zb - 0.2], [L.row_in, gapM, zb - 0.1],
    [2.4, gapM, 12.6], [5.0, 10.0, 12.6], [pad[0], 4.0, 12.6], [pad[0], 1.6, 11.4], pad];
  route('w_bat_red', C.red, batTo(-11.0, bp));
  route('w_bat_black', C.black, batTo(-13.0, bm));

  return wires;
}
