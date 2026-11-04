// Every position in the visualizer comes from here.
// This matches `layout()` in cad/build.py, so the stand-in
// parts sit exactly where the CAD model puts them.
//
// Axes (as worn, same as v1):
//   X  across the wrist (lugs on the -X / +X faces)
//   Y  along the forearm: -Y = ports side (elbow), +Y = button side (hand)
//   Z  up; z = 0 is the case bottom (skin side), the sensor bump goes below 0
// All lengths in mm.

export const PARAMS = {
  // Raspberry Pi Pico 2 W (datasheet; micro-USB from the official 3D model)
  pico_L: 51.0, pico_W: 21.0, pico_t: 1.0, pico_hole_d: 2.1, pico_hole_dx: 11.4,
  pico_hole_from_end: 2.0, pico_row_dx: 17.78, pico_pin_pitch: 2.54,
  pico_pin1_from_end: (51.0 - 48.26) / 2, pico_usb_w: 8.0, pico_usb_overhang: 1.3,
  pico_ant_w: 14.0, pico_ant_l: 9.0, pico_usb_h: 2.73, pico_usb_sink: 0.77,
  // Pico header, left whole (estimates: measure these)
  hdr_plastic: 2.5, hdr_long: 6.0, hdr_tail: 2.0,
  // MPU-6050 GY-521
  mpu_L: 20.26, mpu_W: 15.56, mpu_hole_d: 3.0, mpu_hole_from_top: 2.54, mpu_t: 1.6,
  mpu_top_h: 2.0, mpu_hole_x: 12.5,
  // MAX30102 module (board size is an estimate, chip from the datasheet)
  max_L_est: 18.1, max_W_est: 13.6, max_L: 19.2, max_W: 14.0, max_t: 1.6,
  max_chip_L: 5.6, max_chip_W: 3.3, max_chip_h: 1.55, max_chip_cx: 10.5, max_chip_cy: 6.1,
  max_tall_h: 1.9,
  // parts to buy
  tp_L: 29.0, tp_W: 17.0, tp_t: 1.6, tp_h: 5.2, tp_usbc_w: 9.0, tp_usbc_h: 3.3, tp_usbc_over: 0.6,
  bat_T: 4.0, bat_W: 20.0, bat_L: 30.0, bat_L_real: 32.5, bat_W_real: 20.5,
  motor_d: 10.0, motor_t: 2.7,
  btn_body: 6.2, btn_total_h: 5.0, btn_plunger_d: 3.6, btn_plunger_h: 1.5,
  sw_L: 8.7, sw_W: 4.4, sw_H: 4.7, sw_knob_w: 2.0, sw_knob_out: 3.0, sw_travel: 2.5,
  // standards
  strap_w: 22.0, sb_tip_d: 0.9, sb_body_d: 1.8, screw_head_d: 4.0, screw_head_h: 1.6,
  // design choices
  c: 0.3, wall: 1.8, wall_x: 1.2, floor: 1.6, lid_t: 1.6, tray_t: 0.8, stub: 1.5, standoff: 1.0,
  boss_h: 1.0, bat_swell: 0.7, ear_len: 5.0, ear_w: 6.5, sb_z: 3.5,
  x_out: 43.0, y_out: 54.6, h_total: 14.0,
};

export function computeLayout(p = PARAMS) {
  const L = { p };
  // case
  L.X_out = p.x_out; L.Y_out = p.y_out;
  L.X_in = L.X_out - 2 * p.wall_x;
  L.Y_in = L.Y_out - 2 * p.wall;
  L.X0 = -L.X_in / 2; L.Y0 = -L.Y_in / 2; L.X1 = -L.X0; L.Y1 = -L.Y0;
  L.z_floor = p.floor;
  L.H_total = p.h_total;
  L.H = L.H_total - p.lid_t;

  // Pico. The model is built parts-up and then turned 180 degrees about its long
  // axis, through the middle of the PCB, so pico_zb / pico_zt are the same in both.
  L.pico_x1 = L.X1 - 0.2;
  L.pico_x0 = L.pico_x1 - p.pico_W;
  L.pico_cx = (L.pico_x0 + L.pico_x1) / 2;
  L.pico_y0 = -25.7;
  L.pico_y1 = L.pico_y0 + p.pico_L;
  L.pico_zb = 0.82 + 0.1 + p.pico_usb_h;   // component face, which points down when fitted
  L.pico_zt = L.pico_zb + p.pico_t;
  L.pico_mid = (L.pico_zb + L.pico_zt) / 2;
  L.plastic_top = L.pico_zt + p.hdr_plastic;
  L.pin_tip = L.plastic_top + p.hdr_long;
  L.tail_tip = L.pico_zb - p.hdr_tail;
  L.row_in = L.pico_cx - p.pico_row_dx / 2;     // pins 1-20, toward the sensor column
  L.row_wall = L.pico_cx + p.pico_row_dx / 2;   // pins 21-40, along the +X wall
  L.usb_cz = L.pico_zb - (p.pico_usb_h - p.pico_usb_sink) / 2;   // middle of the fitted micro-USB

  // tray, resting on the plastic strips
  L.tray_z0 = L.plastic_top + 0.1;
  L.tray_z1 = L.tray_z0 + p.tray_t;

  // MAX30102: pin row faces the Pico, VIN toward the button side
  L.seat_x1 = -5.7; L.seat_x0 = -20.1;
  L.seat_y1 = 5.75; L.seat_y0 = -14.05;
  L.max_zb = p.floor;
  L.max_zt = L.max_zb + p.max_t;
  L.chip_x = L.seat_x1 - p.max_chip_cy;
  L.chip_y = L.seat_y1 - p.max_chip_cx;
  L.chip_face_z = 0.05;
  L.plug_x0 = -19.4; L.plug_x1 = L.seat_x1 + 0.5;
  L.plug_y0 = L.seat_y0 - 0.6; L.plug_y1 = L.seat_y1 + 0.6;
  L.bump_x0 = -19.9; L.bump_x1 = L.plug_x1 + 1.5;
  L.bump_y0 = L.plug_y0 - 1.5; L.bump_y1 = L.plug_y1 + 1.5;

  // motor and button
  L.motor_cx = -12.7; L.motor_cy = 12.7;
  L.motor_z0 = p.floor - 0.8;
  L.btn_cx = -11.5;
  L.btn_y_front = L.Y1 - 0.5;
  L.btn_y_back = L.btn_y_front - p.btn_total_h;
  L.btn_z0 = p.floor;
  L.btn_z1 = p.floor + p.btn_body;
  L.btn_cradle_y0 = 18.4;

  // layer 2: TP4056 and MPU-6050 between the pin rows
  L.tp_cx = L.pico_cx;
  L.tp_x0 = L.tp_cx - p.tp_W / 2;
  L.tp_x1 = L.tp_cx + p.tp_W / 2;
  L.tp_y0 = -L.Y_out / 2 + 0.2 + p.tp_usbc_over;
  L.tp_y1 = L.tp_y0 + p.tp_L;
  L.tp_zb = L.tray_z1;
  L.mpu_x0 = L.pico_cx - p.mpu_W / 2;
  L.mpu_y0 = L.tp_y1 + 0.6;
  L.mpu_zb = L.tray_z1 + 0.4;
  // battery beside the pins, switch in front of it
  L.bat_x0 = L.X0 + 0.1;
  L.bat_x1 = L.bat_x0 + p.bat_W_real;
  L.bat_y0 = L.Y0 + p.sw_W + 1.0;
  L.bat_y1 = L.bat_y0 + p.bat_L_real;
  L.sw_x_c = (L.bat_x0 + L.bat_x1) / 2;
  L.sw_y0 = L.Y0;

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

// ---------- pin positions ----------

// Where a Pico pin sits on the board itself (parts up, before the flip):
// pins 1-20 on the +X edge, 21-40 on the -X edge, pins 1 and 40 at the USB end.
export function picoPinLocal(L, n) {
  const p = L.p;
  const side = n <= 20 ? 1 : -1;
  const idx = n <= 20 ? n - 1 : 40 - n;
  return [L.pico_cx + side * p.pico_row_dx / 2, L.pico_y0 + p.pico_pin1_from_end + idx * p.pico_pin_pitch,
    L.pico_zt + p.hdr_tail];
}

// Where the wire joins that pin's short end once the Pico is fitted upside-down.
export function picoPin(L, n) {
  const [x, y] = picoPinLocal(L, n);
  return [2 * L.pico_cx - x, y, L.tail_tip + 0.9];
}

// MAX30102: 7-pin row along the edge facing the Pico, VIN at the button (+Y) end.
export const MAX_PINS = ['VIN', 'SCL', 'SDA', 'INT', 'IRD', 'RD', 'GND'];
export function maxPin(L, name) {
  const p = L.p;
  const i = MAX_PINS.indexOf(name);
  const y0 = L.seat_y1 - (p.max_L_est - 6 * 2.54) / 2;
  return [L.seat_x1 - 1.27, y0 - i * 2.54, L.max_zt + p.stub];
}

// MPU-6050 (GY-521): 8-pin row along its -X edge, stubs on top so wires reach it from above.
export const MPU_PINS = ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'];
export function mpuPin(L, name) {
  const p = L.p;
  const i = MPU_PINS.indexOf(name);
  const y0 = L.mpu_y0 + (p.mpu_L - 7 * 2.54) / 2;
  return [L.mpu_x0 + 1.27, y0 + i * 2.54, L.mpu_zb + p.mpu_t + p.stub];
}

// TP4056 module: output and battery pads along the far (+Y) end.
// (Pad order is typical for these modules; check yours.)
export const TP_PADS = { 'OUT-': 0.16, 'B-': 0.38, 'B+': 0.6, 'OUT+': 0.82 };
export function tpPad(L, name) {
  const p = L.p;
  return [L.tp_x0 + TP_PADS[name] * p.tp_W, L.tp_y1 - 1.8, L.tp_zb + p.tp_t + 0.5];
}
