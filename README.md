# Sanad band — 3D assembly visualizer

An animated, step-by-step 3D walkthrough of how the **Sanad wrist band body (v1, 3 Nov 2026)** goes together, from the bare print to wearing it on the wrist.

It follows the 12 steps of *Sanad-band-assembly-guide.pdf* with the same numbering and wording. The four printed parts are the real print files. Everything else sits exactly where the parametric CAD model puts it.

## What's in it

| Step | What it shows |
|---|---|
| 00 | Exploded view of the whole band: sensor pad, body, layer 1, tray, layer 2, lid, screws |
| 01 | Cleaning the print: 1.6 mm drill in the screw holes, flexing the button tab, the floor features |
| 02 | The sensor pad pushed in from below, glued from inside |
| 03 | Header strips off; pins snipped to 1.5 mm stubs on the wire side, flush on the other |
| 04 | Pre-wiring each board, colour-coded (red 3V3, black GND, yellow SDA, blue SCL) |
| 05 | Layer 1: Pico 2 W (USB end first), MAX30102 sensor-down into its corner, coin motor, button, plus a view from underneath to check the chip is in the window |
| 06 | Small parts, layer-1 wiring and the MicroPython first test (I²C scan, motor buzz, button) |
| 07 | Wires up through the channel and slots, then the tray onto its ledges |
| 08 | Layer 2: TP4056 on Kapton, battery on foam tape, power switch, MPU-6050 against its rail |
| 09 | The PROG resistor swap (1.2 kΩ “122” → 4.7 kΩ “472”), battery, switch and charge test |
| 10 | Lid, the four M2 × 6 screws, and a cross-section through the sensor |
| 11 | Spring bars and strap |
| 12 | On the wrist: button toward the hand, ports toward the elbow |

Controls:
- Play, pause, scrub, previous and next step, or click any instruction to jump to it.
- Drag to orbit and scroll to zoom. **Guided view** hands the camera back to the animation.
- **X-ray** makes the case see-through, **Section** cuts the model through the sensor, and **Labels** and **Wires** hide those layers.
- Keyboard: Space plays or pauses, ← and → change step.
- Links go straight to a step, for example `#step-09`.

## Run it

It's a static page (three.js from a CDN, no build step). Browsers won't load the STL files from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any static host works too, GitHub Pages included (`.nojekyll` is already there).

## Files

```
index.html        page and controls
styles.css        look (Yassen design system: ink borders, hard shadows, mint, Elms Sans)
src/layout.js     every position: a port of Layout in cad-source/model.py
src/parts.js      printed parts from the STLs + stand-ins for the electronics and tools
src/wires.js      wire routes from the guide's pin map
src/steps.js      the 12 steps: text, timing, camera moves, callouts
src/anim.js       a small keyframe timeline (scrubbing and jumping are exact)
src/main.js       renderer, playback, camera, callouts, controls
models/*.stl      the four print files, unchanged (print orientation)
```

The STLs are loaded as delivered (print orientation) and turned back into their assembled positions in `src/parts.js`: the lid is flipped 180° about X and lifted to the top, and the pad and tray are moved back to their seats. `node tools/check-layout.mjs` confirms each STL still matches the layout numbers (within 0.01 mm).

## When the model changes

The real caliper measurements will regenerate the print files. To bring this visualizer along:

1. Replace the four files in `models/` with the new STLs from `export_print.py`.
2. Copy any changed values from `cad-source/params.py` into `PARAMS` in `src/layout.js` (same names). Every board, pin and wire position is derived from those numbers.
3. Run `node tools/check-layout.mjs` to confirm the STLs and the layout agree.

## Caveats

- Electronics are simplified stand-ins, sized from the same conservative estimates as the CAD model (the MAX30102 board, chip position and component heights are not caliper-measured yet).
- Wire paths are schematic. They use the real pins, slots and wall channel, but your wires will bend differently.
- TP4056 pad order varies between module makers; check the silkscreen on yours.
