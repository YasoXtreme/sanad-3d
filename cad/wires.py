#!/usr/bin/env python3
"""Wire routes for Sanad v2b, checked as real tubes.

Usage: python cad/wires.py

The pin map is unchanged from the guide. All Pico wires go on the short pin
ends, so the long pins stay clean. Wires from pins 21-40 run under the Pico to
the sensor side, because the board edge sits against the +X wall.
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
    zt = L.tail_tip + 0.9
    PI = lambda n: (L.row_in, py(n - 1), zt)         # pins 1-20
    PW = lambda n: (L.row_wall, py(40 - n), zt)      # pins 21-40
    lane = L.row_wall - 1.25    # runs along the inside of the wall-side pin row
    zl, zx, zu = 2.0, 1.45, L.pico_zc - 0.45
    xe = -0.45                  # just inside the Pico edge

    row_x = L.seat_x1 - 1.27
    y_vin = L.seat_y1 - (L.max_l - 6 * 2.54) / 2
    MX = lambda i: (row_x, y_vin - i * 2.54, L.max_zt + 1.2)
    my0 = L.mpu_y0 + (L.mpu_L - 7 * 2.54) / 2
    MP = lambda i: (L.mpu_x0 + 1.27, my0 + i * 2.54, L.mpu_zb + L.mpu_t + 1.2)
    TP = lambda f: (L.tp_x0 + f * L.tp_w, L.tp_y1 - 1.8, L.tp_z0 + L.tp_t + 0.5)
    leg = lambda dx: (L.sw_cx + dx, L.sw_y0 + 2.2, L.sw_z0 - 1.8)
    gapF = py(0) + 1.27         # between pins 1 and 2: wires from the TP4056 to the switch side
    gapM = py(15) + 1.27        # between pins 16 and 17: wires up to the MPU-6050 and battery

    def under(pin, yc):
        """Wall-row tail, along the lane, under the Pico, out at the sensor side."""
        t = PW(pin)
        return [t, (lane, t[1], zl), (lane, yc, zl), (lane - 0.6, yc, zx), (-0.9, yc, zx), (-2.0, yc, zl)]

    def to_mpu(i):
        p = MP(i)
        return [(-2.0, 14.6, 3.0), (-2.0, 14.6, 9.0), (L.row_in, gapM, 9.7), (2.2, gapM, 11.0), (2.2, p[1], 11.0), p]

    R = {}
    # ---- MPU-6050: up through the tray opening, across the near pin row ----
    R['mpu_sda'] = (YELLOW, under(31, 12.1) + to_mpu(3))
    R['mpu_scl'] = (BLUE, under(32, 12.5) + to_mpu(2))
    R['mpu_gnd'] = (BLACK, under(33, 12.9) + to_mpu(1))
    R['mpu_int'] = (GREY, under(34, 12.1) + to_mpu(7))
    R['mpu_vcc'] = (RED, under(36, 12.5) + to_mpu(0))

    # ---- MAX30102 ----
    def max_to(i, pin):
        m, t = MX(i), PI(pin)
        return [m, (m[0], m[1], 5.0), (-3.0, (m[1] + t[1]) / 2, 4.4), (-1.6, t[1], zu), (xe, t[1], zu), t]
    R['max_sda'] = (YELLOW, max_to(2, 6))
    R['max_scl'] = (BLUE, max_to(1, 7))
    R['max_int'] = (GREY, max_to(3, 9))
    R['max_gnd'] = (BLACK, max_to(6, 8))
    m, t = MX(0), PW(36)
    R['max_vin'] = (RED, [m, (m[0], m[1], 5.0), (-3.0, 2.0, 4.4), (-2.6, -18.0, 3.0), (-2.0, -20.5, zl), (-0.9, -20.5, zx), (lane - 0.6, -20.5, zx),
                          (lane, -20.5, zl), (lane, t[1], zl), t])

    # ---- button ----
    b = L.btn_cx
    t = PI(19)
    R['btn_sig'] = (GREEN, [(b + 4.45, 22.0, 5.5), (-3.0, 22.2, 4.6), (-1.6, t[1], zu), (xe, t[1], zu), t])
    t = PI(18)
    R['btn_gnd'] = (BLACK, [(b - 4.45, 22.0, 5.5), (b - 5.1, 22.0, 5.6), (b - 5.1, 17.9, 5.0), (-3.0, 18.0, 4.6), (-1.6, t[1], zu), (xe, t[1], zu), t])

    # ---- motor and its driver (small-parts corner on the floor) ----
    q = (-16.0, -19.7, 2.6)
    mz = L.motor_z0 + L.motor_t + 0.7
    mx = L.motor_cx + L.motor_d / 2 + 0.4
    R['mot_red'] = (RED, [(mx, L.motor_cy - 0.6, mz), (-5.0, 9.0, 5.0), (-6.6, 4.9, 5.0), MX(0)])
    R['mot_blue'] = (GREY, [(mx, L.motor_cy + 0.6, mz), (-3.6, 10.0, 5.6), (-3.6, -15.0, 5.6), (-14.5, -19.0, 5.2), (-16.0, -19.4, 4.4), q])
    t = PI(13)
    R['q_emit'] = (BLACK, [q, (-15.6, -19.2, 5.2), (-4.0, -16.0, 5.4), (-3.0, 5.0, 5.0), (-1.6, t[1], zu), (xe, t[1], zu), t])
    t = PI(20)
    R['gp15'] = (GREEN, [t, (xe, t[1], zu), (-1.6, t[1], zu), (-2.6, 20.0, 5.0), (-3.0, -14.0, 5.4), (-6.0, -19.0, 4.6), (-7.5, -19.5, 2.7)])
    R['r_base'] = (GREEN, [(-13.1, -19.5, 2.7), (-13.6, -19.4, 3.6), (-15.6, -19.4, 3.6), q])

    # ---- power ----
    op, om, bp, bm = TP(0.82), TP(0.16), TP(0.6), TP(0.38)
    across = [(3.0, -0.5, 11.2), (3.0, -21.0, 11.2), (2.6, gapF, 10.6), (L.row_in, gapF, 10.0), (-1.5, gapF, 9.8)]
    R['out_plus'] = (RED, [op, (op[0], op[1], 11.2)] + across + [(-3.4, gapF, 9.0), (-3.4, gapF, 6.6), (-6.5, -22.6, 5.6), (-9.6, -22.6, 5.8), leg(0)])
    t = PW(38)
    R['out_minus'] = (BLACK, [om, (om[0], om[1], 11.2)] + across + [(-2.9, gapF, 9.0), (-2.9, gapF, 6.0), (-2.2, -21.2, 2.6), (-0.9, -20.95, zx),
                                                                     (lane - 0.6, -20.95, zx), (lane, -20.95, zl), (lane, t[1], zl), t])
    t = PW(39)
    R['vsys'] = (RED, [(-3.5, -23.0, 2.95), (-2.6, -21.6, 2.6), (-0.9, -20.05, zx), (lane - 0.6, -20.05, zx), (lane, -20.05, zl), (lane, t[1], zl), t])
    R['sw_out'] = (RED, [leg(2), (-8.0, -22.9, 5.2), (-12.5, -22.9, 5.0), (-12.6, -23.0, 3.0), (-12.1, -23.05, 2.95)])
    zb = L.bat_z0 + 2.0
    for name, col, x, pad in (('bat_red', RED, -11.0, bp), ('bat_black', BLACK, -13.0, bm)):
        R[name] = (col, [(x, L.bat_y1 + 0.1, zb), (x, 13.4, zb), (-2.0, 14.6, zb - 0.2), (L.row_in, gapM, zb - 0.1), (2.4, gapM, 12.6), (5.0, 10.0, 12.6),
                         (pad[0], 4.0, 12.6), (pad[0], 1.6, 11.4), pad])
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
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from build import layout, to_trimesh
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
        ends = Manifold.batch_boolean([sphere(pts[0], 1.6), sphere(pts[-1], 1.6)], OpType.Add)
        core = t - ends     # the two ends are meant to touch their pin or pad
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
