#!/usr/bin/env python3
"""Wire routes for Sanad v2, checked as real tubes.

Usage: python wires_v2.py <v2 folder>

The pin map is the v1 guide's, unchanged, except that the motor's red lead
joins 3V3 at the MPU VCC pin instead of the MAX30102 VIN pin (same net).
All Pico wires go on the short pin ends, so the long pins stay clean.
"""
import glob
import json
import os
import sys

import numpy as np
import trimesh
from manifold3d import Manifold, Mesh, OpType

WIRE_R = 0.4        # 0.8 mm outer diameter

RED, BLACK, YELLOW, BLUE, GREEN, GREY = '#d62728', '#2a2a2e', '#e6a800', '#1f77b4', '#2ca02c', '#8c8c8c'


def routes(L):
    py = lambda i: L.pico_y0 + L.pin1_from_end + i * 2.54
    z_tail = L.tail_tip + 0.9
    PI = lambda n: (L.row_in, py(n - 1), z_tail)         # pins 1-20
    PW = lambda n: (L.row_wall, py(40 - n), z_tail)      # pins 21-40
    zg = 1.55       # in the pin-tail groove, under the tail tips
    zu = 3.7        # the step out from under the Pico, over the TP4056 edge
    xr = -1.6       # riser just left of the Pico edge

    x_vin = L.seat_x1 - (L.max_L - 6 * 2.54) / 2
    MX = lambda i: (x_vin - i * 2.54, L.seat_y0 + 1.27, L.max_zt + 1.2)
    my0 = L.mpu_y0 + (L.mpu_L - 7 * 2.54) / 2
    MP = lambda i: (L.mpu_x0 + 1.27, my0 + i * 2.54, L.mpu_zb + L.mpu_t + 1.2)
    TP = lambda f: (L.tp_x0 + f * L.tp_W, L.tp_y1 - 1.8, L.tp_z0 + L.tp_t + 0.5)
    leg = lambda dx: (L.sw_cx + dx, L.sw_y0 + 2.2, L.sw_z0 - 1.8)
    btn_r = (L.btn_cx + 4.45, 22.0, 5.5)
    btn_l = (L.btn_cx - 4.45, 22.0, 5.5)
    z2 = L.tray_z1 + 0.9    # wire height above the tray

    def wall_to_o1(pin, ycross, ygroove=None):
        """Wall-row tail -> groove -> crossing under the Pico -> up the riser."""
        t = PW(pin)
        yr = min(ycross, -10.4)     # the tray opening ends at y = -9.7
        return [t, (t[0], t[1], zg), (L.row_wall, ycross, zg), (-0.45, ycross, 1.5), (-0.45, ycross, zu),
                (xr, yr, zu), (xr, yr, z2)]

    def to_mpu(i, gap_y):
        """From the riser across the near pin row to an MPU pin, over the board."""
        p = MP(i)
        return [(L.row_in, gap_y, z2 + 1.0), (2.1, gap_y, 11.1), (2.1, p[1], 11.1), p]

    gapA = py(5) + 1.27     # between pins 6 and 7 (y about -10.4)

    R = {}
    # ---- MPU-6050: wall-side row, under the Pico, up, across the near pins ----
    R['mpu_sda'] = (YELLOW, wall_to_o1(31, -10.3) + to_mpu(3, gapA))
    R['mpu_scl'] = (BLUE, wall_to_o1(32, -9.6) + to_mpu(2, gapA))
    R['mpu_gnd'] = (BLACK, wall_to_o1(33, -10.3) + to_mpu(1, gapA))
    R['mpu_int'] = (GREY, wall_to_o1(34, -9.6) + to_mpu(7, gapA))
    R['mpu_vcc'] = (RED, wall_to_o1(36, -19.6) + [(xr, -14.0, z2)] + to_mpu(0, gapA))

    # ---- MAX30102 ----
    def max_to(i, pin, y_step):
        m, t = MX(i), PI(pin)
        return [m, (m[0], m[1], 5.2), (m[0], 2.2, 4.6), (xr, 1.0, zu + 0.2), (xr, y_step, zu),
                (-0.4, t[1], zu - 0.1), t]
    R['max_sda'] = (YELLOW, max_to(2, 6, -11.0))
    R['max_scl'] = (BLUE, max_to(1, 7, -8.6))
    R['max_int'] = (GREY, max_to(3, 9, -3.6))
    R['max_gnd'] = (BLACK, max_to(6, 8, -6.1))
    m = MX(0)
    t = PW(36)
    R['max_vin'] = (RED, [m, (m[0], m[1], 5.2), (xr, 2.0, 4.8), (xr, 1.0, zu + 0.2), (xr, -19.0, zu), (-0.45, -19.0, zu),
                          (-0.45, -19.0, 1.5), (L.row_wall, -19.0, zg), (L.row_wall, t[1], zg), t])

    # ---- button ----
    t = PI(19)
    R['btn_sig'] = (GREEN, [btn_r, (-3.0, 22.2, 5.0), (-1.6, t[1], zu - 0.1), (-0.45, t[1], zu - 0.1), t])
    t = PI(18)
    R['btn_gnd'] = (BLACK, [btn_l, (-15.1, 22.0, 5.6), (-15.1, 17.9, 5.0), (-2.0, 17.9, 4.6), (-1.6, t[1], zu - 0.1),
                            (-0.45, t[1], zu - 0.1), t])

    # ---- motor driver (small-parts corner on the tray) ----
    q = (-16.3, -14.9, L.tray_z1 + 1.2)      # transistor legs, pointing +Y
    zo = 11.7                                # over the 1N5817
    t = PI(20)
    R['gp15'] = (GREEN, [t, (-0.45, t[1], zu - 0.1), (-1.6, t[1], zu - 0.1), (-1.6, 18.0, 5.0), (-1.6, 5.6, 5.4), (-1.6, 3.4, 5.4),
                         (xr, 1.0, zu + 0.2), (xr, -12.0, zu + 0.3), (xr, -12.0, z2), (-6.2, -10.6, z2 + 1.0),
                         (-10.6, -10.6, z2 + 0.2), (-10.8, -12.6, z2)])
    R['r_base'] = (GREEN, [(-16.2, -13.1, z2 - 0.1), (-16.8, -14.6, z2 + 0.2), q])
    t = PI(13)
    R['q_emit'] = (BLACK, [q, (-12.6, -14.6, z2 + 0.3), (-10.6, -14.6, zo), (-7.2, -14.4, zo), (-4.0, -13.0, z2), (-4.0, -13.0, 6.4),
                           (xr, -13.0, zu + 0.3), (xr, 1.0, zu + 0.2), (-1.6, 3.4, 5.4), (-1.6, 5.6, 5.4), (-1.5, t[1], zu - 0.1),
                           (-0.45, t[1], zu - 0.1), t])
    mot = (L.motor_cx - 5.4, L.motor_cy + 0.6, L.tray_z1 + 1.5)
    R['mot_blue'] = (GREY, [mot, (3.0, -14.6, 11.6), (L.row_in, py(3) + 1.27, z2 + 0.6), (-2.5, -14.6, z2 + 0.6), (-7.2, -14.8, zo),
                            (-10.6, -14.8, zo), (-12.6, -14.7, z2 + 0.2), q])
    R['mot_red'] = (RED, [(L.motor_cx - 5.4, L.motor_cy - 0.6, L.tray_z1 + 1.5), (3.6, -13.2, 11.8), (2.1, -11.2, 11.2), MP(0)])

    # ---- power ----
    pad_op, pad_om, pad_bp, pad_bm = TP(0.82), TP(0.16), TP(0.6), TP(0.38)
    R['out_plus'] = (RED, [pad_op, (pad_op[0], pad_op[1], 4.8), (-4.2, -6.0, 4.8), (-4.2, -21.5, 5.2), leg(0)])
    t = PW(38)
    R['out_minus'] = (BLACK, [pad_om, (pad_om[0], pad_om[1] + 0.3, 4.8), (-2.2, 1.2, 4.8), (xr, 0.6, zu + 0.2), (xr, -19.5, zu), (-0.45, -19.5, zu),
                              (-0.45, -19.5, 1.5), (L.row_wall, -19.5, zg), t])
    t = PW(39)
    R['vsys'] = (RED, [(-8.9, -19.9, L.tray_z1 + 1.35), (-6.4, -20.0, z2 + 0.4), (-2.6, -20.1, z2), (-2.0, -20.1, 7.0), (xr, -20.1, zu), (-0.45, -20.1, zu),
                       (-0.45, -20.1, 1.5), (L.row_wall, -20.1, zg), (L.row_wall, t[1] + 0.5, zg), t])
    R['sw_out'] = (RED, [leg(2), (-1.7, -21.9, 6.6), (-1.7, -19.7, 7.2), (-1.7, -19.6, z2), (-5.4, -11.2, z2 + 0.5), (-8.9, -11.3, L.tray_z1 + 1.35)])
    z_b = L.bat_z0 + 2.0
    R['bat_red'] = (RED, [(-11.0, L.bat_y0 - 0.1, z_b), (-11.0, L.bat_y0 - 0.9, z_b + 0.2), (-6.9, -10.2, z_b - 0.4), (-6.9, -10.2, 6.2),
                          (pad_bp[0], -6.0, 4.6), (pad_bp[0], pad_bp[1] - 0.2, 4.2), pad_bp])
    R['bat_black'] = (BLACK, [(-13.0, L.bat_y0 - 0.1, z_b), (-13.0, L.bat_y0 - 0.9, z_b + 0.2), (-6.1, -10.1, z_b - 0.4), (-6.1, -10.1, 6.2),
                              (pad_bm[0], -6.0, 4.6), (pad_bm[0], pad_bm[1] - 0.2, 4.2), pad_bm])
    return R


def load(path):
    t = trimesh.load(path)
    return Manifold(Mesh(vert_properties=np.asarray(t.vertices, np.float32), tri_verts=np.asarray(t.faces, np.uint32)))


def sphere(p, r):
    return Manifold.sphere(r, 12).translate(tuple(p))


def tube(pts, r=WIRE_R):
    segs = [Manifold.batch_hull([sphere(a, r), sphere(b, r)]) for a, b in zip(pts[:-1], pts[1:])]
    return Manifold.batch_boolean(segs, OpType.Add)


def length(pts):
    a = np.asarray(pts, float)
    return float(np.linalg.norm(a[1:] - a[:-1], axis=1).sum())


def main():
    root = sys.argv[1]
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from build_v2 import layout, to_trimesh
    L = layout()
    A = f'{root}/cad/assembled'
    solids = {k: load(f'{A}/{k}.stl') for k in ('body', 'pad', 'tray', 'lid')}
    for p in sorted(glob.glob(f'{A}/components/*.stl')):
        n = os.path.basename(p)[:-4]
        if n not in ('max_board_largest', 'switch_knob_on'):
            solids[n] = load(p)
    R = routes(L)
    os.makedirs(f'{A}/wires', exist_ok=True)
    meta, bad = {}, 0
    for name, (color, pts) in R.items():
        t = tube(pts)
        to_trimesh(t).export(f'{A}/wires/{name}.stl')
        meta[name] = dict(color=color, length=round(length(pts), 1))
        # the two ends are meant to touch their pin or pad
        ends = Manifold.batch_boolean([sphere(pts[0], 1.6), sphere(pts[-1], 1.6)], OpType.Add)
        core = t - ends
        for s, m in solids.items():
            hit = core ^ m
            v = 0 if hit.is_empty() else abs(hit.volume())
            if v > 0.01:
                bad += 1
                print(f'  CLASH {name:10s} {s:16s} {v:7.3f} mm3 at {np.round(hit.bounding_box(), 1).tolist()}')
    json.dump(meta, open(f'{A}/wires/wires.json', 'w'), indent=1)
    print(f'{len(R)} wires checked, {bad} clash(es)')
    print('lengths mm:', {k: v['length'] for k, v in meta.items()})
    return bad


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
