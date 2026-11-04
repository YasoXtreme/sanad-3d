# Sanad band v2b

The wrist band body for the Sanad wearable: print files, CAD source, an animated 3D assembly guide and a PDF guide.

**Do not print yet.** The Pico header, MAX30102 board, TP4056 and battery sizes are still estimates, and nothing has been test-fitted. The TP4056 must be 17.1 mm wide or less, because it sits between the pin rows.

## The design

- **Size:** 43.0 × 54.6 × 14.0 mm, plus the 1 mm sensor bump. Takes any 22 mm quick-release strap.
- **Pico 2 W:** fitted upside-down, so every header pin stays whole and the board still works in other projects. The long pins pass through slots in the tray and stop in pockets in the lid.
- **Layer 1, on the floor:** Pico 2 W, MAX30102, coin motor, push button, small parts.
- **Layer 2, on the tray:** TP4056 and MPU-6050 between the pin rows, battery beside them, slide switch.
- **Ports side:** micro-USB, USB-C and the power switch. **Button side:** the cancel button.

The pin map and code are the same as v1.

## What's in this repo

```
docs/             Sanad-band-assembly-guide-v2b.pdf: print, wiring and assembly guide
models/           the four print files
cad/              the parametric CAD source and its fit checks
index.html, src/  the animated 3D assembly guide
archive/          older designs, kept for reference
```

## Still estimated

Section 3 of the [PDF guide](docs/Sanad-band-assembly-guide-v2b.pdf) lists every size that needs calipers and the largest size that fits. To use your numbers:

1. Put them in `MEASURE` at the top of `cad/build.py`.
2. Copy any changed values into `PARAMS` in `src/layout.js`.
3. Rebuild and check (below).

## Rebuild the print files

The CAD needs Python with `numpy`, `trimesh` and `manifold3d`.

```bash
python cad/build.py
```

```bash
python cad/check.py
```

```bash
python cad/wires.py
```

`build.py` writes the four print files to `models/`. `check.py` tests every electronic part against every printed part. `wires.py` tests all 23 wire routes as 0.8 mm tubes. The lugs come from the two v1 files in `cad/v1-lugs/`.

Then confirm the guide still matches:

```bash
node tools/check-layout.mjs
```

## The 3D assembly guide

An animated, step-by-step walkthrough, from the bare print to wearing it on the wrist. It follows the 12 steps of the PDF guide.

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

### Run it

It's a static page (three.js from a CDN, no build step). Browsers won't load the STL files from `file://`, so serve the folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. Any static host works too, GitHub Pages included (`.nojekyll` is already there).

### Files

```
index.html        page and controls
styles.css        look (Yassen design system: ink borders, hard shadows, mint, Elms Sans)
src/layout.js     every position: matches layout() in cad/build.py
src/parts.js      printed parts from the STLs + stand-ins for the electronics and tools
src/wires.js      wire routes, the same ones checked in cad/wires.py
src/steps.js      the 12 steps: text, timing, camera moves, callouts
src/anim.js       a small keyframe timeline (scrubbing and jumping are exact)
src/main.js       renderer, playback, camera, callouts, controls
```

The STLs are loaded as delivered (print orientation) and turned back into their assembled positions in `src/parts.js`: the lid is flipped 180° about X and lifted to the top, and the pad and tray are moved back to their seats.

The Pico is built parts-up and turned 180° about its long axis as its home pose, so it can sit parts-up on the bench and turn over during Step 5.

## Caveats

- Electronics are simplified stand-ins, sized from estimates.
- Wire paths are schematic. Your wires will bend differently. Wire routes also use a few fixed positions, so check Steps 6 to 9 after a big change.
- TP4056 pad order and LED position vary between module makers; check the silkscreen on yours.
- The Wi-Fi antenna faces the wrist with the MPU-6050 above it. This hasn't been tested.

## Older designs

- `archive/Sanad-band-assembly-guide-v1.pdf`: the v1 guide, which cuts the Pico pins. Don't follow it for this design.
- `archive/v2-flipped-pico/`: the first flipped layout, with the TP4056 on the floor. It's the fallback if your TP4056 is too wide to sit between the pin rows.
