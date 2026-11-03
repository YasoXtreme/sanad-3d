// A small keyframe timeline. Every animated thing (a part, a wire, the camera)
// has a track. Steps are authored in order; each `to()` tween starts from the
// pose the track had at the end of the previous tween, so any moment of the
// whole assembly can be evaluated from scratch. That makes scrubbing and
// jumping between steps exact.

export const EASE = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // overshoots a little, then settles (the design system's "bounce-in")
  back: (t) => {
    const c1 = 1.5, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  // a part dropping into its pocket: fast in, small settle at the end
  drop: (t) => {
    if (t < 0.8) { const u = t / 0.8; return u * u * 1.0; }
    const u = (t - 0.8) / 0.2;
    return 1 - Math.sin(u * Math.PI) * 0.025;
  },
};

function lerp(a, b, k) { return a + (b - a) * k; }

function lerpPose(a, b, k) {
  const out = {};
  for (const key in b) {
    const va = a[key], vb = b[key];
    if (Array.isArray(vb)) {
      const arr = new Array(vb.length);
      for (let i = 0; i < vb.length; i++) arr[i] = lerp(va ? va[i] : vb[i], vb[i], k);
      out[key] = arr;
    } else if (typeof vb === 'number') {
      out[key] = lerp(va === undefined ? vb : va, vb, k);
    } else {
      out[key] = k < 1 ? (va === undefined ? vb : va) : vb;
    }
  }
  return out;
}

export class Timeline {
  constructor() {
    this.tracks = new Map();
    this.steps = [];
    this.total = 0;
    this._s = null;
  }

  // Declare a track and the pose it has before any tween.
  def(id, initial) {
    if (this.tracks.has(id)) throw new Error(`track ${id} defined twice`);
    this.tracks.set(id, { initial: { ...initial }, cur: { ...initial }, segs: [] });
  }

  has(id) { return this.tracks.has(id); }

  // Start authoring a step that lasts `dur` seconds.
  step(dur) {
    const s = { start: this.total, dur };
    this.steps.push(s);
    this.total += dur;
    this._s = s;
    return s;
  }

  // Tween track `id` to `pose` between local times t0 and t1 of the current step.
  to(id, t0, t1, pose, ease = 'inOut') {
    const tr = this.tracks.get(id);
    if (!tr) throw new Error(`unknown track ${id}`);
    const g0 = this._s.start + t0, g1 = this._s.start + t1;
    const last = tr.segs[tr.segs.length - 1];
    if (last && g0 < last.g1 - 1e-6) console.warn(`track ${id}: tween at ${t0}s overlaps the previous one`);
    const from = { ...tr.cur };
    const to = { ...tr.cur, ...pose };
    tr.segs.push({ g0, g1, from, to, ease: EASE[ease] || EASE.inOut });
    tr.cur = to;
  }

  // Jump track `id` to `pose` at local time t.
  set(id, t, pose) { this.to(id, t, t, pose, 'linear'); }

  // Current pose (at the end of everything authored so far).
  cur(id) { return this.tracks.get(id).cur; }

  // Pose of track `id` at global time g.
  eval(id, g) {
    const tr = this.tracks.get(id);
    let pose = tr.initial;
    for (const s of tr.segs) {
      if (g < s.g0) break;
      if (g >= s.g1) { pose = s.to; continue; }
      const k = s.ease((g - s.g0) / (s.g1 - s.g0));
      return lerpPose(s.from, s.to, k);
    }
    return pose;
  }
}
