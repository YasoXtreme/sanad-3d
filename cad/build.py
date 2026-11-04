#!/usr/bin/env python3
"""Sanad band v2b: the layout from Yassen's notes, with the Pico pins left whole.

Layer 1 (floor): Pico 2 W upside-down, MAX30102, coin motor, push button, small parts.
Tray, with slots for the 40 pins.
Layer 2: TP4056 and MPU-6050 between the two pin rows, battery beside them, slide switch.

Outer size: 43.0 x 54.6 x 14.0 mm (+ 1 mm sensor bump).

Axes as worn, same as v1:
  X  across the wrist (lugs on the -X / +X faces)
  Y  along the forearm: -Y = ports side (elbow), +Y = button side (hand)
  Z  up; z = 0 is the case bottom (skin side)

Usage:  python cad/build.py

The lugs come from the two v1 files kept in cad/v1-lugs, so this folder rebuilds
on its own. Put caliper numbers in MEASURE, then run this again.
"""
import json
import os
import sys
from types import SimpleNamespace as NS

import numpy as np
import trimesh
from manifold3d import CrossSection, JoinType, Manifold, Mesh, OpType

_ADD = OpType.Add

# --------------------------------------------------------------------------
MEASURE = dict(
    # Pico header: estimates, no source covers the header on this board
    hdr_plastic=2.5,   # black plastic strip height
    hdr_long=6.0,      # pin length past the plastic
    hdr_tail=2.0,      # short pin end past the PCB
    # Pico micro-USB: official Raspberry Pi STEP model
    usb_h=2.73,        # above the PCB
    usb_sink=0.77,     # dips past the PCB face at the board edge
    # MAX30102 board: perspective-corrected photo estimate, 4 Nov
    max_l=18.1,
    max_w=13.6,
    chip_from_vin=10.5,     # chip centre to the VIN edge
    chip_from_row=6.1,      # chip centre to the pin-row edge
    # TP4056: listings disagree; 17.0 wide is what the layout needs
    tp_w=17.0,
    tp_l=29.0,
    tp_h=5.2,          # PCB bottom to USB-C top
    usbc_over=0.6,     # USB-C past the board edge
    # battery: largest size accepted
    bat_w=20.5,
    bat_l=32.5,
    bat_t=4.0,
    bat_swell=0.7,
)

X_OUT, Y_OUT, H_TOTAL, LID_T = 43.0, 54.6, 14.0, 1.6
H = H_TOTAL - LID_T
CORNER_R = 4.0
BOTTOM_CHAMFER = 1.0
TOP_CHAMFER = 0.79    # 0.01 off the v1 lug chamfer so the two never share an edge
WALL_X = 1.2          # gives the battery room beside the pin row
WALL_Y = 1.8
FLOOR = 1.6
TRAY_T = 0.8
SKIN = 0.6


def layout(m=MEASURE):
    L = NS(**m)
    L.X0, L.X1 = -(X_OUT / 2 - WALL_X), X_OUT / 2 - WALL_X
    L.Y0, L.Y1 = -(Y_OUT / 2 - WALL_Y), Y_OUT / 2 - WALL_Y
    L.inner_r = 2.2

    # ---- Pico, flipped about its long axis; USB stays on the ports side ----
    L.pico_W, L.pico_L, L.pico_t, L.pico_r = 21.0, 51.0, 1.0, 0.5
    L.pico_x1 = L.X1 - 0.2
    L.pico_x0 = L.pico_x1 - L.pico_W
    L.pico_cx = (L.pico_x0 + L.pico_x1) / 2
    L.pico_y0 = -25.7
    L.pico_y1 = L.pico_y0 + L.pico_L
    L.pico_yc = (L.pico_y0 + L.pico_y1) / 2
    L.pico_zc = 0.82 + 0.1 + L.usb_h        # component face (points down)
    L.usb_floor = L.pico_zc - L.usb_h - 0.1  # floor pocket under the USB shell
    L.pico_zb = L.pico_zc + L.pico_t        # plain face (points up)
    L.plastic_top = L.pico_zb + L.hdr_plastic
    L.pin_tip = L.plastic_top + L.hdr_long
    L.tail_tip = L.pico_zc - L.hdr_tail
    L.row_in = L.pico_cx - 17.78 / 2        # pins 1-20, toward the sensor column
    L.row_wall = L.pico_cx + 17.78 / 2      # pins 21-40, along the +X wall
    L.pin1_from_end = (51.0 - 48.26) / 2

    # ---- tray ----
    L.tray_z0 = L.plastic_top + 0.1
    L.tray_z1 = L.tray_z0 + TRAY_T

    # ---- MAX30102: as v1 turned 180 degrees, so pin row faces the Pico, VIN to +Y ----
    L.seat_x1, L.seat_x0 = -5.7, -20.1
    L.seat_y1, L.seat_y0 = 5.75, -14.05
    L.max_L_big, L.max_W_big = 19.2, 14.0
    L.max_zb, L.max_zt = FLOOR, FLOOR + 1.6
    L.chip_x = L.seat_x1 - L.chip_from_row
    L.chip_y = L.seat_y1 - L.chip_from_vin
    L.chip_face_z = 0.05
    L.fence_top = 2.8
    L.plug_x0, L.plug_x1 = -19.4, L.seat_x1 + 0.5
    L.plug_y0, L.plug_y1 = L.seat_y0 - 0.6, L.seat_y1 + 0.6
    L.bump_x0, L.bump_x1 = -19.9, L.plug_x1 + 1.5
    L.bump_y0, L.bump_y1 = L.plug_y0 - 1.5, L.plug_y1 + 1.5
    L.hole_c = 0.15

    # ---- motor and button on the floor, as v1 on the sensor side ----
    L.motor_cx, L.motor_cy, L.motor_d, L.motor_t = -12.7, 12.7, 10.0, 2.7
    L.motor_z0 = FLOOR - 0.8
    L.btn_cx = -11.5
    L.btn_y_front = L.Y1 - 0.5
    L.btn_y_back = L.btn_y_front - 5.0
    L.btn_z0, L.btn_z1 = FLOOR, FLOOR + 6.2
    L.tab_x0, L.tab_x1 = L.btn_cx - 5.7, L.btn_cx + 5.7

    # ---- layer 2 ----
    L.tp_t = 1.6
    L.tp_cx = L.pico_cx
    L.tp_x0, L.tp_x1 = L.tp_cx - L.tp_w / 2, L.tp_cx + L.tp_w / 2
    L.tp_y0 = -Y_OUT / 2 + 0.2 + L.usbc_over
    L.tp_y1 = L.tp_y0 + L.tp_l
    L.tp_z0 = L.tray_z1
    L.usbc_h = 3.3
    L.usbc_z1 = L.tp_z0 + L.tp_h
    L.usbc_z0 = L.usbc_z1 - L.usbc_h

    L.mpu_W, L.mpu_L, L.mpu_t, L.mpu_top = 15.56, 20.26, 1.6, 2.0
    L.mpu_x0 = L.pico_cx - L.mpu_W / 2
    L.mpu_y0 = L.tp_y1 + 0.6
    L.mpu_zb = L.tray_z1 + 0.4

    L.sw_L, L.sw_W, L.sw_H, L.sw_knob_w, L.sw_knob_out, L.sw_travel = 8.7, 4.4, 4.7, 2.0, 3.0, 2.5
    L.bat_x0 = L.X0 + 0.1
    L.bat_x1 = L.bat_x0 + L.bat_w
    L.bat_y0 = L.Y0 + L.sw_W + 1.0
    L.bat_y1 = L.bat_y0 + L.bat_l
    L.bat_z0 = L.tray_z1 + 0.4
    L.bat_z1 = L.bat_z0 + L.bat_t + L.bat_swell
    L.sw_cx = (L.bat_x0 + L.bat_x1) / 2
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


def pin_y(L, idx):
    return L.pico_y0 + L.pin1_from_end + idx * 2.54


# --------------------------------------------------------------------------
# printed parts, all in assembled (as-worn) coordinates

def outline(inset):
    return (-X_OUT / 2 + inset, X_OUT / 2 - inset, -Y_OUT / 2 + inset, Y_OUT / 2 - inset)


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
        rprism(*outline(BOTTOM_CHAMFER), 0, 1e-3, CORNER_R - BOTTOM_CHAMFER, 96),
        rprism(*outline(0), BOTTOM_CHAMFER, BOTTOM_CHAMFER + 1e-3, CORNER_R, 96),
    ]) + rprism(*outline(0), BOTTOM_CHAMFER, H, CORNER_R, 96)
    # lugs, screw pilots and spring-bar holes are the real v1 geometry
    body = shell + (v1_body ^ ear_boxes(-1, H))

    cx = L.pico_cx
    c = L.hole_c
    cuts = [
        rprism(L.X0, L.X1, L.Y0, L.Y1, FLOOR, H + 1, L.inner_r),
        # sensor pad hole and motor pocket
        rprism(L.plug_x0 - c, L.plug_x1 + c, L.plug_y0 - c, L.plug_y1 + c, -1, FLOOR + 0.1, 1.2),
        cyl(L.motor_cx, L.motor_cy, L.motor_d / 2 + 0.3, L.motor_z0, FLOOR + 0.1),
        # floor pocket under BOOTSEL, wide enough for either side of the board
        box(cx - 6.6, cx + 6.6, L.pico_y0 + 10, L.pico_y0 + 15, 0.8, FLOOR + 0.1),
        # Pico PCB and plastic-strip corners reach past the rounded inside corners
        rprism(L.pico_x0 - 0.1, L.pico_x1 + 0.1, L.pico_y0 - 0.1, L.pico_y1 + 0.1,
               L.pico_zc - 0.2, L.pico_zb + 0.2, L.pico_r + 0.1),
        # micro-USB: floor pocket, and a wall window covering the part sunk past the PCB face
        box(cx - 4.4, cx + 4.4, L.Y0 - 0.1, L.pico_y0 + 4.6, L.usb_floor, FLOOR + 0.1),
        xz_prism(cx - 4.4, cx + 4.4, L.usb_floor, L.pico_zc + L.usb_sink + 0.2, -Y_OUT / 2 - 0.1, L.Y0 + 0.1, 0.5),
        # TP4056: board end drops into the wall from above, USB-C notch through what is left
        box(L.tp_x0 - 0.15, L.tp_x1 + 0.15, L.tp_y0 - 0.1, L.Y0 + 0.1, L.tp_z0, H + 1),
        xz_prism(L.tp_cx - 4.75, L.tp_cx + 4.75, L.tp_z0 + 1.1, H + 3, -Y_OUT / 2 - 0.1, L.Y0 + 0.1, 0.5),
    ]
    for row in (L.row_in, L.row_wall):
        cuts.append(box(row - 1.37, row + 1.37, L.pico_yc - 25.5, L.pico_yc + 25.5, L.pico_zb, L.plastic_top + 0.15))
        cuts.append(box(row - 0.7, row + 0.7, L.pico_y0 + 0.6, L.pico_y1 - 0.6, 1.1, FLOOR + 0.1))
    # wire crossings under the Pico
    for ya, yb in ((-21.4, -18.6), (10.6, 14.6)):
        cuts.append(box(-2.8, L.row_wall + 0.7, ya, yb, 1.0, FLOOR + 0.1))
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
            adds.append(cyl(cx + dx, hy, 1.5, 0.8, L.pico_zc))
            adds.append(cyl(cx + dx, hy, 0.9, L.pico_zc - 0.1, L.pico_zc + 0.85))
    # button holder, same pattern as v1; the tray has an opening around it
    b = L.btn_cx
    top = L.btn_z1
    for s in (-1, 1):
        xa, xb = sorted((b + s * 3.4, b + s * 4.4))
        adds.append(box(xa, xb, 18.4, 21.0, FLOOR - 0.1, top))
        adds.append(box(xa, xb, 21.5, L.Y1 - 0.3, FLOOR - 0.1, 4.1))
    adds.append(box(b - 4.4, b + 4.4, 18.4, 20.0, 5.8, top))
    adds.append(ycyl(b, 4.7, 1.4, L.Y1 - 0.35, L.Y1 + 0.2))   # nub on the tab
    # tray ledges (45 degree undersides print without support)
    adds.append(Manifold.batch_hull([box(L.X0 - 0.1, L.X0, -21.0, 17.5, L.tray_z0 - 0.8, L.tray_z0),
                                     box(L.X0 - 0.1, L.X0 + 0.8, -21.0, 17.5, L.tray_z0 - 0.01, L.tray_z0)]))
    adds.append(Manifold.batch_hull([box(-16.0, -1.5, L.Y0 - 0.1, L.Y0, L.tray_z0 - 0.6, L.tray_z0),
                                     box(-16.0, -1.5, L.Y0 - 0.1, L.Y0 + 0.6, L.tray_z0 - 0.01, L.tray_z0)]))
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
    recess = rprism(L.seat_x1 - L.max_w + 0.7, L.seat_x1 - 0.7, L.seat_y1 - L.max_l + 0.7, L.seat_y1 - 0.7,
                    -0.5, FLOOR + 0.1, 0.6)
    window = Manifold.batch_hull([
        rprism(cx - 3.47, cx + 3.47, cy - 4.62, cy + 4.62, -1.1, -1.1 + 1e-3, 0.6),
        rprism(cx - 2.92, cx + 2.92, cy - 4.07, cy + 4.07, -0.45, -0.45 + 1e-3, 0.6),
    ])
    return pad - recess - window


def make_tray(L):
    z0, z1 = L.tray_z0, L.tray_z1
    t = rprism(L.X0 + 0.25, L.X1 - 0.25, L.Y0 + 0.25, L.Y1 - 0.25, z0, z1, L.inner_r - 0.25)
    cuts = []
    for row in (L.row_in, L.row_wall):
        for k in range(4):      # 5 pins per slot, with a web between slots
            ya = L.Y0 if k == 0 else pin_y(L, 5 * k) - 0.65
            cuts.append(box(row - 0.65, row + 0.65, ya, pin_y(L, 5 * k + 4) + 0.65, z0 - 1, z1 + 1))
    # switch legs and the power wires
    cuts.append(rprism(L.sw_cx - 4.6, -2.0, L.Y0 + 1.2, L.Y0 + 4.6, z0 - 1, z1 + 1, 0.4))
    # button, and the wires that go up to the MPU-6050 and TP4056
    cuts.append(rprism(-16.4, -0.75, 18.0, L.Y1 + 1, z0 - 1, z1 + 1, 0.6))
    cuts.append(rprism(-3.4, -0.75, L.bat_y1 + 1.0, 19.0, z0 - 1, z1 + 1, 0.6))
    t = t - union(cuts)
    ribs = [
        box(L.X0 + 0.4, -8.0, L.bat_y1 + 0.2, L.bat_y1 + 0.8, z1 - 0.01, z1 + 1.1),   # battery end stop
        box(L.mpu_x0 + 0.2, L.mpu_x0 + L.mpu_W - 0.2, L.mpu_y0 + L.mpu_L + 0.15, L.mpu_y0 + L.mpu_L + 0.75,
            z1 - 0.01, z1 + 1.1),                                                     # MPU rail
    ]
    return t + union(ribs)


def make_lid(L, v1_lid):
    plate = Manifold.batch_hull([
        rprism(*outline(TOP_CHAMFER), H_TOTAL - 1e-3, H_TOTAL, CORNER_R - TOP_CHAMFER, 96),
        rprism(*outline(0), H_TOTAL - TOP_CHAMFER, H_TOTAL - TOP_CHAMFER + 1e-3, CORNER_R, 96),
    ]) + rprism(*outline(0), H, H_TOTAL - TOP_CHAMFER, CORNER_R, 96)
    # v1 lid in print orientation -> assembled: 180 degrees about X, lifted to the top
    v1 = v1_lid.rotate((180, 0, 0)).translate((0, 0, H_TOTAL))
    lid = plate + (v1 ^ ear_boxes(H, H_TOTAL + 1))

    top = H_TOTAL - SKIN
    cuts = [
        # battery, with room to swell
        rprism(L.bat_x0 - 0.3, L.bat_x1 + 0.15, L.bat_y0 - 0.3, L.bat_y1 + 0.3, H - 1, H_TOTAL - 0.8, 0.4),
        # wires and parts on top of the TP4056 and MPU-6050
        rprism(L.row_in + 0.6, L.row_wall - 0.6, -24.0, L.mpu_y0 + L.mpu_L + 0.8, H - 1, H_TOTAL - 0.9, 1.0),
        # USB-C top, open to the ports face as in v1
        box(L.tp_cx - 4.75, L.tp_cx + 4.75, -Y_OUT / 2 - 1, L.tp_y0 + 7.5, H - 1, top),
        # thin light window over the charge LEDs
        box(L.tp_cx + 1.4, L.tp_cx + 8.4, L.tp_y0 + 6.0, L.tp_y0 + 14.0, H - 1, top),
        # switch top
        box(L.sw_cx - 4.6, L.sw_cx + 4.6, L.Y0 - 0.1, L.bat_y0 - 0.2, H - 1, H_TOTAL - 0.9),
    ]
    for row in (L.row_in, L.row_wall):   # pin tips
        cuts.append(box(row - 0.9, row + 0.9, pin_y(L, 0) - 0.9, pin_y(L, 19) + 0.9, H - 1, top))
    lid = lid - union(cuts)
    adds = []
    # pegs that hold the tray (and so the Pico) down
    for x, y, r in ((-16.0, 15.6, 1.0), (-17.6, -22.6, 1.0), (L.pico_cx, 24.7, 0.45)):
        adds.append(cyl(x, y, r, L.tray_z1 + 0.1, H + 0.1))
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
    C['pico_flash'] = box(*mir(1.5, 6.5), y0 + 14.8, y0 + 18.5, zc - 1.2, zc)
    C['pico_wireless'] = box(*mir(-5.2, 5.2), y0 + 32, y0 + 41.5, zc - 1.5, zc)
    C['pico_bootsel'] = box(*mir(2.9, 6.3), y0 + 10.5, y0 + 14.5, zc - 2.1, zc)
    pins = []
    for row in (L.row_in, L.row_wall):
        C[f'pico_strip_{"in" if row == L.row_in else "wall"}'] = box(
            row - 1.27, row + 1.27, L.pico_yc - 25.4, L.pico_yc + 25.4, zb, L.plastic_top)
        for i in range(20):
            y = pin_y(L, i)
            pins.append(box(row - 0.32, row + 0.32, y - 0.32, y + 0.32, L.tail_tip, L.pin_tip))
    C['pico_pins'] = union(pins)

    for tag, ln, wd in (('', L.max_l, L.max_w), ('_largest', L.max_L_big, L.max_W_big)):
        C[f'max_board{tag}'] = box(L.seat_x1 - wd, L.seat_x1, L.seat_y1 - ln, L.seat_y1, L.max_zb, L.max_zt)
    C['max_chip'] = box(L.chip_x - 1.65, L.chip_x + 1.65, L.chip_y - 2.8, L.chip_y + 2.8, L.chip_face_z, L.max_zb)
    row_x = L.seat_x1 - 1.27
    y_vin = L.seat_y1 - (L.max_l - 6 * 2.54) / 2
    C['max_stubs'] = union([box(row_x - 0.32, row_x + 0.32, y_vin - i * 2.54 - 0.32, y_vin - i * 2.54 + 0.32,
                                L.max_zt, L.max_zt + 1.5) for i in range(7)])

    C['motor'] = cyl(L.motor_cx, L.motor_cy, L.motor_d / 2, L.motor_z0, L.motor_z0 + L.motor_t)

    b = L.btn_cx
    C['button'] = box(b - 3.1, b + 3.1, L.btn_y_back, L.btn_y_front - 1.5, L.btn_z0, L.btn_z1)
    C['button_plunger'] = ycyl(b, (L.btn_z0 + L.btn_z1) / 2, 1.8, L.btn_y_front - 1.5, L.btn_y_front)

    z = FLOOR
    C['d_1n5817'] = box(-12.0, -3.6, -24.4, -21.7, z, z + 2.7)
    C['q_transistor'] = box(-18.3, -13.7, -24.6, -20.0, z, z + 2.4)
    C['r_1k'] = box(-13.0, -7.6, -20.4, -18.6, z, z + 1.8)
    C['d_1n4148'] = box(-13.0, -7.4, -17.8, -16.1, z, z + 1.7)

    C['tp_board'] = box(L.tp_x0, L.tp_x1, L.tp_y0, L.tp_y1, L.tp_z0, L.tp_z0 + L.tp_t)
    C['tp_usbc'] = rprism(L.tp_cx - 4.5, L.tp_cx + 4.5, L.tp_y0 - L.usbc_over, L.tp_y0 + 7.0, L.usbc_z0, L.usbc_z1, 0.3)
    C['tp_ic'] = box(L.tp_cx - 5.5, L.tp_cx + 0.3, L.tp_y0 + 9.7, L.tp_y0 + 14.7,
                     L.tp_z0 + L.tp_t, L.tp_z0 + L.tp_t + 1.45)

    C['battery'] = box(L.bat_x0, L.bat_x1, L.bat_y0, L.bat_y1, L.bat_z0, L.bat_z1)

    x0, yy, zz = L.mpu_x0, L.mpu_y0, L.mpu_zb
    C['mpu_board'] = box(x0, x0 + L.mpu_W, yy, yy + L.mpu_L, zz, zz + L.mpu_t)
    C['mpu_parts'] = box(x0 + 5.0, x0 + 11.8, yy + 2.0, yy + 15.5, zz + L.mpu_t, zz + L.mpu_t + L.mpu_top)
    ymid = yy + (L.mpu_L - 7 * 2.54) / 2
    C['mpu_stubs'] = union([box(x0 + 1.27 - 0.32, x0 + 1.27 + 0.32, ymid + i * 2.54 - 0.32, ymid + i * 2.54 + 0.32,
                                zz + L.mpu_t, zz + L.mpu_t + 1.5) for i in range(8)])

    sx, sy, sz = L.sw_cx, L.sw_y0, L.sw_z0
    C['switch'] = box(sx - L.sw_L / 2, sx + L.sw_L / 2, sy, sy + L.sw_W, sz, sz + L.sw_H)
    for tag, off in (('off', 1.25), ('on', -1.25)):
        C[f'switch_knob_{tag}'] = box(sx + off - 1, sx + off + 1, sy - L.sw_knob_out, sy + 0.01,
                                      L.knob_z - 1, L.knob_z + 1)
    C['switch_legs'] = union([box(sx + dx - 0.25, sx + dx + 0.25, sy + 2.05, sy + 2.35, sz - 2.0, sz) for dx in (-2, 0, 2)])
    return C


# --------------------------------------------------------------------------

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    v1_dir = f'{root}/cad/v1-lugs'
    out = f'{root}/models'
    os.makedirs(out, exist_ok=True)
    L = layout()
    parts = {
        'body': make_body(L, load(f'{v1_dir}/sanad-body.stl')),
        'pad': make_pad(L),
        'tray': make_tray(L),
        'lid': make_lid(L, load(f'{v1_dir}/sanad-lid.stl')),
    }
    assembled = f'{root}/cad/assembled'
    os.makedirs(f'{assembled}/components', exist_ok=True)
    for k, m in parts.items():
        to_trimesh(m).export(f'{assembled}/{k}.stl')
    for k, m in components(L).items():
        to_trimesh(m).export(f'{assembled}/components/{k}.stl')

    pc = ((L.bump_x0 + L.bump_x1) / 2, (L.bump_y0 + L.bump_y1) / 2)
    prints = {
        'sanad-body.stl': parts['body'],
        'sanad-sensor-pad.stl': parts['pad'].translate((-pc[0], -pc[1], 1.0)),
        'sanad-tray.stl': parts['tray'].translate((0, 0, -L.tray_z0)),
        'sanad-lid.stl': parts['lid'].rotate((180, 0, 0)).translate((0, 0, H_TOTAL)),
    }
    for name, m in prints.items():
        t = to_trimesh(m)
        t.export(f'{out}/{name}')
        print(f'{name:28s} watertight={t.is_watertight} vol={t.volume:8.1f} ext={np.round(t.extents, 2).tolist()}')

    report = {k: round(v, 3) for k, v in vars(L).items() if isinstance(v, (int, float))}
    report.update(H=H, H_total=H_TOTAL, X_out=X_OUT, Y_out=Y_OUT)
    with open(f'{root}/cad/layout.json', 'w') as f:
        json.dump(report, f, indent=1)


if __name__ == '__main__':
    main()
