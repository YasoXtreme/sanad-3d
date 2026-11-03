// The assembly, step by step. Step numbers and wording follow
// "Sanad wrist band body - print & assembly guide" (v1, 3 Nov 2026).
//
// Each step has:
//   items   instructions, each with the time (s) its animation starts
//   labels  callouts anchored to a 3D point, shown between t0 and t1
//   hud     readouts drawn over the viewport
//   build   the animation, authored on the shared timeline

import { picoPin, mpuPin, tpPad } from './layout.js';

export const MAT_Z = -1.2; // the cutting mat sits just under the sensor bump

const V = (x, y, z) => [x, y, z];

export function makeSteps(L) {
  const p = L.p;
  const pp = (n) => picoPin(L, n);

  // ---- where the boards sit on the bench (pivot offsets from their home) ----
  const bench = {
    pico: (zBottom) => [-40 - L.pico_cx, -84 - p.pico_L / 2 - L.pico_y0, zBottom - L.pico_zb],
    max: (zBottom) => [0 - (L.seat_x0 + p.max_W_est / 2), -84 - (L.seat_y0 + p.max_L_est / 2), zBottom - L.max_zb],
    mpu: (zBottom) => [36 - (L.mpu_x0 + p.mpu_W / 2), -84 - (L.mpu_y0 + p.mpu_L / 2), zBottom - L.mpu_zb],
  };
  const LONG = 6.0, SHORT = 2.5; // header pins as bought: long side down, short side up

  // ---- exploded view (step 0): everything lifted above the sensor pad ----
  const layer1 = ['pico', 'max', 'motor', 'button', 'd5817', 'q1', 'r1k', 'd4148'];
  const layer2 = ['tp', 'bat', 'sw', 'mpu'];
  const screws = ['screw0', 'screw1', 'screw2', 'screw3'];
  const EXPLODE = { pad: 0, body: 14, tray: 44, kapton: 56, foam_bat: 56, foam_mpu: 56, lid: 80 };
  layer1.forEach((id) => { EXPLODE[id] = 29; });
  layer2.forEach((id) => { EXPLODE[id] = 60; });
  screws.forEach((id) => { EXPLODE[id] = 94; });
  const everything = [...Object.keys(EXPLODE), 'sb_px', 'sb_nx'];

  const chipY = L.chip_y;
  const knob = V(L.sw_x_c, L.sw_y0 - p.sw_knob_out, L.tray_z1 + p.sw_H / 2);

  return [
    // ------------------------------------------------------------------ 0
    {
      num: '00', title: 'The band, exploded', dur: 9,
      items: [
        { t: 0, html: 'Four printed parts: <b>body</b>, <b>sensor pad</b>, <b>tray</b> and <b>lid</b>. No supports needed.' },
        { t: 1.2, html: 'Two layers of electronics inside, with the tray between them. The lid is held by 4 × M2 × 6 self-tapping screws.' },
        { t: 4.0, html: 'Work in this order: <b>the case first, then layer 1 on the floor, then the tray, then layer 2, then the lid.</b> Test before you close anything (Steps 6 and 9).' },
      ],
      extra: `
        <dl class="spec">
          <div><dt>Body</dt><dd>43.0 × 54.6 × 14.5 mm, + 1.0 mm sensor bump</dd></div>
          <div><dt>Strap</dt><dd>Any 22 mm quick-release strap, lug-to-lug 53 mm</dd></div>
          <div><dt>Print</dt><dd>PETG, 0.12–0.16 mm layers, 4 walls, 40 % infill</dd></div>
          <div><dt>Colours</dt><dd>Lid white or natural (charge light shows through), sensor pad black</dd></div>
        </dl>
        <p class="note">Built from conservative estimates: the MAX30102 board, chip position and component heights are not caliper-measured yet. Pockets are slightly roomy and get fixed with hot glue or foam tape.</p>`,
      labels: [
        { t0: 4.2, t1: 9, obj: 'lid', at: V(-14, 0, L.H_total), text: 'Lid · white or natural' },
        { t0: 4.2, t1: 9, obj: 'tp', at: V(L.tp_cx, -8, L.tp_zb + 1.6), text: 'Layer 2 · TP4056, battery, switch, MPU-6050' },
        { t0: 4.2, t1: 9, obj: 'tray', at: V(14, 18, L.tray_z1), text: 'Tray' },
        { t0: 4.2, t1: 9, obj: 'pico', at: V(L.pico_cx, 6, L.pico_zt), text: 'Layer 1 · Pico 2 W, MAX30102, motor, button' },
        { t0: 4.2, t1: 9, obj: 'body', at: V(L.X_out / 2, -8, 7), text: 'Body with lugs' },
        { t0: 4.2, t1: 9, obj: 'pad', at: V(L.bump_x1, -4, -0.5), text: 'Sensor pad · black' },
      ],
      build(a) {
        a.cam(0, 1.2, { t: V(0, 0, 6), az: -58, el: 28, d: 150 });
        a.cam(1.2, 4.2, { t: V(0, 0, 46), az: -42, el: 20, d: 300 });
        a.cam(4.2, 9, { t: V(0, 0, 46), az: -18, el: 22, d: 300 }, 'linear');
        let k = 0;
        for (const [id, dz] of Object.entries(EXPLODE)) {
          a.to(id, 1.2 + k * 0.05, 4.0 + k * 0.05, { p: V(0, 0, dz) });
          k++;
        }
        a.to('sb_px', 1.4, 3.8, { p: V(12, 0, 14) });
        a.to('sb_nx', 1.4, 3.8, { p: V(-12, 0, 14) });
      },
    },

    // ------------------------------------------------------------------ 1
    {
      num: '01', title: 'Clean up and check the print', dur: 16,
      items: [
        { t: 0, html: 'Remove any strings or brim.' },
        { t: 1.2, html: 'Run a <b>1.6 mm</b> drill by hand into the four screw holes on top of the lugs, and a <b>1.2 mm</b> drill into the four spring-bar holes on the inner faces of the lugs.' },
        { t: 8.6, html: 'Press the button tab on the side wall: it must flex a little and spring back. If a thin skin closed one of its U-slots, open it with a craft knife.' },
        { t: 12.4, html: 'Check the four small locating pins on the floor are complete, and that the floor hole for the sensor pad is clean.' },
      ],
      labels: [
        { t0: 1.4, t1: 8.4, at: V(L.screw_x, -L.screw_y, L.H), text: 'Screw holes · 1.6 mm drill' },
        { t0: 1.4, t1: 8.4, at: V(L.sb_x, L.ear_y0, p.sb_z), text: 'Spring-bar holes · 1.2 mm drill' },
        { t0: 9.6, t1: 12.2, at: V(L.btn_cx, L.Y_out / 2, L.btn_z0 + p.btn_body / 2 + 1), text: 'Button tab · must flex freely' },
        { t0: 13.4, t1: 16, at: V(L.pico_cx - p.pico_hole_dx / 2, L.pico_y0 + 2, L.pico_zb + 0.8), text: 'Pico locating pins' },
        { t0: 13.4, t1: 16, at: V(12.2, -4, L.z_floor), text: 'Hole for the sensor pad' },
        { t0: 13.4, t1: 16, at: V(L.motor_cx, L.motor_cy, L.motor_z0), text: 'Motor pocket' },
        { t0: 13.4, t1: 16, at: V(L.X1 - 0.5, 0, L.tray_z0 - 0.5), text: 'Tray ledges' },
        { t0: 13.4, t1: 16, at: V(L.btn_cx, L.btn_cradle_y0 + 0.6, L.btn_z1), text: 'Button holder' },
      ],
      build(a) {
        a.cam(0, 1.4, { t: V(0, 0, 6), az: -55, el: 46, d: 132 });
        // everything but the body leaves; reset what later steps change
        a.fadeOut(everything.filter((id) => id !== 'body'), 0, 0.8);
        a.to('body', 0, 1.0, { p: V(0, 0, 0) });
        a.set('r_old', 0.9, { o: 1 });
        a.set('r_new', 0.9, { o: 0 });
        // drill the four screw holes
        const holes = [[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sx, sy]) => [sx * L.screw_x, sy * L.screw_y]);
        a.set('drill', 1.0, { p: V(holes[0][0], holes[0][1], 34), o: 0, r: V(0, 0, 0) });
        a.to('drill', 1.0, 1.3, { o: 1 }, 'linear');
        let t = 1.3, spin = 0;
        for (const [x, y] of holes) {
          a.to('drill', t, t + 0.5, { p: V(x, y, L.H + 6) }); t += 0.5;
          spin += 1080;
          a.to('drill', t, t + 0.7, { p: V(x, y, L.H - 3.2), r: V(0, 0, spin) }); t += 0.7;
          spin += 540;
          a.to('drill', t, t + 0.45, { p: V(x, y, L.H + 6), r: V(0, 0, spin) }); t += 0.45;
        }
        a.to('drill', t, t + 0.4, { o: 0, p: V(holes[3][0], holes[3][1], 30) }, 'linear');
        // press the button tab
        a.cam(8.4, 9.6, { t: V(L.btn_cx - 2, L.Y_out / 2, 5), az: 68, el: 20, d: 78 });
        a.press(9.4, [[10.2, 10.6], [10.9, 11.3]], 12.0);
        // look inside
        a.cam(12.0, 13.4, { t: V(0, 0, 2), az: -90, el: 70, d: 118 });
      },
    },

    // ------------------------------------------------------------------ 2
    {
      num: '02', title: 'Fit the sensor pad', dur: 10,
      items: [
        { t: 0, html: 'Push the black sensor pad into the floor hole <b>from the outside</b>, bump facing out, until its rim sits flat against the bottom of the case. Its three low fences end up inside the case.' },
        { t: 5.2, html: 'Fix it with a few drops of super glue around the plug, inside the case. Keep glue out of the window.' },
      ],
      labels: [
        { t0: 1.2, t1: 2.6, at: V(12.2, -4, 0), text: 'Hole in the floor' },
        { t0: 2.6, t1: 4.6, obj: 'pad', at: V((L.bump_x0 + L.bump_x1) / 2, L.bump_y0 + 2, -p.boss_h), text: 'Sensor pad · bump faces out' },
        { t0: 6.2, t1: 10, obj: 'glue_pad', at: V(L.plug_x0 - 0.4, -9, L.z_floor + 0.4), text: 'Super glue around the plug' },
        { t0: 6.6, t1: 10, at: V(L.chip_x, L.chip_y, L.z_floor + 0.4), text: 'Keep glue out of the window' },
      ],
      build(a) {
        a.cam(0, 1.6, { t: V(10, -4, 0), az: -60, el: -36, d: 108 });
        a.set('pad', 0, { p: V(0, 0, -24), o: 0, r: V(0, 0, 0) });
        a.to('pad', 0.6, 1.1, { o: 1 }, 'linear');
        a.to('pad', 1.8, 3.8, { p: V(0, 0, 0) }, 'out');
        a.cam(4.2, 5.4, { t: V(11, -4, 2), az: -76, el: 62, d: 86 });
        a.pop('glue_pad', 5.6);
      },
    },

    // ------------------------------------------------------------------ 3
    {
      num: '03', title: 'Strip and snip the pin headers', dur: 11,
      items: [
        { t: 0, html: 'Wear safety glasses. On each board, prise the black plastic strip up and off the pins: work a flat screwdriver under it, or nibble it apart with flush cutters.' },
        { t: 3.8, html: 'Snip the pins. On the side that will get wires, leave a <b>1.5 mm</b> stub. On the other side, snip <b>flush</b>.' },
        { t: 7.2, html: 'Re-touch every joint with the iron afterwards, because snipping can crack them.' },
      ],
      extra: `
        <div class="tbl"><table>
          <thead><tr><th>Board</th><th>Wire side · 1.5 mm stubs</th><th>Flush side</th></tr></thead>
          <tbody>
            <tr><td>Pico 2 W</td><td>top (component side)</td><td>bottom, rests on 1 mm pads</td></tr>
            <tr><td>MAX30102</td><td>back (the plain side)</td><td><b>sensor side: must be flush</b></td></tr>
            <tr><td>MPU-6050</td><td>bottom (wires drop into the channel)</td><td>top</td></tr>
          </tbody></table></div>`,
      labels: [
        { t0: 2.0, t1: 3.6, obj: 'max_strip', at: V(L.seat_x0 + 1.27, -6, L.max_zb - 2.5), text: 'Plastic strip off' },
        { t0: 5.8, t1: 11, obj: 'pico', at: pp(30), text: 'Pico 2 W · top stubs, bottom flush' },
        { t0: 5.8, t1: 11, obj: 'max', at: V(L.seat_x0 + 1.27, L.seat_y0 + 16, L.max_zt + 1.5), text: 'MAX30102 · sensor side flush' },
        { t0: 5.8, t1: 11, obj: 'mpu', at: V(L.mpu_x0 + 1.27, L.mpu_y0 + 16, L.mpu_zb - 1.5), text: 'MPU-6050 · bottom stubs, top flush' },
      ],
      build(a) {
        a.cam(0, 1.6, { t: V(-3, -88, 0), az: -90, el: 40, d: 190 });
        a.set('pico', 0, { p: bench.pico(MAT_Z + LONG), r: V(0, 0, 0), o: 0, pt: SHORT, pb: LONG });
        a.set('max', 0, { p: bench.max(MAT_Z + LONG), r: V(0, 0, 0), o: 0, pt: SHORT, pb: LONG });
        // the MPU lies wire side (bottom) up, resting on its short pins
        a.set('mpu', 0, { p: bench.mpu(MAT_Z + SHORT + p.mpu_t), r: V(0, 180, 0), o: 0, pt: SHORT, pb: LONG });
        for (const s of ['pico_strip', 'max_strip', 'mpu_strip']) a.set(s, 0, { o: 1, p: V(0, 0, 0) });
        for (const id of ['pico', 'max', 'mpu']) a.to(id, 0.2, 1.0, { o: 1 }, 'linear');
        a.to('pico_strip', 2.0, 3.4, { p: V(0, 0, -9), o: 0 });
        a.to('max_strip', 2.15, 3.55, { p: V(0, 0, -9), o: 0 });
        a.to('mpu_strip', 2.3, 3.7, { p: V(0, 0, -9), o: 0 });
        a.to('pico', 4.0, 5.6, { pt: p.stub, pb: 0, p: bench.pico(MAT_Z) });
        a.to('max', 4.2, 5.8, { pt: p.stub, pb: 0, p: bench.max(MAT_Z + 1.9) });
        a.to('mpu', 4.4, 6.0, { pt: 0, pb: p.stub, p: bench.mpu(MAT_Z + 0.9 + p.mpu_t) });
        a.cam(6.0, 7.4, { t: V(-3, -86, 0), az: -98, el: 52, d: 172 });
      },
    },

    // ------------------------------------------------------------------ 4
    {
      num: '04', title: 'Pre-wire the boards', dur: 8,
      items: [
        { t: 0, html: 'Solder wires to each board using the pin map below. Cut each wire about 15 mm longer than the straight-line distance; you can shorten them during assembly.' },
        { t: 2.6, html: 'Use one colour per signal: red 3V3, black GND, yellow SDA, blue SCL. Slide heat-shrink onto any splice before you solder it.' },
      ],
      extra: `
        <div class="tbl"><table>
          <thead><tr><th>Part</th><th>Pico 2 W pins</th></tr></thead>
          <tbody>
            <tr><td>MAX30102</td><td>I²C0: SDA GP4 (6), SCL GP5 (7), INT GP6 (9), VIN 3V3 (36), GND (8)</td></tr>
            <tr><td>MPU-6050</td><td>I²C1: SDA GP26 (31), SCL GP27 (32), INT GP28 (34), VCC 3V3 (36), GND (33)</td></tr>
            <tr><td>Button</td><td>GP14 (19) and GND (18), internal pull-up</td></tr>
            <tr><td>Motor</td><td>GP15 (20) → 1 kΩ → transistor base; emitter to GND (13); motor + to 3V3</td></tr>
            <tr><td>Power</td><td>TP4056 OUT+ → switch → 1N5817 → VSYS (39); OUT− → GND (38)</td></tr>
          </tbody></table></div>`,
      hud: [{ t0: 0.6, t1: 8, kind: 'legend' }],
      labels: [
        { t0: 3.4, t1: 8, obj: 'pico', at: pp(13), text: 'Pins 6–9, 13, 18–20' },
        { t0: 3.4, t1: 8, obj: 'pico', at: pp(34), text: 'Pins 31–34, 36, 38, 39' },
        { t0: 4.2, t1: 8, obj: 'max', at: V(L.seat_x0 + 1.27, L.seat_y0 + 9, L.max_zt + 3), text: 'VIN, SCL, SDA, INT, GND' },
        { t0: 4.6, t1: 8, obj: 'mpu', at: V(L.mpu_x0 + 4, L.mpu_y0 + 9, L.mpu_zb - 4), text: 'VCC, GND, SCL, SDA, INT' },
      ],
      build(a) {
        a.cam(0, 1.4, { t: V(-3, -86, 0), az: -100, el: 56, d: 160 });
        a.draw('lead_pico_a', 0.8, 2.8);
        a.draw('lead_pico_b', 1.2, 3.2);
        a.draw('lead_max', 2.0, 3.6);
        a.draw('lead_mpu', 2.6, 4.2);
      },
    },

    // ------------------------------------------------------------------ 5
    {
      num: '05', title: 'Layer 1: Pico, sensor, motor, button', dur: 16,
      items: [
        { t: 0, html: '<b>Pico 2 W</b>, components up: tilt it, lower the USB end first and slide the micro-USB into its opening on the ports side; the board’s end slips into a slot under the opening. Then lower the far end onto the four locating pins.' },
        { t: 4.8, html: '<b>MAX30102</b>, <b>sensor face DOWN</b>, pin row toward the Pico, VIN end toward the ports side. Push it into that corner of the fences. Fix the board edges with hot glue; never on the chip.' },
        { t: 8.2, html: '<b>Coin motor</b> into its round pocket, wires up, held with a drop of hot glue.' },
        { t: 9.6, html: '<b>Push button</b> into its holder with the plunger against the wall, touching the nub on the button tab, and its two legs pointing left and right. Hot-glue it.' },
        { t: 11.2, html: 'From underneath: the sensor chip must sit in the window. If it doesn’t, slide the board until it does before the glue sets (the window has 1.3 mm of margin each way).' },
      ],
      labels: [
        { t0: 2.4, t1: 4.8, at: V(L.pico_cx, -L.Y_out / 2, L.pico_zt + 1.4), text: 'micro-USB into its opening' },
        { t0: 6.6, t1: 8.2, at: V(L.seat_x0, L.seat_y0, L.max_zt), text: 'Sensor down · push into this corner' },
        { t0: 8.8, t1: 9.8, obj: 'motor', at: V(L.motor_cx, L.motor_cy, L.motor_z0 + p.motor_t), text: 'Coin motor · wires up' },
        { t0: 10.4, t1: 11.4, obj: 'button', at: V(L.btn_cx, L.btn_y_front, (L.btn_z0 + L.btn_z1) / 2), text: 'Plunger to the wall' },
        { t0: 12.8, t1: 16, at: V(L.chip_x, L.chip_y, -p.boss_h), text: 'Sensor chip centred in the window' },
      ],
      build(a) {
        a.cam(0, 2.0, { t: V(-4, -8, 5), az: -74, el: 50, d: 125 });
        // Pico: USB end first, then lower the far end
        a.to('pico', 0.3, 2.1, { p: V(0, 3.5, 13), r: V(22, 0, 0) });
        a.to('pico', 2.2, 3.0, { p: V(0, 3.5, 0.6) });
        a.to('pico', 3.0, 3.8, { p: V(0, 0, 0.6) });
        a.to('pico', 3.9, 4.8, { p: V(0, 0, 0), r: V(0, 0, 0) });
        // MAX30102: over the seat, down, into the corner
        a.to('max', 4.8, 6.3, { p: V(1.6, 1.6, 12) });
        a.to('max', 6.3, 7.1, { p: V(1.6, 1.6, 0.5) });
        a.to('max', 7.1, 7.7, { p: V(0, 0, 0) });
        a.pop('glue_max', 7.9);
        a.drop('motor', 8.2, 9.3, V(0, 0, 16));
        a.pop('glue_motor', 9.4);
        a.drop('button', 9.6, 10.8, V(0, 0, 14));
        a.pop('glue_btn', 10.9);
        // from underneath
        a.cam(11.2, 12.8, { t: V(L.chip_x - 3, L.chip_y, 0), az: -100, el: -60, d: 92 });
      },
    },

    // ------------------------------------------------------------------ 6
    {
      num: '06', title: 'Small parts, then a first test', dur: 17,
      items: [
        { t: 0, html: 'Put the 1N5817, the transistor with its 1 kΩ resistor, and the 1N4148 in the small-parts corner. Cover every bare lead with heat-shrink or Kapton.' },
        { t: 3.0, html: 'Solder the layer-1 wires: MAX30102 to I²C0, button to GP14, the motor driver to GP15, and the 1N5817 to VSYS.' },
        { t: 7.0, html: 'Plug the Pico into your computer with micro-USB (battery not connected yet) and run the test below in MicroPython.' },
        { t: 12.6, html: 'Press the button tab on the outside of the case. The output should change to <b>pressed</b>.' },
      ],
      extra: `
        <pre class="code"><code>from machine import Pin, I2C
import time
i2c0 = I2C(0, sda=Pin(4), scl=Pin(5), freq=100000)    # MAX30102
i2c1 = I2C(1, sda=Pin(26), scl=Pin(27), freq=100000)  # MPU-6050
print('I2C0', [hex(a) for a in i2c0.scan()])   # expect ['0x57']
print('I2C1', [hex(a) for a in i2c1.scan()])   # expect ['0x68'] (needs the MPU wired)
motor = Pin(15, Pin.OUT); motor.value(1); time.sleep(0.4); motor.value(0)
btn = Pin(14, Pin.IN, Pin.PULL_UP)
while True:
    print('pressed' if btn.value() == 0 else '-'); time.sleep(0.3)</code></pre>`,
      hud: [{ t0: 8.9, t1: 17, kind: 'console', lines: consoleLines() }],
      labels: [
        { t0: 1.4, t1: 6.6, obj: 'd5817', at: V(9.0, -22.5, L.z_floor + 2.7), text: '1N5817' },
        { t0: 2.0, t1: 6.6, obj: 'q1', at: V(15.5, -22.2, L.z_floor + 2.3), text: '2N2222 / S8050' },
        { t0: 2.4, t1: 6.6, obj: 'r1k', at: V(9.5, -17.4, L.z_floor + 1.8), text: '1 kΩ' },
        { t0: 2.8, t1: 6.6, obj: 'd4148', at: V(9.2, -20.0, L.z_floor + 1.7), text: '1N4148' },
        { t0: 8.8, t1: 10.8, obj: 'usb_micro', at: V(L.pico_cx, L.pico_y0 - 14, L.pico_zt + 4.6), text: 'micro-USB: programming' },
        { t0: 11.0, t1: 12.2, obj: 'motor', at: V(L.motor_cx, L.motor_cy, L.motor_z0 + p.motor_t), text: 'Motor buzzes for 0.4 s' },
        { t0: 13.4, t1: 15.0, obj: 'finger', at: V(L.btn_cx, L.Y_out / 2 + 9, L.btn_z0 + p.btn_body / 2 + 3.4), text: 'Press the tab' },
      ],
      build(a) {
        a.cam(0, 1.4, { t: V(9, -16, 3), az: -80, el: 58, d: 92 });
        a.drop('d5817', 0.6, 1.4, V(0, 0, 12));
        a.drop('q1', 1.0, 1.8, V(0, 0, 12));
        a.drop('r1k', 1.4, 2.2, V(0, 0, 12));
        a.drop('d4148', 1.8, 2.6, V(0, 0, 12));
        a.cam(2.8, 4.0, { t: V(2, -4, 4), az: -76, el: 60, d: 112 });
        a.to('lead_pico_a', 3.0, 3.6, { o: 0 }, 'linear');
        a.to('lead_max', 3.0, 3.6, { o: 0 }, 'linear');
        const l1 = ['w_max_sda', 'w_max_scl', 'w_max_int', 'w_max_gnd', 'w_max_vin', 'w_btn_sig', 'w_btn_gnd',
          'w_mot_red', 'w_mot_blue', 'w_q_e', 'w_gp15', 'w_r_base', 'w_vsys'];
        l1.forEach((id, i) => a.draw(id, 3.0 + i * 0.22, 4.2 + i * 0.22));
        // plug in and test
        a.cam(6.8, 8.0, { t: V(-6, -30, 4), az: -70, el: 28, d: 124 });
        a.set('usb_micro', 7.2, { p: V(0, -30, 0), o: 0 });
        a.to('usb_micro', 7.2, 7.6, { o: 1 }, 'linear');
        a.to('usb_micro', 7.6, 8.7, { p: V(0, 0, 0) });
        a.set('motor', 11.0, { buzz: 1 });
        a.set('motor', 11.4, { buzz: 0 });
        a.cam(11.6, 12.8, { t: V(8, 18, 4), az: 52, el: 26, d: 104 });
        a.press(12.6, [[13.6, 14.6]], 15.6);
      },
    },

    // ------------------------------------------------------------------ 7
    {
      num: '07', title: 'Tray', dur: 10,
      items: [
        { t: 0, html: 'Pass the wires that go up to layer 2 through the tray: the MPU and power wires up the wall channel, TP4056 OUT− through the slot near the TP4056, and the switch legs’ wires through the slot under the switch.' },
        { t: 4.4, html: 'Lower the tray onto its ledges. The top of the button passes through the tray’s opening.' },
      ],
      labels: [
        { t0: 3.0, t1: 4.4, at: mpuPin(L, 'VCC'), text: 'MPU wires wait for layer 2' },
        { t0: 3.0, t1: 4.4, at: tpPad(L, 'OUT+', true), text: 'TP4056 OUT+ / OUT−' },
        { t0: 7.0, t1: 10, at: V(L.X0 + 0.9, 12, L.tray_z1), text: 'Wire channel along the wall' },
        { t0: 7.0, t1: 10, at: V(-10.6, -0.3, L.tray_z1), text: 'Slot: TP4056 pads' },
        { t0: 7.0, t1: 10, at: V(L.sw_x_c, L.Y0 + 2.7, L.tray_z1), text: 'Slot: switch legs' },
        { t0: 7.0, t1: 10, at: V(L.btn_cx, 23.5, L.tray_z1), text: 'Opening: button + wires' },
        { t0: 7.0, t1: 10, at: V(-1.6, -9, L.tray_z1 + 1.2), text: 'Divider rib' },
      ],
      build(a) {
        a.to('usb_micro', 0, 0.8, { p: V(0, -30, 0), o: 0 });
        a.cam(0, 1.4, { t: V(-4, 0, 6), az: -62, el: 42, d: 118 });
        a.to('lead_pico_b', 1.0, 1.6, { o: 0 }, 'linear');
        const up = ['w_mpu_vcc', 'w_mpu_gnd', 'w_mpu_scl', 'w_mpu_sda', 'w_mpu_int', 'w_tp_outm', 'w_tp_outp', 'w_sw_out'];
        up.forEach((id, i) => a.draw(id, 1.0 + i * 0.25, 2.4 + i * 0.25));
        a.set('tray', 4.4, { p: V(0, 0, 24), o: 0, r: V(0, 0, 0) });
        a.to('tray', 4.4, 4.8, { o: 1 }, 'linear');
        a.to('tray', 4.8, 6.4, { p: V(0, 0, 0) });
        a.cam(6.2, 7.4, { t: V(0, 0, 8), az: -82, el: 62, d: 112 });
      },
    },

    // ------------------------------------------------------------------ 8
    {
      num: '08', title: 'Layer 2: charger, battery, switch, MPU-6050', dur: 14,
      items: [
        { t: 0, html: '<b>TP4056</b>, components up, USB-C toward the ports wall: lower the USB end first into the opening, then slide it until the USB-C face is flush with the outside. A strip of Kapton under it, then hot glue.' },
        { t: 4.0, html: '<b>Battery</b> on 1 mm foam tape beside the divider rib, wires toward the TP4056 pads. Never pierce or bend the cell.' },
        { t: 5.8, html: '<b>Power switch</b>: knob out through its slot in the ports wall, legs down through the tray slot. Hot-glue it.' },
        { t: 7.4, html: '<b>MPU-6050</b> on 1 mm foam tape, header row over the wire channel and its wires going down it. Press it against its small rail.' },
      ],
      labels: [
        { t0: 0.6, t1: 1.8, obj: 'kapton', at: V(L.tp_cx, -12, L.tray_z1), text: 'Kapton strip' },
        { t0: 3.0, t1: 4.4, at: V(L.tp_cx, -L.Y_out / 2, L.tp_zb + p.tp_h - p.tp_usbc_h / 2), text: 'USB-C flush with the outside' },
        { t0: 5.4, t1: 6.8, obj: 'bat', at: V(L.bat_x0 + 10, L.bat_y0 + 6, L.tray_z1 + 4.4), text: 'Battery on foam tape' },
        { t0: 7.0, t1: 8.4, at: knob, text: 'Knob out through the slot' },
        { t0: 10.6, t1: 14, obj: 'mpu', at: V(L.mpu_x0 + 8, L.mpu_y0 + 15, L.mpu_zb + 1.6), text: 'MPU-6050 against its rail' },
        { t0: 12.0, t1: 14, at: V(L.tp_cx, -14, L.tp_zb + 1.6), text: 'TP4056' },
        { t0: 12.0, t1: 14, at: V(L.bat_x0 + 10, -6, L.tray_z1 + 4.4), text: 'Battery 402030PT' },
      ],
      build(a) {
        a.cam(0, 1.2, { t: V(-2, -6, 9), az: -68, el: 50, d: 112 });
        a.set('kapton', 0.3, { p: V(0, 0, 0), o: 0 });
        a.to('kapton', 0.3, 0.7, { o: 1 }, 'linear');
        a.set('tp', 0.8, { p: V(0, 4, 14), r: V(18, 0, 0), o: 0 });
        a.to('tp', 0.8, 1.1, { o: 1 }, 'linear');
        a.to('tp', 1.2, 2.2, { p: V(0, 4, 0.6) });
        a.to('tp', 2.2, 2.9, { p: V(0, 0, 0.6) });
        a.to('tp', 2.9, 3.7, { p: V(0, 0, 0), r: V(0, 0, 0) });
        a.pop('glue_tp', 3.8);
        a.set('foam_bat', 4.0, { p: V(0, 0, 0), o: 0 });
        a.to('foam_bat', 4.0, 4.4, { o: 1 }, 'linear');
        a.drop('bat', 4.4, 5.6, V(0, 0, 16));
        a.drop('sw', 5.8, 7.0, V(0, 0, 12));
        a.pop('glue_sw', 7.1);
        a.set('foam_mpu', 7.4, { p: V(0, 0, 0), o: 0 });
        a.to('foam_mpu', 7.4, 7.8, { o: 1 }, 'linear');
        a.cam(7.4, 8.6, { t: V(-4, -12, 8), az: -78, el: 44, d: 150 });
        a.to('mpu', 7.8, 9.4, { p: V(-0.6, 0, 14), r: V(0, 0, 0) });
        a.to('mpu', 9.4, 10.3, { p: V(-0.6, 0, 0) });
        a.to('mpu', 10.3, 10.8, { p: V(0, 0, 0) });
        a.to('lead_mpu', 9.4, 9.9, { o: 0 }, 'linear');
        a.cam(10.6, 12.0, { t: V(0, -2, 10), az: -90, el: 70, d: 108 });
      },
    },

    // ------------------------------------------------------------------ 9
    {
      num: '09', title: 'Charge current and power test', dur: 17,
      warn: '<b>Do this before the first charge.</b> TP4056 boards usually ship set to about 1 A (1.2 kΩ, marked “122”). That is about 3× the capacity of a 350 mAh cell. Replace the resistor next to the PROG pin (pin 2) with a <b>4.7 kΩ</b> one for about 250 mA. Until you’ve done it, don’t charge this battery.',
      items: [
        { t: 0, html: 'Swap the PROG resistor: 1.2 kΩ (“122”) out, 4.7 kΩ (“472”) in.' },
        { t: 6.6, html: 'Solder the battery to B+ / B−. Switch the power switch ON. VSYS (pin 39) should read the battery voltage minus about 0.3 V, and the Pico should boot.' },
        { t: 10.0, html: 'Plug a USB-C charger in. The red charging LED should glow through the lid’s light window once the lid is on, and a different colour shows when the battery is full.' },
        { t: 13.0, html: 'Switch OFF and check that VSYS drops to 0 V. The battery still charges with the switch off.' },
      ],
      hud: [
        { t0: 9.5, t1: 12.9, kind: 'readout', html: '<span class="k">Switch ON</span><span>VSYS ≈ battery − 0.3 V</span><span class="v">≈ 3.9 V · Pico boots</span>' },
        { t0: 13.5, t1: 17, kind: 'readout', html: '<span class="k">Switch OFF</span><span>VSYS</span><span class="v">0 V · still charging</span>' },
      ],
      labels: [
        { t0: 2.2, t1: 4.2, obj: 'r_old', at: V(L.tp_cx + 1.6, L.tp_y0 + 12.2, L.tp_zb + p.tp_t + 0.5), text: '1.2 kΩ “122” out' },
        { t0: 4.6, t1: 6.2, obj: 'r_new', at: V(L.tp_cx + 1.6, L.tp_y0 + 12.2, L.tp_zb + p.tp_t + 0.5), text: '4.7 kΩ “472” in' },
        { t0: 8.0, t1: 9.0, at: tpPad(L, 'B+'), text: 'B+ / B−' },
        { t0: 9.0, t1: 10.2, at: knob, text: 'Switch ON' },
        { t0: 11.6, t1: 13.0, obj: 'glow_tp', at: V(L.tp_cx + 5.4, L.tp_y0 + 9.0, L.tp_zb + p.tp_t + 0.6), text: 'Red LED: charging' },
        { t0: 13.0, t1: 14.6, at: knob, text: 'Switch OFF' },
      ],
      build(a) {
        a.cam(0, 1.6, { t: V(L.tp_cx + 1.0, L.tp_y0 + 12.2, 9.6), az: -118, el: 58, d: 52 });
        a.set('iron', 1.6, { p: V(0, 0, 10), r: V(-38, 0, 25), o: 0 });
        a.to('iron', 1.6, 2.0, { o: 1 }, 'linear');
        a.to('iron', 2.0, 2.8, { p: V(0, 0, 0.5) });
        a.to('r_old', 3.0, 3.8, { p: V(0, 0, 3.5) });
        a.to('r_old', 3.8, 4.2, { o: 0 }, 'linear');
        a.set('r_new', 4.3, { p: V(0, 0, 3.5), o: 0 });
        a.to('r_new', 4.3, 4.6, { o: 1 }, 'linear');
        a.to('r_new', 4.6, 5.3, { p: V(0, 0, 0) });
        a.to('iron', 5.4, 6.0, { p: V(0, 0, 14), o: 0 });
        a.cam(6.0, 7.2, { t: V(-3, -10, 10), az: -64, el: 48, d: 102 });
        a.draw('w_bat_red', 6.8, 8.0);
        a.draw('w_bat_black', 7.1, 8.3);
        a.to('sw_knob', 9.0, 9.4, { p: V(-1.25, 0, 0) });
        a.set('usb_c', 10.0, { p: V(0, -30, 0), o: 0 });
        a.to('usb_c', 10.0, 10.3, { o: 1 }, 'linear');
        a.to('usb_c', 10.3, 11.3, { p: V(0, 0, 0) });
        a.to('glow_tp', 11.4, 11.8, { o: 1 }, 'linear');
        a.to('sw_knob', 13.0, 13.4, { p: V(1.25, 0, 0) });
      },
    },

    // ------------------------------------------------------------------ 10
    {
      num: '10', title: 'Close the lid', dur: 15,
      items: [
        { t: 0, html: 'Tuck the wires flat so nothing presses on the battery. Place the lid: the thin light window goes over the TP4056, and the small tab fills the top of the switch slot.' },
        { t: 3.2, html: 'Drive in the four M2 × 6 screws by hand until they’re snug. Don’t over-tighten; they cut their own thread in the plastic.' },
        { t: 6.8, html: 'Cross-section through the sensor, cut from the model. From the bottom up: sensor pad, MAX30102 and Pico on the floor, tray, then TP4056, MPU-6050 and battery, then the lid.' },
      ],
      labels: [
        { t0: 3.4, t1: 5.8, obj: 'screw2', at: V(-L.screw_x, L.screw_y, L.H_total + 0.8), text: '4 × M2 × 6 pan-head self-tapping' },
        { t0: 9.0, t1: 15, at: V(6, chipY, L.H_total - 0.6), text: 'Lid' },
        { t0: 9.0, t1: 15, at: V(L.tp_cx, chipY, L.tp_zb + 0.8), text: 'TP4056 / MPU-6050' },
        { t0: 9.0, t1: 15, at: V(L.bat_x0 + 12, chipY, L.tray_z1 + 2.6), text: 'Battery' },
        { t0: 9.0, t1: 15, at: V(L.X1 - 1.5, chipY, L.tray_z0 + 0.4), text: 'Tray' },
        { t0: 9.0, t1: 15, at: V(L.pico_cx - 4, chipY, L.pico_zt - 0.5), text: 'Pico 2 W' },
        { t0: 9.0, t1: 15, at: V(L.seat_x0 + 9.5, chipY, L.max_zt - 0.6), text: 'MAX30102' },
        { t0: 9.0, t1: 15, at: V(L.chip_x, chipY, -0.6), text: 'Sensor pad + window' },
      ],
      build(a) {
        a.to('usb_c', 0, 0.8, { p: V(0, -30, 0), o: 0 });
        a.to('glow_tp', 0, 0.4, { o: 0 }, 'linear');
        a.cam(0, 1.4, { t: V(0, 0, 8), az: -52, el: 34, d: 138 });
        a.set('lid', 1.0, { p: V(0, 0, 26), o: 0, r: V(0, 0, 0) });
        a.to('lid', 1.0, 1.4, { o: 1 }, 'linear');
        a.to('lid', 1.4, 3.0, { p: V(0, 0, 0) });
        [0, 1, 2, 3].forEach((i) => {
          const t = 3.2 + i * 0.45, id = `screw${i}`;
          a.set(id, t, { p: V(0, 0, 12), r: V(0, 0, 0), o: 0 });
          a.to(id, t, t + 0.3, { o: 1 }, 'linear');
          a.to(id, t + 0.3, t + 1.9, { p: V(0, 0, 0), r: V(0, 0, -1440) });
        });
        a.cam(6.0, 7.2, { t: V(0, chipY, 5.5), az: -90, el: 8, d: 88 });
        a.set('section', 7.0, { on: 1, y: -45 });
        a.to('section', 7.0, 9.0, { y: chipY });
      },
    },

    // ------------------------------------------------------------------ 11
    {
      num: '11', title: 'Fit the strap', dur: 10,
      items: [
        { t: 0, html: 'Slide a spring bar into the end of one strap half. Put one tip into a lug hole, pull the quick-release lever (or press the other tip with a pin) and let it snap into the opposite hole.' },
        { t: 7.0, html: 'Tug it firmly. If a tip is loose, the hole printed too big: a drop of super glue inside the hole, left to dry, tightens it.' },
      ],
      labels: [
        { t0: 1.8, t1: 3.6, at: V(L.sb_x, L.ear_y0, p.sb_z), text: 'Spring-bar tip hole · 1.25 mm, blind' },
        { t0: 3.6, t1: 4.8, at: V(L.sb_x, -6, p.sb_z), text: '22.2 mm gap: strap end + spring bar' },
      ],
      build(a) {
        a.to('section', 0, 0.8, { y: -45 });
        a.set('section', 0.8, { on: 0 });
        a.cam(0.4, 1.8, { t: V(L.sb_x + 4, 0, 3), az: -40, el: 30, d: 96 });
        for (const [sx, t0] of [[1, 1.6], [-1, 5.0]]) {
          const s = sx > 0 ? 'px' : 'nx';
          a.set(`sb_${s}`, t0, { p: V(sx * 16, 0, 0), o: 0, tip: 0.25 });
          a.set(`strap_${s}`, t0, { p: V(sx * 16, 0, 0), o: 0, b: 0 });
          a.to(`sb_${s}`, t0, t0 + 0.4, { o: 1 }, 'linear');
          a.to(`strap_${s}`, t0, t0 + 0.4, { o: 0.35 }, 'linear'); // see-through, so the bar shows
          a.to(`sb_${s}`, t0 + 0.4, t0 + 1.6, { p: V(0, 0, 0) });
          a.to(`strap_${s}`, t0 + 0.4, t0 + 1.6, { p: V(0, 0, 0) });
          a.to(`sb_${s}`, t0 + 1.7, t0 + 2.0, { tip: 1 }, 'back');
          a.to(`strap_${s}`, t0 + 2.2, t0 + 2.7, { o: 1 }, 'linear');
        }
        a.cam(4.2, 5.4, { t: V(-L.sb_x - 4, 0, 3), az: -140, el: 30, d: 96 });
        a.cam(7.2, 8.6, { t: V(0, 0, 3), az: -62, el: 34, d: 210 });
      },
    },

    // ------------------------------------------------------------------ 12
    {
      num: '12', title: 'Wear it', dur: 13,
      items: [
        { t: 0, html: 'Wear it on top of the wrist, just above the wrist bone. Point the <b>button side toward your hand</b> and the <b>ports toward your elbow</b>, so the button is where a watch crown would be.' },
        { t: 2.4, html: 'Tighten the strap until the sensor bump is pressed against the skin but you can still slide one finger under it. The heart-rate reading needs that contact.' },
        { t: 6.0, html: 'Charge through the USB-C on the ports side. You don’t need to take the strap off to charge or to program.' },
      ],
      labels: [
        { t0: 5.0, t1: 13, at: V(0, 96, 6), text: 'Toward your hand · button side' },
        { t0: 5.0, t1: 13, at: V(0, -160, 6), text: 'Toward your elbow · ports side' },
        { t0: 6.4, t1: 9.6, obj: 'glow_lid', at: V(L.tp_cx + 5.4, L.tp_y0 + 9.0, L.H_total), text: 'Charge light glows through the lid' },
        { t0: 9.6, t1: 13, at: V(L.btn_cx, L.Y_out / 2, L.btn_z0 + p.btn_body / 2 + 1), text: 'Cancel button: press the tab' },
      ],
      build(a) {
        a.to('ground', 0.2, 1.4, { o: 0 }, 'linear');
        a.cam(0, 2.2, { t: V(0, -24, -12), az: -40, el: 26, d: 250 });
        a.set('arm', 0.4, { p: V(0, 0, -30), o: 0 });
        a.to('arm', 0.4, 2.2, { p: V(0, 0, 0), o: 1 }, 'out');
        a.to('strap_px', 2.4, 4.8, { b: 1 });
        a.to('strap_nx', 2.4, 4.8, { b: 1 });
        a.to('arrows', 4.6, 5.2, { o: 1 }, 'linear');
        a.to('glow_lid', 6.0, 6.6, { o: 1 }, 'linear');
        a.cam(4.8, 13, { t: V(0, -32, -10), az: -16, el: 36, d: 370 }, 'inOut');
      },
    },
  ];
}

// What the MicroPython test prints in step 6 (the button is pressed 13.8-14.4 s).
function consoleLines() {
  // pinned lines stay on screen; the loop output scrolls under them
  const lines = [
    { t: 9.1, text: '>>> %Run test.py', cls: 'dim', pin: true },
    { t: 9.7, text: "I2C0 ['0x57']", cls: 'ok', pin: true },
    { t: 10.2, text: 'I2C1 []', note: '0x68 once the MPU is wired', pin: true },
    { t: 11.0, text: '# motor on for 0.4 s', cls: 'dim', pin: true },
  ];
  for (let k = 0; k < 18; k++) {
    const t = 11.6 + k * 0.3;
    const pressed = t >= 13.75 && t < 14.45;
    lines.push({ t, text: pressed ? 'pressed' : '-', cls: pressed ? 'hit' : '' });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// authoring helpers, bound to one step at a time

export function author(tl, steps, objs) {
  for (const id of Object.keys(objs)) tl.def(id, objs[id].initial);
  tl.def('cam', { t: [0, 0, 6], az: -58, el: 28, d: 150 });
  tl.def('section', { on: 0, y: -45 });
  tl.def('ground', { o: 1 });

  const a = {
    to: (id, t0, t1, pose, ease) => tl.to(id, t0, t1, pose, ease),
    set: (id, t, pose) => tl.set(id, t, pose),
    cam: (t0, t1, pose, ease = 'inOut') => tl.to('cam', t0, t1, pose, ease),
    fadeOut: (ids, t0, t1) => ids.forEach((id) => tl.to(id, t0, t1, { o: 0 }, 'linear')),
    draw: (id, t0, t1) => { tl.set(id, t0, { o: 1, k: 0 }); tl.to(id, t0, t1, { k: 1 }, 'inOut'); },
    pop: (id, t, d = 0.45) => { tl.set(id, t, { o: 1, s: 0 }); tl.to(id, t, t + d, { s: 1 }, 'back'); },
    drop: (id, t0, t1, from) => {
      tl.set(id, t0, { p: from, r: [0, 0, 0], o: 0 });
      tl.to(id, t0, t0 + 0.3, { o: 1 }, 'linear');
      tl.to(id, t0 + 0.3, t1, { p: [0, 0, 0] }, 'drop');
    },
    // the pointer presses the button tab: in, presses, out
    press: (t0, presses, t1) => {
      tl.set('finger', t0, { p: [0, 14, 0], o: 0 });
      tl.to('finger', t0, t0 + 0.3, { o: 1 }, 'linear');
      tl.to('finger', t0 + 0.3, presses[0][0] - 0.1, { p: [0, 0, 0] });
      for (const [a0, a1] of presses) {
        tl.to('finger', a0, a0 + 0.2, { p: [0, -0.8, 0] });
        tl.to('finger', a1 - 0.2, a1, { p: [0, 0, 0] });
      }
      tl.to('finger', t1 - 0.5, t1, { p: [0, 14, 0], o: 0 });
    },
  };
  for (const s of steps) {
    tl.step(s.dur);
    s.build(a);
  }
}
