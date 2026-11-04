#!/usr/bin/env python3
"""Fit checks for Sanad v2b. Usage: python cad/check.py

Every electronic stand-in is tested against every printed part and against
the other electronics. A clash is any shared volume above 0.001 mm^3.
"""
import glob
import itertools
import json
import os
import sys

import numpy as np
import trimesh
from manifold3d import Manifold, Mesh


def load(path):
    t = trimesh.load(path)
    return Manifold(Mesh(vert_properties=np.asarray(t.vertices, np.float32),
                         tri_verts=np.asarray(t.faces, np.uint32)))


def vol(m):
    return abs(m.volume()) if not m.is_empty() else 0.0


# Pairs that are meant to touch or nest: the board and what is soldered to it.
ALLOWED = [
    ('pico_pins', 'pico_pcb'), ('pico_pins', 'pico_strip_in'), ('pico_pins', 'pico_strip_wall'),
    ('max_board', 'max_board_largest'), ('max_board', 'max_stubs'), ('max_board_largest', 'max_stubs'),
    ('max_chip', 'max_board'), ('max_chip', 'max_board_largest'),
    ('tp_board', 'tp_usbc'), ('tp_board', 'tp_ic'),
    ('mpu_board', 'mpu_parts'), ('mpu_board', 'mpu_stubs'),
    ('switch', 'switch_knob_off'), ('switch', 'switch_knob_on'), ('switch', 'switch_legs'),
    ('switch_knob_off', 'switch_knob_on'),
    ('button', 'button_plunger'),
]


def is_allowed(a, b):
    return (a, b) in ALLOWED or (b, a) in ALLOWED or (a.startswith('pico_') and b.startswith('pico_') and
                                                      'pins' not in a + b)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    A = f'{root}/cad/assembled'
    printed = {k: load(f'{A}/{k}.stl') for k in ('body', 'pad', 'tray', 'lid')}
    comps = {os.path.basename(p)[:-4]: load(p) for p in sorted(glob.glob(f'{A}/components/*.stl'))}
    bad = 0

    print('Printed part vs printed part')
    for (a, ma), (b, mb) in itertools.combinations(printed.items(), 2):
        v = vol(ma ^ mb)
        print(f'  {"CLASH" if v > 1e-3 else "ok   "} {a:6s} {b:6s} {v:9.3f}')
        bad += v > 1e-3

    print('Electronics vs printed parts (clashes only)')
    for c, mc in comps.items():
        for p, mp in printed.items():
            v = vol(mc ^ mp)
            if v > 1e-3:
                bad += 1
                bb = (mc ^ mp).bounding_box()
                print(f'  CLASH {c:20s} {p:6s} {v:8.3f} mm3  at {np.round(bb, 2).tolist()}')

    print('Electronics vs electronics (clashes only)')
    for (a, ma), (b, mb) in itertools.combinations(comps.items(), 2):
        if is_allowed(a, b):
            continue
        v = vol(ma ^ mb)
        if v > 1e-3:
            bad += 1
            bb = (ma ^ mb).bounding_box()
            print(f'  CLASH {a:20s} {b:20s} {v:8.3f} mm3  at {np.round(bb, 2).tolist()}')

    print(f'\n{len(comps)} electronic solids, {len(printed)} printed parts, {bad} clash(es)')

    print('\nOuter size against v1 (mm)')
    allm = trimesh.util.concatenate([trimesh.load(f'{A}/{k}.stl') for k in ('body', 'lid')])
    ext = allm.extents
    print(f'  X incl. lugs {ext[0]:.2f} (v1 53.00)   Y {ext[1]:.2f} (v1 54.60)   Z {ext[2]:.2f} (v1 14.50, notes 14.0)')
    b = trimesh.load(f'{A}/body.stl')
    s = b.section(plane_origin=[0, 0, 6], plane_normal=[0, 0, 1])
    v = s.vertices
    core = v[(np.abs(v[:, 1]) < 9)]
    print(f'  body width at the strap {core[:, 0].max() - core[:, 0].min():.2f} (v1 43.00)')
    return bad


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
