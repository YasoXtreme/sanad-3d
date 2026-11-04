#!/usr/bin/env python3
"""Sanad band v2: Pico 2 W flipped upside-down, header pins left whole.

Outer size is the same as v1: 43.0 x 54.6 x 14.5 mm (+ 1 mm sensor bump).

Axes are the v1 axes, as worn:
  X  across the wrist (lugs on the -X / +X faces)
  Y  along the forearm: -Y = ports side (elbow), +Y = button side (hand)
  Z  up; z = 0 is the case bottom (skin side)

Usage:  python build_v2.py <folder with the v1 STLs> <v2 folder>

Change the numbers in MEASURE after using calipers, then run this again.
"""
import json
import os
import sys
from types import SimpleNamespace as NS

import numpy as np
import trimesh
from manifold3d import CrossSection, JoinType, Manifold, Mesh

# --------------------------------------------------------------------------
# Numbers to check with calipers. Everything below is derived from these.
MEASURE = dict(
    hdr_plastic=2.5,   # black plastic strip height
    hdr_long=6.0,      # pin length beyond the plastic
    hdr_tail=2.0,      # short pin end above the Pico's component side
    usb_h=2.73,        # micro-USB height above the PCB (official Raspberry Pi STEP model)
    usb_sink=0.77,     # how far the shell dips past the PCB face at the board edge (same source)
    bat_w=20.5,        # battery width, largest size this model accepts
    bat_l=32.5,        # battery length including protection board
    bat_t=4.0,         # battery thickness
    bat_swell=0.7,     # room left for the cell to swell
)

# Outer envelope: identical to v1.
X_OUT, Y_OUT, H, LID_T = 43.0, 54.6, 12.9, 1.6
H_TOTAL = H + LID_T
CORNER_R = 4.0        # v1 was 5.0; bounding box unchanged
BOTTOM_CHAMFER = 1.0
TOP_CHAMFER = 0.79     # 0.01 off the v1 lug chamfer so the two never share an edge

WALL_X = 1.2          # v1 was 1.8. This is where the battery's width comes from
WALL_Y = 1.8
FLOOR = 1.6
TRAY_T = 0.8
SKIN = 0.6            # thinnest floor/lid skin under a pocket is 0.6-0.8


def layout(m=MEASURE):
    L = NS(**m)
    L.X0, L.X1 = -(X_OUT / 2 - WALL_X), X_OUT / 2 - WALL_X
    L.Y0, L.Y1 = -(Y_OUT / 2 - WALL_Y), Y_OUT / 2 - WALL_Y
    L.inner_r = 2.2

    # ---- Pico, flipped about its long axis. USB stays on the ports side. ----
    L.pico_W, L.pico_L, L.pico_t, L.pico_r = 21.0, 51.0, 1.0, 0.5
    L.pico_x1 = L.X1 - 0.2
    L.pico_x0 = L.pico_x1 - L.pico_W
    L.pico_cx = (L.pico_x0 + L.pico_x1) / 2
    L.pico_y0 = -25.7
    L.pico_y1 = L.pico_y0 + L.pico_L
    L.pico_yc = (L.pico_y0 + L.pico_y1) / 2
    # Component face (points down). Set by the wires and BOOTSEL, not the USB: below this
    # height a wire can no longer step out between the PCB edge and the TP4056 edge.
    L.pico_zc = 4.1
    L.usb_floor = L.pico_zc - L.usb_h - 0.15    # floor pocket under the USB shell
    L.pico_zb = L.pico_zc + L.pico_t        # plain face (points up)
    L.plastic_top = L.pico_zb + L.hdr_plastic
    L.pin_tip = L.plastic_top + L.hdr_long
    L.tail_tip = L.pico_zc - L.hdr_tail
    L.row_in = L.pico_cx - 17.78 / 2        # pins 1-20 (faces the sensor side)
    L.row_wall = L.pico_cx + 17.78 / 2      # pins 21-40 (faces the +X wall)
    L.pin1_from_end = (51.0 - 48.26) / 2

    # ---- tray ----
    L.tray_z0 = L.plastic_top + 0.1
    L.tray_z1 = L.tray_z0 + TRAY_T

    # ---- TP4056, on the floor. Kept off the case corner. ----
    L.tp_W, L.tp_L, L.tp_t, L.tp_h = 17.3, 29.0, 1.6, 5.2
    L.tp_x0 = -18.5
    L.tp_x1 = L.tp_x0 + L.tp_W
    L.tp_cx = (L.tp_x0 + L.tp_x1) / 2
    L.tp_y0 = -Y_OUT / 2 + 0.2 + 0.6
    L.tp_y1 = L.tp_y0 + L.tp_L
    L.tp_z0 = FLOOR
    L.usbc_w, L.usbc_h, L.usbc_over = 9.0, 3.3, 0.6
    L.usbc_z1 = L.tp_z0 + L.tp_h
    L.usbc_z0 = L.usbc_z1 - L.usbc_h
    L.led_x, L.led_y = L.tp_cx + 5.4, L.tp_y0 + 10.0

    # ---- MAX30102, turned 90 degrees: VIN end to +X, pin row to -Y ----
    L.seat_x1 = -0.3
    L.seat_x0 = L.seat_x1 - 19.8
    L.seat_y0 = L.tp_y1 + 0.7
    L.seat_y1 = L.seat_y0 + 14.4
    L.max_L, L.max_W, L.max_t = 18.1, 13.6, 1.6      # perspective-corrected photo estimate, 4 Nov
    L.max_L_big, L.max_W_big = 19.2, 14.0            # largest accepted
    L.max_zb, L.max_zt = FLOOR, FLOOR + 1.6
    L.chip_x = L.seat_x1 - 10.5
    L.chip_y = L.seat_y0 + 6.1
    L.chip_face_z = 0.05
    L.fence_top = 2.8

    # ---- sensor pad (same stack as v1, turned 90 degrees) ----
    L.plug_x0, L.plug_x1 = -19.0, L.seat_x1 + 0.5   # stops short of the thin wall
    L.plug_y0, L.plug_y1 = L.seat_y0 - 0.6, L.seat_y1 + 0.6
    L.bump_x0, L.bump_x1 = -19.9, L.plug_x1 + 1.5
    L.bump_y0, L.bump_y1 = L.plug_y0 - 1.5, L.plug_y1 + 1.5
    L.hole_c = 0.15

    # ---- button (same height as v1, moved to the sensor side) ----
    L.btn_cx = -10.0
    L.btn_y_front = L.Y1 - 0.5
    L.btn_y_back = L.btn_y_front - 5.0
    L.btn_z0, L.btn_z1 = FLOOR, FLOOR + 6.2
    L.tab_x0, L.tab_x1 = L.btn_cx - 5.7, L.btn_cx + 5.7

    # ---- layer 2, on the tray ----
    L.bat_x0 = L.X0 + 0.1
    L.bat_x1 = L.bat_x0 + L.bat_w
    L.bat_y1 = 23.9
    L.bat_y0 = L.bat_y1 - L.bat_l
    L.bat_z0 = L.tray_z1 + 0.4
    L.bat_z1 = L.bat_z0 + L.bat_t + L.bat_swell

    L.mpu_W, L.mpu_L, L.mpu_t, L.mpu_top = 15.56, 20.26, 1.6, 2.0
    L.mpu_x0 = L.pico_cx - L.mpu_W / 2
    L.mpu_y0 = -11.0
    L.mpu_zb = L.tray_z1 + 0.4

    L.motor_cx, L.motor_cy, L.motor_d, L.motor_t = L.pico_cx, -17.7, 10.0, 2.7

    L.sw_L, L.sw_W, L.sw_H, L.sw_knob_w, L.sw_knob_out, L.sw_travel = 8.7, 4.4, 4.7, 2.0, 3.0, 2.5
    L.sw_cx = -4.15
    L.sw_y0 = L.Y0
    L.sw_z0 = L.tray_z1
    L.knob_z = L.sw_z0 + L.sw_H / 2
    return L


# --------------------------------------------------------------------------
# solid helpers

def box(x0, x1, y0, y1, z0, z1):
    return Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def rrect(x0, x1, y0, y1, r, seg=48):
    r = min(r, (x1 - x0) / 2 - 1e-3, (y1 - y0) / 2 - 1e-3)
    core = CrossSection.square((x1 - x0 - 2 * r, y1 - y0 - 2 * r)).translate((x0 + r, y0 + r))
    return core.offset(r, JoinType.Round, 2.0, seg)


def rprism(x0, x1, y0, y1, z0, z1, r, seg=48):
    return rrect(x0, x1, y0, y1, r, seg).extrude(z1 - z0).translate((0, 0, z0))


def xz_prism(x0, x1, z0, z1, y0, y1, r):
    """Rounded rectangle drawn in X-Z, pushed along Y."""
    return rrect(x0, x1, z0, z1, r).extrude(y1 - y0).rotate((90, 0, 0)).translate((0, y1, 0))


def cyl(cx, cy, r, z0, z1, seg=48):
    return Manifold.cylinder(z1 - z0, r, r, seg).translate((cx, cy, z0))


def ycyl(cx, cz, r, y0, y1, seg=32):
    return Manifold.cylinder(y1 - y0, r, r, seg).rotate((90, 0, 0)).translate((cx, y1, cz))


def union(parts):
    return Manifold.batch_boolean(list(parts), _ADD)


def load(path):
    t = trimesh.load(path)
    return Manifold(Mesh(vert_properties=np.asarray(t.vertices, np.float32),
                         tri_verts=np.asarray(t.faces, np.uint32)))


def to_trimesh(m):
    o = m.simplify(0.003).to_mesh()     # drop slivers that would collapse in float32 STL
    return trimesh.Trimesh(np.asarray(o.vert_properties)[:, :3], np.asarray(o.tri_verts), process=True)


from manifold3d import OpType  # noqa: E402
_ADD = OpType.Add


# --------------------------------------------------------------------------
# printed parts, all in assembled (as-worn) coordinates

def outline(inset, r):
    return (-X_OUT / 2 + inset, X_OUT / 2 - inset, -Y_OUT / 2 + inset, Y_OUT / 2 - inset, r)


def ear_boxes(z0, z1):
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            xa, xb = sorted((sx * 20.8, sx * 27.0))
            ya, yb = sorted((sy * 9.5, sy * 19.0))
            out.append(box(xa, xb, ya, yb, z0, z1))
    return union(out)


def make_body(L, v1_body):
    shell = Manifold.batch_hull([
        rprism(*outline(BOTTOM_CHAMFER, CORNER_R - BOTTOM_CHAMFER)[:4], 0, 1e-3, CORNER_R - BOTTOM_CHAMFER, 96),
        rprism(*outline(0, CORNER_R)[:4], BOTTOM_CHAMFER, BOTTOM_CHAMFER + 1e-3, CORNER_R, 96),
    ]) + rprism(*outline(0, CORNER_R)[:4], BOTTOM_CHAMFER, H, CORNER_R, 96)
    # the lugs, their screw pilots and spring-bar holes are the real v1 geometry
    body = shell + (v1_body ^ ear_boxes(-1, H + 1))

    cuts = [rprism(L.X0, L.X1, L.Y0, L.Y1, FLOOR, H + 1, L.inner_r)]

    # floor hole for the sensor pad
    c = L.hole_c
    cuts.append(rprism(L.plug_x0 - c, L.plug_x1 + c, L.plug_y0 - c, L.plug_y1 + c, -1, FLOOR + 0.1, 1.2))

    # Pico: PCB and plastic-strip corners reach past the rounded inside corners
    cuts.append(rprism(L.pico_x0 - 0.1, L.pico_x1 + 0.1, L.pico_y0 - 0.1, L.pico_y1 + 0.1,
                       L.pico_zc - 0.2, L.pico_zb + 0.2, L.pico_r + 0.1))
    for row in (L.row_in, L.row_wall):
        cuts.append(box(row - 1.37, row + 1.37, L.pico_yc - 25.5, L.pico_yc + 25.5,
                        L.pico_zb, L.plastic_top + 0.15))

    # floor pocket and wall window for the micro-USB, which now hangs below the PCB
    cx = L.pico_cx
    cuts.append(box(cx - 4.4, cx + 4.4, L.Y0 - 0.1, L.pico_y0 + 4.6, L.usb_floor, FLOOR + 0.1))
    cuts.append(xz_prism(cx - 4.4, cx + 4.4, L.usb_floor, L.pico_zc + L.usb_sink + 0.2,
                         -Y_OUT / 2 - 0.1, L.Y0 + 0.1, 0.5))

    # pin-tail grooves, and two crossings for the wires from the wall-side row
    for row in (L.row_in, L.row_wall):
        cuts.append(box(row - 0.7, row + 0.7, L.pico_y0 + 0.6, L.pico_y1 - 0.6, 1.1, FLOOR + 0.1))
    for ya, yb in ((-21.4, -18.6), (-10.8, -8.2)):
        cuts.append(box(L.tp_x1 + 0.1, L.row_wall + 0.7, ya, yb, 1.0, FLOOR + 0.1))

    # TP4056: USB-C window, and a slot the board end slides into
    # (starts 1.1 mm above the PCB bottom, as v1 did, so a shell sitting on the board still fits)
    cuts.append(xz_prism(L.tp_cx - 4.75, L.tp_cx + 4.75, FLOOR + 1.1, L.usbc_z1 + 0.2,
                         -Y_OUT / 2 - 0.1, L.Y0 + 0.1, 0.5))
    cuts.append(box(L.tp_x0 - 0.15, L.tp_x1 + 0.15, L.tp_y0 - 0.1, L.Y0 + 0.1, FLOOR, FLOOR + L.tp_t + 0.2))

    # power switch notch, open at the top; the lid tab closes it
    half = (L.sw_knob_w + L.sw_travel) / 2 + 0.3
    cuts.append(box(L.sw_cx - half, L.sw_cx + half, -Y_OUT / 2 - 0.1, L.Y0 + 0.1, L.knob_z - 1.25, H + 1))

    # button tab: U-shaped slit, hinge toward the middle of the case
    slit = 0.7
    u = (rrect(L.tab_x0, L.tab_x1, 2.5, 8.9, 0.01)
         - rrect(L.tab_x0 + slit, L.tab_x1 + 1, 2.5 + slit, 8.9 - slit, 0.01))
    cuts.append(u.extrude(WALL_Y + 0.4).rotate((90, 0, 0)).translate((0, Y_OUT / 2 + 0.2, 0)))

    body = body - union(cuts)

    adds = []
    # four posts: the Pico's component face rests on them, pins locate its holes
    for dx in (-5.7, 5.7):
        for hy in (L.pico_y0 + 2.0, L.pico_y1 - 2.0):
            adds.append(cyl(cx + dx, hy, 1.5, 1.0, L.pico_zc))
            adds.append(cyl(cx + dx, hy, 0.9, L.pico_zc - 0.1, L.pico_zc + 0.85))

    # button holder, same pattern as v1, kept below the tray
    b = L.btn_cx
    top = L.tray_z0 - 0.1
    for s in (-1, 1):
        xa, xb = sorted((b + s * 3.4, b + s * 4.4))
        adds.append(box(xa, xb, 18.4, 21.0, FLOOR - 0.1, top))
        adds.append(box(xa, xb, 21.5, L.Y1 - 0.3, FLOOR - 0.1, 4.1))
    adds.append(box(b - 4.4, b + 4.4, 18.4, 20.0, 5.8, top))
    adds.append(ycyl(b, 4.7, 1.4, L.Y1 - 0.35, L.Y1 + 0.2))   # nub on the tab

    # tray ledges (45 degree undersides print without support)
    def ledge_x(ya, yb):
        return Manifold.batch_hull([box(L.X0 - 0.1, L.X0, ya, yb, L.tray_z0 - 0.8, L.tray_z0),
                                    box(L.X0 - 0.1, L.X0 + 0.8, ya, yb, L.tray_z0 - 0.01, L.tray_z0)])

    def ledge_y(xa, xb):
        return Manifold.batch_hull([box(xa, xb, L.Y0 - 0.1, L.Y0, L.tray_z0 - 0.6, L.tray_z0),
                                    box(xa, xb, L.Y0 - 0.1, L.Y0 + 0.6, L.tray_z0 - 0.01, L.tray_z0)])

    adds.append(ledge_x(-21.0, 21.0))
    adds.append(ledge_y(L.tp_cx - 4.5, L.tp_cx + 4.5))
    return body + union(adds)


def make_pad(L):
    r = 2.5
    bump = Manifold.batch_hull([
        rprism(L.bump_x0 + 0.6, L.bump_x1 - 0.6, L.bump_y0 + 0.6, L.bump_y1 - 0.6, -1.0, -1.0 + 1e-3, r - 0.6),
        rprism(L.bump_x0, L.bump_x1, L.bump_y0, L.bump_y1, -0.4, -0.4 + 1e-3, r),
    ]) + rprism(L.bump_x0, L.bump_x1, L.bump_y0, L.bump_y1, -0.4, 0.0, r)
    plug = rprism(L.plug_x0, L.plug_x1, L.plug_y0, L.plug_y1, -0.01, FLOOR, 1.2)
    fences = union([
        box(L.seat_x1, L.plug_x1, L.plug_y0, L.plug_y1, FLOOR - 0.01, L.fence_top),
        box(L.plug_x0, L.plug_x1, L.plug_y0, L.seat_y0, FLOOR - 0.01, L.fence_top),
        box(L.plug_x0, L.plug_x1, L.seat_y1, L.plug_y1, FLOOR - 0.01, L.fence_top),
    ]) ^ rprism(L.plug_x0, L.plug_x1, L.plug_y0, L.plug_y1, FLOOR - 0.02, L.fence_top + 1, 1.2)
    pad = bump + plug + fences
    cx, cy = L.chip_x, L.chip_y
    # room for every sensor-side part that stays 0.7 mm in from the board edge
    recess = rprism(L.seat_x1 - L.max_L + 0.7, L.seat_x1 - 0.7, L.seat_y0 + 0.7, L.seat_y0 + L.max_W - 0.7,
                    -0.5, FLOOR + 0.1, 0.6)
    window = Manifold.batch_hull([
        rprism(cx - 4.62, cx + 4.62, cy - 3.47, cy + 3.47, -1.1, -1.1 + 1e-3, 0.6),
        rprism(cx - 4.07, cx + 4.07, cy - 2.92, cy + 2.92, -0.45, -0.45 + 1e-3, 0.6),
    ])
    return pad - recess - window


def pin_y(L, idx):
    return L.pico_y0 + L.pin1_from_end + idx * 2.54


def make_tray(L):
    z0, z1 = L.tray_z0, L.tray_z1
    t = rprism(L.X0 + 0.25, L.X1 - 0.25, L.Y0 + 0.25, L.Y1 - 0.25, z0, z1, L.inner_r - 0.25)
    cuts = []
    for row in (L.row_in, L.row_wall):
        for k in range(4):      # 5 pins per slot, with a web between slots
            ya = L.Y0 if k == 0 else pin_y(L, 5 * k) - 0.65
            cuts.append(box(row - 0.65, row + 0.65, ya, pin_y(L, 5 * k + 4) + 0.65, z0 - 1, z1 + 1))
    # opening: wires going up, and the charge LED shining through
    cuts.append(rprism(-7.5, -0.75, -20.5, L.bat_y0 - 1.1, z0 - 1, z1 + 1, 0.6))
    # switch legs
    cuts.append(rprism(L.sw_cx - 0.9, L.sw_cx + 2.9, L.sw_y0 + 1.1, L.sw_y0 + 3.3, z0 - 1, z1 + 1, 0.4))
    # keep tray plastic away from the Pico's antenna end
    cuts.append(box(L.pico_cx - 7.0, L.pico_cx + 7.0, L.pico_y1 - 9.0, L.Y1 + 1, z0 - 1, z1 + 1))
    # room for the top of the button, from underneath
    b = L.btn_cx
    cuts.append(box(b - 3.6, b + 3.6, 19.8, L.Y1 + 1, z0 - 1, z0 + 0.4))
    # shallow seat for the motor
    cuts.append(cyl(L.motor_cx, L.motor_cy, 5.25, z1 - 0.2, z1 + 1))
    t = t - union(cuts)
    ribs = [
        box(L.X0 + 0.4, -8.0, L.bat_y0 - 0.8, L.bat_y0 - 0.2, z1 - 0.01, z1 + 1.1),   # battery end stop
        box(L.mpu_x0 + 0.2, L.mpu_x0 + L.mpu_W - 0.2, L.mpu_y0 + L.mpu_L + 0.15, L.mpu_y0 + L.mpu_L + 0.75,
            z1 - 0.01, z1 + 1.1),                                                     # MPU rail
    ]
    return t + union(ribs)


def make_lid(L, v1_lid):
    plate = Manifold.batch_hull([
        rprism(*outline(TOP_CHAMFER, CORNER_R - TOP_CHAMFER)[:4], H_TOTAL - 1e-3, H_TOTAL, CORNER_R - TOP_CHAMFER, 96),
        rprism(*outline(0, CORNER_R)[:4], H_TOTAL - TOP_CHAMFER, H_TOTAL - TOP_CHAMFER + 1e-3, CORNER_R, 96),
    ]) + rprism(*outline(0, CORNER_R)[:4], H, H_TOTAL - TOP_CHAMFER, CORNER_R, 96)
    # v1 lid in print orientation -> assembled: 180 degrees about X, lifted to the top
    v1 = v1_lid.rotate((180, 0, 0)).translate((0, 0, H_TOTAL))
    lid = plate + (v1 ^ ear_boxes(H, H_TOTAL + 1))

    top = H_TOTAL - SKIN            # deepest pocket leaves a 0.6 mm skin
    cuts = [
        # battery, with room to swell
        rprism(L.bat_x0 - 0.3, L.bat_x1 + 0.15, L.bat_y0 - 0.3, L.bat_y1 + 0.3, H - 1, H_TOTAL - 0.8, 0.4),
        # wires on top of the MPU and motor
        rprism(L.row_in + 0.6, L.row_wall - 0.6, -24.0, L.mpu_y0 + L.mpu_L + 1.0, H - 1, H_TOTAL - 1.1, 1.0),
        # light window over the charge LEDs
        box(-9.0, L.row_in - 0.8, -21.0, L.bat_y0 - 1.1, H - 1, top),
        # switch top
        box(L.sw_cx - 4.6, L.sw_cx + 4.6, L.Y0 - 0.1, L.sw_y0 + L.sw_W + 0.3, H - 1, H_TOTAL - 1.1),
    ]
    for row in (L.row_in, L.row_wall):   # pin tips
        cuts.append(box(row - 0.9, row + 0.9, pin_y(L, 0) - 0.9, pin_y(L, 19) + 0.9, H - 1, top))
    lid = lid - union(cuts)
    adds = []
    # pegs that hold the tray (and so the Pico) down
    for x, y in ((-17.5, -12.5), (L.pico_cx, 12.3), (3.2, -23.3)):
        adds.append(cyl(x, y, 1.0, L.tray_z1 + 0.1, H + 0.1))
    # tab that closes the top of the switch notch
    half = (L.sw_knob_w + L.sw_travel) / 2 + 0.2
    adds.append(box(L.sw_cx - half, L.sw_cx + half, -Y_OUT / 2 + 0.1, L.Y0 - 0.05, L.knob_z + 1.25, H + 0.1))
    return lid + union(adds)


# --------------------------------------------------------------------------
# stand-ins for the electronics, used by the fit checks and the viewer

def components(L):
    C = {}
    cx, zc, zb = L.pico_cx, L.pico_zc, L.pico_zb
    y0 = L.pico_y0

    def mir(a, b):      # a v1 "dx from centre" range, seen after the flip
        return cx - b, cx - a

    holes = union([cyl(cx + dx, hy, 1.05, zc - 1, zb + 1) for dx in (-5.7, 5.7)
                   for hy in (L.pico_y0 + 2.0, L.pico_y1 - 2.0)])
    C['pico_pcb'] = rprism(L.pico_x0, L.pico_x1, L.pico_y0, L.pico_y1, zc, zb, L.pico_r) - holes
    C['pico_usb'] = (box(cx - 4, cx + 4, y0 - 1.3, y0 + 4.0, zc - L.usb_h, zc)
                     + box(cx - 4, cx + 4, y0 - 1.3, y0, zc - 0.01, zc + L.usb_sink))
    C['pico_rp2350'] = box(*mir(-3.5, 3.5), y0 + 22, y0 + 29, zc - 0.85, zc)
    C['pico_flash'] = box(*mir(1.5, 6.5), y0 + 14, y0 + 18.5, zc - 1.2, zc)
    C['pico_wireless'] = box(*mir(-5.2, 5.2), y0 + 32, y0 + 41.5, zc - 1.5, zc)
    C['pico_bootsel'] = box(*mir(-6.3, -2.9), y0 + 10.5, y0 + 14.5, zc - 2.1, zc)
    pins = []
    for row in (L.row_in, L.row_wall):
        C[f'pico_strip_{"in" if row == L.row_in else "wall"}'] = box(
            row - 1.27, row + 1.27, L.pico_yc - 25.4, L.pico_yc + 25.4, zb, L.plastic_top)
        for i in range(20):
            y = pin_y(L, i)
            pins.append(box(row - 0.32, row + 0.32, y - 0.32, y + 0.32, L.tail_tip, L.pin_tip))
    C['pico_pins'] = union(pins)

    for tag, ln, wd in (('', L.max_L, L.max_W), ('_largest', L.max_L_big, L.max_W_big)):
        C[f'max_board{tag}'] = box(L.seat_x1 - ln, L.seat_x1, L.seat_y0, L.seat_y0 + wd, L.max_zb, L.max_zt)
    C['max_chip'] = box(L.chip_x - 2.8, L.chip_x + 2.8, L.chip_y - 1.65, L.chip_y + 1.65, L.chip_face_z, L.max_zb)
    row_y = L.seat_y0 + 1.27
    x_vin = L.seat_x1 - (L.max_L - 6 * 2.54) / 2
    C['max_stubs'] = union([box(x_vin - i * 2.54 - 0.32, x_vin - i * 2.54 + 0.32, row_y - 0.32, row_y + 0.32,
                                L.max_zt, L.max_zt + 1.5) for i in range(7)])

    C['tp_board'] = box(L.tp_x0, L.tp_x1, L.tp_y0, L.tp_y1, L.tp_z0, L.tp_z0 + L.tp_t)
    C['tp_usbc'] = rprism(L.tp_cx - 4.5, L.tp_cx + 4.5, L.tp_y0 - L.usbc_over, L.tp_y0 + 7.0,
                          L.usbc_z0, L.usbc_z1, 0.3)
    C['tp_ic'] = box(L.tp_cx - 2.9 - 2.6, L.tp_cx + 2.9 - 2.6, L.tp_y0 + 9.7, L.tp_y0 + 14.7,
                     L.tp_z0 + L.tp_t, L.tp_z0 + L.tp_t + 1.45)

    b = L.btn_cx
    C['button'] = box(b - 3.1, b + 3.1, L.btn_y_back, L.btn_y_front - 1.5, L.btn_z0, L.btn_z1)
    C['button_plunger'] = ycyl(b, (L.btn_z0 + L.btn_z1) / 2, 1.8, L.btn_y_front - 1.5, L.btn_y_front)

    C['battery'] = box(L.bat_x0, L.bat_x1, L.bat_y0, L.bat_y1, L.bat_z0, L.bat_z1)

    x0, yy, zz = L.mpu_x0, L.mpu_y0, L.mpu_zb
    C['mpu_board'] = box(x0, x0 + L.mpu_W, yy, yy + L.mpu_L, zz, zz + L.mpu_t)
    C['mpu_parts'] = box(x0 + 5.0, x0 + 11.8, yy + 2.0, yy + 15.5, zz + L.mpu_t, zz + L.mpu_t + L.mpu_top)
    ymid = yy + (L.mpu_L - 7 * 2.54) / 2
    C['mpu_stubs'] = union([box(x0 + 1.27 - 0.32, x0 + 1.27 + 0.32, ymid + i * 2.54 - 0.32, ymid + i * 2.54 + 0.32,
                                zz + L.mpu_t, zz + L.mpu_t + 1.5) for i in range(8)])

    C['motor'] = cyl(L.motor_cx, L.motor_cy, L.motor_d / 2, L.tray_z1 - 0.2, L.tray_z1 - 0.2 + L.motor_t)

    sx, sy, sz = L.sw_cx, L.sw_y0, L.sw_z0
    C['switch'] = box(sx - L.sw_L / 2, sx + L.sw_L / 2, sy, sy + L.sw_W, sz, sz + L.sw_H)
    for tag, off in (('off', 1.25), ('on', -1.25)):
        C[f'switch_knob_{tag}'] = box(sx + off - 1, sx + off + 1, sy - L.sw_knob_out, sy + 0.01,
                                      L.knob_z - 1, L.knob_z + 1)
    C['switch_legs'] = union([box(sx + dx - 0.25, sx + dx + 0.25, sy + 2.05, sy + 2.35, sz - 2.0, sz) for dx in (0, 2)])

    z = L.tray_z1
    C['d_1n5817'] = box(-10.4, -7.7, -19.8, -11.4, z, z + 2.7)
    C['q_transistor'] = box(-18.6, -14.0, -19.8, -15.2, z, z + 2.4)
    C['r_1k'] = box(-16.3, -11.0, -14.0, -12.2, z, z + 1.8)
    C['d_1n4148'] = box(2.0, 3.7, -21.0, -15.6, z, z + 1.7)
    return C


# --------------------------------------------------------------------------

def main():
    v1_dir, root = sys.argv[1], sys.argv[2]
    out = f'{root}/print'
    os.makedirs(out, exist_ok=True)
    L = layout()
    parts = {
        'body': make_body(L, load(f'{v1_dir}/sanad-body.stl')),
        'pad': make_pad(L),
        'tray': make_tray(L),
        'lid': make_lid(L, load(f'{v1_dir}/sanad-lid.stl')),
    }
    assembled = f'{root}/cad/assembled'
    os.makedirs(assembled, exist_ok=True)
    for k, m in parts.items():
        to_trimesh(m).export(f'{assembled}/{k}.stl')
    comps = components(L)
    os.makedirs(f'{assembled}/components', exist_ok=True)
    for k, m in comps.items():
        to_trimesh(m).export(f'{assembled}/components/{k}.stl')

    # print orientation
    pc = ((L.bump_x0 + L.bump_x1) / 2, (L.bump_y0 + L.bump_y1) / 2)
    prints = {
        'sanad-v2-body.stl': parts['body'],
        'sanad-v2-sensor-pad.stl': parts['pad'].translate((-pc[0], -pc[1], 1.0)),
        'sanad-v2-tray.stl': parts['tray'].translate((0, 0, -L.tray_z0)),
        'sanad-v2-lid.stl': parts['lid'].rotate((180, 0, 0)).translate((0, 0, H_TOTAL)),
    }
    for name, m in prints.items():
        t = to_trimesh(m)
        t.export(f'{out}/{name}')
        print(f'{name:26s} watertight={t.is_watertight} vol={t.volume:8.1f} ext={np.round(t.extents, 2).tolist()}')

    report = {k: round(v, 3) for k, v in vars(L).items() if isinstance(v, (int, float))}
    report.update(H=H, H_total=H_TOTAL, X_out=X_OUT, Y_out=Y_OUT)
    with open(f'{root}/cad/layout.json', 'w') as f:
        json.dump(report, f, indent=1)


if __name__ == '__main__':
    main()
