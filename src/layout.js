// Every position in the visualizer comes from here.
// This is a straight port of `Layout` in cad-source/model.py (v1, 3 Nov 2026),
// so the stand-in parts sit exactly where the CAD model put them.
//
// Axes (as worn, same as the CAD model):
//   X  across the wrist (lugs on the -X / +X faces)
//   Y  along the forearm: -Y = ports side (elbow), +Y = button side (hand)
//   Z  up; z = 0 is the case bottom (skin side), the sensor bump goes below 0
// All lengths in mm.

export const PARAMS = {
  // Raspberry Pi Pico 2 W (datasheet)
  pico_L: 51.0, pico_W: 21.0, pico_t: 1.0, pico_hole_d: 2.1, pico_hole_dx: 11.4,
  pico_hole_from_end: 2.0, pico_row_dx: 17.78, pico_pin_pitch: 2.54,
  pico_pin1_from_end: (51.0 - 48.26) / 2, pico_usb_w: 8.0, pico_usb_overhang: 1.3,
  pico_ant_w: 14.0, pico_ant_l: 9.0, pico_top_h: 3.2, pico_usb_h: 3.2,
  // MPU-6050 GY-521
  mpu_L: 20.26, mpu_W: 15.56, mpu_hole_d: 3.0, mpu_hole_from_top: 2.54, mpu_t: 1.6,
  mpu_top_h: 2.0, mpu_hole_x: 12.5,
  // MAX30102 module (board size is an estimate, chip from the datasheet)
  max_L_est: 17.9, max_W_est: 12.1, max_L: 19.2, max_W: 13.4, max_t: 1.6,
  max_chip_L: 5.6, max_chip_W: 3.3, max_chip_h: 1.55, max_chip_cx: 10.5, max_chip_cy: 6.1,
  max_tall_h: 1.9,
  // parts to buy
  tp_L: 29.0, tp_W: 17.3, tp_t: 1.6, tp_h: 5.2, tp_usbc_w: 9.0, tp_usbc_h: 3.3, tp_usbc_over: 0.6,
  bat_T: 4.0, bat_W: 20.0, bat_L: 30.0, bat_L_real: 32.5, bat_W_real: 20.5,
  motor_d: 10.0, motor_t: 2.7,
  btn_body: 6.2, btn_total_h: 5.0, btn_plunger_d: 3.6, btn_plunger_h: 1.5,
  sw_L: 8.7, sw_W: 4.4, sw_H: 4.7, sw_knob_w: 2.0, sw_knob_out: 3.0, sw_travel: 2.5,
  // standards
  strap_w: 22.0, sb_tip_d: 0.9, sb_body_d: 1.8, screw_head_d: 4.0, screw_head_h: 1.6,
  // design choices
  c: 0.3, wall: 1.8, floor: 1.6, lid_t: 1.6, tray_t: 0.8, stub: 1.5, wire_h: 2.6, standoff: 1.0,
  boss_h: 1.0, film: 0.5, bat_swell: 0.7, corner_r: 5.0, ear_len: 5.0, ear_w: 6.5, sb_z: 3.5,
  sb_hole_d: 1.25, sb_hole_depth: 2.2, pilot_d: 1.6, screw_clear_d: 2.4,
};

export function computeLayout(p = PARAMS) {
  const L = { p };
  const c = p.c;
  // columns
  L.colA_w = p.pico_W + 2 * c;
  L.gap = 1.0;
  L.colB_w = Math.max(p.max_W, p.motor_d, p.btn_body) + 2 * c;
  const l2_need = (p.tp_W + 2 * c) + (p.bat_W_real + 2 * c) + 0.4;
  L.X_in = Math.max(L.colA_w + L.gap + L.colB_w, l2_need);
  // length (Pico driven)
  L.usb_recess = 0.2;
  const pcb_end_from_outer = L.usb_recess + p.pico_usb_overhang;
  L.Y_in = (pcb_end_from_outer + p.pico_L + c) - p.wall;
  L.X_out = L.X_in + 2 * p.wall;
  L.Y_out = L.Y_in + 2 * p.wall;
  L.X0 = -L.X_in / 2; L.Y0 = -L.Y_in / 2; L.X1 = -L.X0; L.Y1 = -L.Y0;
  // Pico
  L.pico_x0 = L.X0 + c;
  L.pico_x1 = L.pico_x0 + p.pico_W;
  L.pico_cx = (L.pico_x0 + L.pico_x1) / 2;
  L.pico_y0 = -L.Y_out / 2 + pcb_end_from_outer;
  L.pico_y1 = L.pico_y0 + p.pico_L;
  L.z_floor = p.floor;
  L.pico_zb = p.floor + p.standoff;
  L.pico_zt = L.pico_zb + p.pico_t;
  L.pico_top = L.pico_zt + Math.max(p.pico_top_h, p.wire_h);
  // column B (layer 1)
  L.colB_x0 = L.X1 - L.colB_w;
  L.colB_cx = (L.colB_x0 + L.X1) / 2;
  L.max_cx = L.colB_cx;
  const film_floor = -p.boss_h + p.film + 0.2 + p.max_tall_h;
  L.max_zb = film_floor;
  L.max_zt = L.max_zb + p.max_t;
  L.chip_face_z = L.max_zb - p.max_chip_h;
  L.chip_recess = L.chip_face_z + p.boss_h;
  L.btn_depth = p.btn_total_h;
  L.btn_y_front = L.Y1 - 0.5;
  L.btn_y_back = L.btn_y_front - L.btn_depth;
  L.btn_cx = L.colB_cx;
  L.btn_z0 = p.floor;
  L.btn_z1 = p.floor + p.btn_body;
  L.btn_cradle_y0 = L.btn_y_back - 1.6;
  L.motor_cx = L.colB_cx;
  L.motor_cy = L.btn_cradle_y0 - 0.4 - (p.motor_d / 2 + 0.3);
  const motor_y0 = L.motor_cy - p.motor_d / 2 - 0.3;
  L.max_cy = Math.min(-1.0, motor_y0 - 0.6 - 0.15 - 0.9 - (p.max_L + 2 * c) / 2);
  L.seat_w = p.max_W + 2 * c;
  L.seat_l = p.max_L + 2 * c;
  L.seat_x0 = L.X1 - L.seat_w;
  L.seat_y0 = L.max_cy - L.seat_l / 2;
  L.plug_x0 = L.seat_x0 - 0.9; L.plug_x1 = L.X1 - 0.15;
  L.plug_y0 = L.seat_y0 - 0.9; L.plug_y1 = L.seat_y0 + L.seat_l + 0.9;
  L.bump_x0 = L.plug_x0 - 1.5;
  L.bump_x1 = Math.min(L.plug_x1 + 1.5, L.X_out / 2 - 1.6);
  L.bump_y0 = L.plug_y0 - 1.5; L.bump_y1 = L.plug_y1 + 1.5;
  L.chip_x = L.seat_x0 + p.max_chip_cy;
  L.chip_y = L.seat_y0 + p.max_chip_cx;
  L.motor_pocket = 0.8;
  L.motor_z0 = p.floor - L.motor_pocket;
  L.small_y0 = L.Y0;
  L.small_y1 = L.max_cy - p.max_L / 2 - c;
  // tray
  const l1_tops = [L.pico_top, L.pico_zt + p.pico_usb_h, L.max_zt + p.wire_h, L.motor_z0 + p.motor_t];
  L.tray_z0 = Math.max(...l1_tops) + 0.3;
  L.tray_z1 = L.tray_z0 + p.tray_t;
  // layer 2
  L.tp_x0 = L.X0 + c;
  L.tp_x1 = L.tp_x0 + p.tp_W;
  L.tp_cx = (L.tp_x0 + L.tp_x1) / 2;
  L.tp_y0 = -L.Y_out / 2 + 0.2 + p.tp_usbc_over;
  L.tp_y1 = L.tp_y0 + p.tp_L;
  L.tp_zb = L.tray_z1;
  L.mpu_x0 = L.X0 + c;
  L.mpu_y0 = L.tp_y1 + 0.6;
  L.mpu_zb = L.tray_z1 + p.standoff;
  L.sw_x_c = L.X1 - (p.bat_W + 2 * c) / 2;
  L.sw_y0 = L.Y0;
  L.bat_x1 = L.X1 - c;
  L.bat_x0 = L.bat_x1 - p.bat_W_real;
  L.bat_y0 = L.Y0 + p.sw_W + 1.0;
  L.bat_y1 = L.bat_y0 + p.bat_L_real;
  L.lid_pocket = p.lid_t - 0.6;
  const l2_tops = [L.tp_zb + p.tp_h - L.lid_pocket, L.tray_z1 + p.bat_T + p.bat_swell,
    L.mpu_zb + p.mpu_t + p.mpu_top_h, L.tray_z1 + p.sw_H];
  L.H = Math.max(...l2_tops) + 0.3;
  L.H_total = L.H + p.lid_t;
  // lugs
  L.ear_y0 = p.strap_w / 2 + 0.1;
  L.ear_y1 = L.ear_y0 + p.ear_w;
  L.ear_x0 = L.X_out / 2 - 1.0;
  L.ear_x1 = L.X_out / 2 + p.ear_len;
  L.sb_x = L.X_out / 2 + 2.5;
  L.screw_x = L.X_out / 2 + 2.5;
  L.screw_y = L.ear_y0 + p.ear_w - 2.6;
  return L;
}

// ---------- pin positions (top of the snipped 1.5 mm stub) ----------

// Pico pins 1-20 run along the +X edge (sensor side), 21-40 along the -X edge
// (wire-channel side). Pin 1 and pin 40 are at the USB end.
export function picoPin(L, n) {
  const p = L.p;
  const side = n <= 20 ? 1 : -1;
  const idx = n <= 20 ? n - 1 : 40 - n;
  return [L.pico_cx + side * p.pico_row_dx / 2, L.pico_y0 + p.pico_pin1_from_end + idx * p.pico_pin_pitch,
    L.pico_zt + p.stub];
}

// MAX30102: 7-pin row along its -X edge (toward the Pico), VIN at the ports (-Y) end.
export const MAX_PINS = ['VIN', 'SCL', 'SDA', 'INT', 'IRD', 'RD', 'GND'];
export function maxPin(L, name) {
  const p = L.p;
  const i = MAX_PINS.indexOf(name);
  const y0 = L.seat_y0 + (p.max_L_est - 6 * 2.54) / 2;
  return [L.seat_x0 + 1.27, y0 + i * 2.54, L.max_zt + p.stub];
}

// MPU-6050 (GY-521): 8-pin row along its -X edge, over the tray's wire channel.
// Its wire side is the bottom, so the stub end is below the board.
export const MPU_PINS = ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'];
export function mpuPin(L, name) {
  const p = L.p;
  const i = MPU_PINS.indexOf(name);
  const y0 = L.mpu_y0 + (p.mpu_L - 7 * 2.54) / 2;
  return [L.mpu_x0 + 1.27, y0 + i * 2.54, L.mpu_zb - p.stub];
}

// TP4056 module: output and battery pads along the far (+Y) end, right over
// the tray's pad slot, so their wires can drop straight through it.
// (Pad order is typical for these modules; check yours.)
export const TP_PADS = { 'OUT-': 0.16, 'B-': 0.38, 'B+': 0.6, 'OUT+': 0.82 };
export function tpPad(L, name, underside = false) {
  const p = L.p;
  return [L.tp_x0 + TP_PADS[name] * p.tp_W, L.tp_y1 - 1.8, underside ? L.tp_zb : L.tp_zb + p.tp_t + 0.1];
}
