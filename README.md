# Sanad band v2b: 3D assembly visualizer

An animated, step-by-step 3D walkthrough of how the **Sanad wrist band body (v2b, 4 Nov 2026)** goes together, from the bare print to wearing it on the wrist.

The Pico 2 W goes in upside-down with every pin kept, and the layers follow Yassen's notes. It follows the 12 steps of *Sanad-band-assembly-guide-v2b.pdf*. The four printed parts are the real v2b print files. Everything else sits where the CAD model puts it.

The earlier v1 version of this guide is still in git on the `main` branch.

**Do not print yet.** The Pico header, MAX30102 board, TP4056 and battery sizes are still estimates. The TP4056 must be 17.1 mm wide or less, because it sits between the pin rows.

## What's in it

| Step | What it shows |
|---|---|
| 00 | Exploded view of the whole band: sensor pad, body, layer 1, tray, layer 2, lid, screws |
| 01 | Cleaning the print: 1.6 mm drill in the screw holes, flexing the button tab, the floor features |
| 02 | The sensor pad pushed in from below, glued from inside |
| 03 | The Pico left whole; strips off and pins snipped on the MAX30102 and MPU-6050 only |
| 04 | Pre-wiring each board, on the Pico's short pin ends, colour-coded (red 3V3, black GND, yellow SDA, blue SCL) |
| 05 | Layer 1: the Pico turned over and fitted, MAX30102 sensor-down into its corner, coin motor, button, plus a view from underneath to check the chip is in the window |
| 06 | Small parts, layer-1 wiring and the MicroPython first test (I²C scan, motor buzz, button) |
| 07 | Wires up through the tray, then the tray lowered over all 40 pins |
| 08 | The PROG resistor swap (1.2 kΩ “122” → 4.7 kΩ “472”), then layer 2: TP4056 between the pin rows, battery, power switch, MPU-6050 |
| 09 | Battery, switch and charge test |
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
src/layout.js     every position: matches layout() in ../v2b-guide-layout/cad/build.py
src/parts.js      printed parts from the STLs + stand-ins for the electronics and tools
src/wires.js      wire routes, the ones checked in ../v2b-guide-layout/cad/wires.py
src/steps.js      the 12 steps: text, timing, camera moves, callouts
src/anim.js       a small keyframe timeline (scrubbing and jumping are exact)
src/main.js       renderer, playback, camera, callouts, controls
models/*.stl      the four v2b print files, unchanged (print orientation)
```

The STLs are loaded as delivered (print orientation) and turned back into their assembled positions in `src/parts.js`: the lid is flipped 180° about X and lifted to the top, and the pad and tray are moved back to their seats. `node tools/check-layout.mjs` confirms each STL still matches the layout numbers (within 0.01 mm).

The Pico is built parts-up and turned 180° about its long axis as its home pose, so it can sit parts-up on the bench and turn over during Step 5.

## When the model changes

Caliper measurements will regenerate the print files. To bring this visualizer along:

1. Put the numbers in `MEASURE` in `../v2b-guide-layout/cad/build.py` and rebuild.
2. Copy the four STLs from `../v2b-guide-layout/print/` into `models/`, dropping `v2b-` from their names.
3. Copy any changed values into `PARAMS` in `src/layout.js` (same meaning). Every board and pin position is derived from those numbers. Wire routes also use a few fixed positions, so check Steps 6 to 9 after a big change.
4. Run `node tools/check-layout.mjs` to confirm the STLs and the layout agree.

## Caveats

- Electronics are simplified stand-ins, sized from estimates. The Pico header, MAX30102 board, TP4056 and battery have not been measured yet.
- Wire paths are schematic. They were checked for clashes as 0.8 mm tubes, but your wires will bend differently.
- TP4056 pad order and LED position vary between module makers; check the silkscreen on yours.
