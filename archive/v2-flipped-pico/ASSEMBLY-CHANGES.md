# Sanad band v2: flipped Pico

> **Old design, kept as a fallback.** The current design is v2b, in the top of this repo. Use this layout only if your TP4056 is too wide to sit between the pin rows.

This lists only what changes from *Sanad-band-assembly-guide.pdf* (v1). Anything not mentioned stays as the guide says.

**Status: not printed or test-fitted yet.** The model passes every fit check, but some sizes are still estimates. Measure first.

Updated 4 Nov with the official micro-USB position (the wall opening moved) and the wider MAX30102 estimate (seat and sensor pocket widened). The USB-C opening was also lowered, so a shell sitting directly on the board fits. The outer size is unchanged at 14.5 mm tall, because the uncut pins need that height.

## 1. Measure before you print

**Do not print yet.** These files still use estimates. Send the numbers below and I'll regenerate them.

Already known, so skip these:
- Pico board and micro-USB: 2.73 mm above the PCB, 0.77 mm sunk into the board edge (official Raspberry Pi 3D model).
- MAX30102 chip: 5.6 × 3.3 × 1.55 mm (datasheet).
- Slide switch body: 8.7 × 4.4 × 4.7 mm (LCSC).
- Button and motor sizes.

The Pico header still needs measuring. The official model doesn't cover the pins, and this design keeps them uncut.

"Fits if" is the limit found by growing one part at a time inside the current case.

**Pico 2 W header** (you have this now)

| Check or measure | Model uses | Fits if |
|---|---|---|
| Long pins on the plain side, short ends on the parts side | yes | must be yes |
| Small 3-pin white debug connector on the board? | none | tell me its height and position |
| PCB to long pin tip, plastic included | 8.5 mm | 8.8 or less |
| Black plastic strip height | 2.5 mm | 2.6 or less |
| Short pin end above the PCB | 2.0 mm | 3.0 or less |
| Tallest other part on the parts side (usually BOOTSEL) | 2.1 mm | 2.5 or less |
| Across the outside of both pin rows, at the tips (shows bent pins) | 18.42 mm | 18.1 to 18.7 |

**MAX30102.** Hold it sensor side up, pin row towards you, VIN on the left.

| Check or measure | Model uses | Fits if |
|---|---|---|
| Board length | 18.1 mm | 19.2 or less |
| Board width | 13.6 mm | 14.0 or less |
| Board thickness | 1.6 mm | used to set heights |
| Left (VIN) edge to the left end of the black chip | 7.7 mm | the window moves to match |
| Pin-row edge to the near side of the chip | 4.45 mm | the window moves to match |
| Total thickness across board and chip | 3.15 mm | used to set heights |
| Total thickness across board and tallest yellow capacitor | 3.5 mm | 3.7 or less |
| Closest sensor-side part to any board edge | 0.7 mm | 0.7 or more |

**MPU-6050**

| Check or measure | Model uses | Fits if |
|---|---|---|
| Board thickness | 1.6 mm | plenty of room |
| Total thickness across board and tallest part | 3.6 mm | 4.5 or less |

**TP4056** (when it arrives)

| Check or measure | Model uses | Fits if |
|---|---|---|
| Board length | 29.0 mm | 29.1 or less |
| Board width | 17.3 mm | 17.45 or less |
| Board thickness | 1.6 mm | 1.8 or less |
| Total height, PCB bottom to USB-C top | 5.2 mm | 5.35 or less |
| USB-C sticks out past the board edge | 0.6 mm | 0.5 or more |
| PCB bottom to USB-C bottom | 1.9 mm | 1.2 or more |
| USB-C width | 9.0 mm | 9.3 or less |
| LEDs from the left edge, USB-C toward you | 14.0 mm | 11 or more |
| LEDs from the front of USB-C | 10.6 mm | 6.6 to 17.4 |

**Battery** (when it arrives)

| Check or measure | Model uses | Fits if |
|---|---|---|
| Width | 20.5 mm | 20.5 or less |
| Length including the protection board | 32.5 mm | 32.7 or less |
| Thickness at the thickest point | 4.0 mm | 4.1 or less, on 0.4 mm tape |
| Wire length | 26 mm | 30 or more, for slack |

**Switch and wire**

| Check or measure | Model uses | Fits if |
|---|---|---|
| Knob sticks out from the switch body | 3.0 mm | 2.5 or more |
| Knob width + its travel | 4.5 mm | 5.1 or less |
| Switch leg spacing | 2.0 mm | tell me |
| Wire outer diameter | 0.8 mm | 0.8 fits as routed |

Thicker wire needs new routes: 0.9 mm clashes on 2 routes and 1.0 mm on most of them. Use 30 AWG if you can.

Copy this and fill it in:

```
PICO: long pins on plain side= debug connector= PCB-to-tip= plastic= short end= tallest part= across rows=
MAX: L= W= t= VINedge-to-chip= pinrow-to-chip= total+chip= total+cap= closest part to edge=
MPU: t= total+tallest=
TP4056: L= W= t= total@USBC= USBC sticks out= USBC bottom= USBC width= LED from left= LED from USBC front=
BATTERY: L= W= T= wire length=
SWITCH: knob out= knob width+travel= leg spacing=
WIRE: outer diameter=
```

## 2. Printing

Use the four files in `print/`, on the same settings as the guide, with one change: ask for **3 walls**, because the side walls are now 1.2 mm. No supports are needed.

| File | Sits on the bed |
|---|---|
| `sanad-v2-body.stl` | bottom down |
| `sanad-v2-sensor-pad.stl` | bump down |
| `sanad-v2-tray.stl` | flat, ribs up |
| `sanad-v2-lid.stl` | top face down, pegs up |

These replace all four v1 parts. The v1 parts do not fit this layout.

## 3. Assembly steps that change

**Before you start:** flash MicroPython onto the Pico. BOOTSEL faces the floor once it's fitted.

**Step 3, pin headers**
- Pico: do nothing. Leave the pins and the black plastic strips alone.
- MAX30102: same as the guide.
- MPU-6050: swap the sides. Leave the 1.5 mm stubs on **top** and snip **flush** underneath, because its wires now arrive from above.

**Step 4, pre-wiring**
- Solder the Pico's wires to the **short pin ends on the parts side**, the same side the guide used. The long pins never get solder on them.
- Push the long pins into a breadboard to hold the Pico while you solder.
- Keep each joint low on the short end.
- Run the wires from pins 31–39 across the parts side and tape them flat with Kapton, so all 15 wires leave along the pin 1–20 edge.

Wire lengths along the model's routes, before adding the guide's 15 mm spare:

| Wires | Length |
|---|---|
| MPU-6050, 5 wires | 40–55 mm |
| MAX30102 data and GND | 20–30 mm |
| MAX30102 VIN | 55 mm |
| Button | 10–25 mm |
| GP15 to the 1 kΩ | 55 mm |
| Transistor emitter | 45 mm |
| TP4056 OUT− | 60 mm |
| TP4056 OUT+ | 25 mm |
| 1N5817 to VSYS | 40 mm |

**Step 5, layer 1** (new order)
1. **Do the Step 9 resistor swap on the TP4056 now.** It will be under the tray later.
2. TP4056, parts up, on the floor: USB-C end first, into its opening, until the USB-C face is flush with the outside. Kapton under it, then hot glue.
3. Pico, **parts facing down**, USB toward the ports wall: tilt it, put the micro-USB into its low opening, then lower the far end onto the four posts.
4. MAX30102, sensor down, **turned 90° from the guide**: pin row toward the TP4056, VIN end toward the Pico. Push it into that corner, then check from underneath that the chip is in the window.
5. Button: same as the guide, now on the sensor side of the button wall.

The motor moves to layer 2.

**Step 6, first test:** the small parts now go on the tray, so hold them in place by hand or test after Step 8. The test code is unchanged.

**Step 7, tray**
- Pass the wires up through the large opening near the ports end.
- Lower the tray straight down over all 40 pins. Line up both rows first and don't force it.

**Step 8, layer 2**
- Battery: put a strip of Kapton along the long edge that faces the pins, then fix it against the end rib with thin tape, 0.4 mm if you can. The guide's 1 mm foam leaves only 0.2 mm of swell room. The cell sits as little as 0.1 mm from the pins.
- MPU-6050: between the two pin rows, against its rail, on thin foam tape. Same direction as v1, so its axes don't change.
- Motor: in the round seat between the pin rows.
- 1N4148: beside the motor, between the pin rows.
- 1N5817, transistor and 1 kΩ: in the corner of the tray near the ports end.
- Power switch: knob out through its notch. **Snip the unused outer leg short**, the one furthest from the Pico, or it can touch the USB-C shell.
- Cross the wires over the near pin row by threading them between pins.

**Step 9, power test:** the resistor is already done. The rest is the same.

**Step 10, lid:** the three pegs hold the tray down, and that holds the Pico in place. The pin tips go into pockets in the lid. If the lid won't sit flat, stop and look for a pin or wire in the way.

**Step 12, wearing it**
- Same direction as before: button toward the hand, ports toward the elbow.
- The micro-USB sits lower, so take the band off to program it.
- The charger now sits on the skin side, so charge it off the wrist.

## 4. Wiring

The guide's pin table still applies, so the code needs no pin changes. There is one small difference: the motor's red lead joins 3V3 at the **MPU-6050 VCC pin** instead of the MAX30102 VIN pin. It's the same 3V3 net, with a much shorter wire.

Because the Pico is upside down, pins 1–20 now face the sensor side. That's why the case is mirrored compared with v1.

## 5. Getting the Pico back for another project

1. Take off the lid.
2. Lift the tray, with layer 2 still on it.
3. Lift the Pico out.
4. Unsolder the wires from the short pin ends.

The long pins are clean and ready for a breadboard straight away.

## 6. What is different to live with

| Change | Effect |
|---|---|
| Side walls 1.8 → 1.2 mm | This is what makes room for the battery. The case is less stiff, so don't over-tighten the screws. |
| Outer corners 5 → 4 mm radius | Keeps enough wall around the Pico's corners. Overall size is unchanged. |
| Sensor moved from (11.8, −3.6) to (−10.8, +9.3) | Still inside the strap width, but further from the centre. Check the heart-rate signal early. |
| Charge light | Now shines up from the floor through a tray opening and a thin lid window, so it will be dimmer. |
| Wi-Fi antenna | Faces the wrist. It's slightly further from the skin than in v1, but this hasn't been tested. |

## 7. Regenerating the files

Edit `MEASURE` at the top of `cad/build_v2.py`, then run:

```bash
python cad/build_v2.py ../../cad/v1-lugs .
```

```bash
python cad/check_v2.py .
```

```bash
python cad/wires_v2.py .
```

These need `numpy`, `trimesh` and `manifold3d`.

The `sanad-3d` visualizer still shows v1.
