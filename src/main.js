import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { computeLayout } from './layout.js';
import { Timeline } from './anim.js';
import { buildParts } from './parts.js';
import { buildWires } from './wires.js';
import { makeSteps, author, MAT_Z } from './steps.js';

const DEG = Math.PI / 180;
const ZERO = [0, 0, 0];
const $ = (s, el = document) => el.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const L = computeLayout();
const STEPS = makeSteps(L);
const MODELS = {
  body: 'models/sanad-body.stl',
  pad: 'models/sanad-sensor-pad.stl',
  tray: 'models/sanad-tray.stl',
  lid: 'models/sanad-lid.stl',
};

const state = {
  step: 0, t: 0, playing: false, speed: 1, playAll: false,
  userCam: false, xray: false, section: false, labels: true, wires: true,
};
const SPEEDS = [0.5, 1, 1.5, 2];
let needsRender = true, poseDirty = true, lastItem = -1;

// ---------------------------------------------------------------------------
// panel (renders right away, before the models load)

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const stepsEl = $('#steps');
stepsEl.innerHTML = STEPS.map((s, i) => `
  <li class="step" data-i="${i}">
    <button class="step-head" type="button" id="step-head-${i}" aria-controls="step-body-${i}">
      <span class="num">${s.num}</span>
      <span class="title">${s.title}</span>
      <span class="dur">${fmt(s.dur)}</span>
    </button>
    <div class="step-body" id="step-body-${i}" hidden>
      ${s.warn ? `<p class="warn"><span class="material-symbols-outlined" aria-hidden="true">warning</span><span>${s.warn}</span></p>` : ''}
      <ol class="items">
        ${s.items.map((it, j) => `<li><button class="item" type="button" data-j="${j}">
          <span class="at">${fmt(it.t)}</span><span class="txt">${it.html}</span></button></li>`).join('')}
      </ol>
      ${s.extra || ''}
    </div>
  </li>`).join('');

stepsEl.addEventListener('click', (e) => {
  const head = e.target.closest('.step-head');
  if (head) { goStep(+head.parentElement.dataset.i, true); return; }
  const item = e.target.closest('.item');
  if (item) {
    const i = +item.closest('.step').dataset.i;
    if (i !== state.step) goStep(i, false);
    seek(STEPS[i].items[+item.dataset.j].t + 0.001);
    setPlaying(true);
  }
});

// ---------------------------------------------------------------------------
// three.js

const viewport = $('#viewport');
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  showError('This page needs WebGL to draw the 3D model, and it isn’t available in this browser.');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 4000);
// CAD coordinates are Z-up; turn them so Z points up on screen
const world = new THREE.Group();
world.rotation.x = -Math.PI / 2;
scene.add(world);
const toThree = (v, out = new THREE.Vector3()) => out.set(v[0], v[2], -v[1]);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb4bba9, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
toThree([70, -60, 160], sun.position);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -190, right: 190, top: 190, bottom: -190, near: 10, far: 600 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.55);
toThree([-90, 70, 50], fill.position);
scene.add(fill);
// soft light from below, for the views from underneath
const under = new THREE.DirectionalLight(0xffffff, 0.9);
toThree([-30, -50, -120], under.position);
scene.add(under);

// the cutting mat: a 10 mm grid
const matMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
const mat = new THREE.Mesh(new THREE.PlaneGeometry(440, 440), matMat);
mat.position.set(0, -40, MAT_Z);
mat.receiveShadow = true;
world.add(mat);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.minDistance = 18;
controls.maxDistance = 700;
controls.addEventListener('start', () => { state.userCam = true; $('#reset-view').classList.add('live'); });

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const c = (n) => cs.getPropertyValue(n).trim() || '#ffffff';
  scene.background = new THREE.Color(c('--stage'));
  matMat.map?.dispose();
  matMat.map = gridTexture(c('--mat'), c('--mat-line'), c('--mat-major'));
  matMat.needsUpdate = true;
  requestRender();
}
function gridTexture(bg, line, major) {
  const px = 640, mm = 100; // one 100 mm tile, repeated
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px);
  const k = px / mm;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 5 === 0 ? major : line;
    const w = i % 5 === 0 ? 3 : 1.6;
    ctx.fillRect(i * 10 * k - w / 2, 0, w, px);
    ctx.fillRect(0, i * 10 * k - w / 2, px, w);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4.4, 4.4);
  t.offset.set(0.5, 0.1);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
readTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------------------------------------------------------------------------
// load the print files, then build the scene

let P, tl, order = [];
const loadingEl = $('#loading');

async function loadModels() {
  const loader = new STLLoader();
  const out = {};
  let done = 0;
  const bar = $('#load-bar');
  await Promise.all(Object.entries(MODELS).map(async ([k, url]) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    out[k] = loader.parse(await res.arrayBuffer());
    done++;
    bar.style.width = `${(done / 4) * 100}%`;
    $('#load-count').textContent = `${done} of 4`;
  }));
  return out;
}

loadModels().then((stl) => {
  P = buildParts(L, world, stl);
  buildWires(P);
  tl = new Timeline();
  author(tl, STEPS, P.objs);
  order = Object.values(P.objs);
  for (const m of P.sectionMats) {
    m.userData.side = m.side;
    if (m.isMeshStandardMaterial) m.onBeforeCompile = sectionCap;
  }
  loadingEl.hidden = true;
  document.body.classList.add('ready');
  const fromHash = /^#step-(\d+)$/.exec(location.hash);
  goStep(fromHash ? Math.min(STEPS.length - 1, +fromHash[1]) : 0, !reduceMotion);
  requestAnimationFrame(frame);
}).catch((err) => {
  console.error(err);
  showError('The print files didn’t load. If you opened index.html straight from your disk, serve the folder instead (see the README), then reload.');
});

function showError(msg) {
  loadingEl.hidden = false;
  loadingEl.classList.add('error');
  loadingEl.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">error</span><p>${msg}</p>`;
}

// Cut faces of a section show the inside of the part, hatched.
function sectionCap(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
    if (!gl_FrontFacing) {
      float h = step(0.5, fract((gl_FragCoord.x - gl_FragCoord.y) / 9.0));
      gl_FragColor = vec4(diffuseColor.rgb * mix(0.52, 0.72, h), 1.0);
    }`);
}

// ---------------------------------------------------------------------------
// applying the timeline

function setShown(o, v) {
  if (Math.abs(v - o._shown) < 1e-4) return;
  o._shown = v;
  o.g.visible = v > 0.003;
  for (const m of o.mats) {
    const base = m.userData.baseOpacity ?? 1;
    const op = base * v;
    m.opacity = op;
    const tr = op < 0.999 || base < 1 || m.isSpriteMaterial || m.isLineBasicMaterial;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.depthWrite = !m.isSpriteMaterial && op > 0.5;
  }
}

const secPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
let secOn = false;
function applySection(on, y) {
  // keep CAD y > cut (three z = -CAD y)
  secPlane.constant = -y;
  if (on === secOn) return;
  secOn = on;
  for (const m of P.sectionMats) {
    m.clippingPlanes = on ? [secPlane] : null;
    m.side = on ? THREE.DoubleSide : m.userData.side;
    m.needsUpdate = true;
  }
}

function gNow() {
  const s = tl.steps[state.step];
  return s.start + Math.min(state.t, s.dur - 1e-4);
}

function applyAll() {
  const g = gNow();
  for (const o of order) {
    const pose = tl.eval(o.id, g);
    const pp = pose.p || ZERO, r = pose.r || ZERO;
    o.g.position.set(o.home[0] + pp[0], o.home[1] + pp[1], o.home[2] + pp[2]);
    o.g.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
    let eff = (pose.o ?? 1) * (o.parentObj ? o.parentObj._effO : 1);
    if (o.kind === 'wire' && !state.wires) eff = 0;
    o._effO = eff;
    setShown(o, o.xray && state.xray ? eff * 0.2 : eff);
    if (o.update) o.update(pose, g);
  }
  const sec = tl.eval('section', g);
  if (state.section) applySection(true, L.chip_y);
  else applySection(sec.on > 0.5, sec.y);
  const gr = tl.eval('ground', g).o;
  mat.visible = gr > 0.003;
  matMat.transparent = gr < 0.999;
  matMat.opacity = gr;
}

// ---------------------------------------------------------------------------
// camera: follows the timeline until you drag; "Reset view" hands it back

const cam = { t: [0, 0, 6], az: -58, el: 28, d: 150 };
let camReady = false;
function camFromCurrent() {
  const tg = controls.target, pos = camera.position;
  const t = [tg.x, -tg.z, tg.y], p = [pos.x, -pos.z, pos.y];
  const off = [p[0] - t[0], p[1] - t[1], p[2] - t[2]];
  const d = Math.hypot(...off);
  cam.t = t; cam.d = d;
  cam.el = Math.asin(off[2] / d) / DEG;
  cam.az = Math.atan2(off[1], off[0]) / DEG;
}
function placeCamera() {
  const az = cam.az * DEG, el = cam.el * DEG;
  const p = [cam.t[0] + cam.d * Math.cos(el) * Math.cos(az), cam.t[1] + cam.d * Math.cos(el) * Math.sin(az),
    cam.t[2] + cam.d * Math.sin(el)];
  toThree(p, camera.position);
  toThree(cam.t, controls.target);
  camera.lookAt(controls.target);
}
function followCamera(dt) {
  const goal = tl.eval('cam', gNow());
  if (!camReady) { Object.assign(cam, { ...goal, t: goal.t.slice() }); camReady = true; placeCamera(); return true; }
  const k = 1 - Math.exp(-dt * 7);
  let moved = false;
  const ease = (a, b) => { const v = a + (b - a) * k; if (Math.abs(b - a) > 1e-3) moved = true; return v; };
  let daz = ((goal.az - cam.az + 540) % 360) - 180;
  cam.az = ease(cam.az, cam.az + daz);
  cam.el = ease(cam.el, goal.el);
  cam.d = ease(cam.d, goal.d);
  cam.t = cam.t.map((v, i) => ease(v, goal.t[i]));
  placeCamera();
  return moved;
}

$('#reset-view').addEventListener('click', () => {
  camFromCurrent();
  state.userCam = false;
  $('#reset-view').classList.remove('live');
  requestRender();
});

// ---------------------------------------------------------------------------
// callouts, readouts

const labelsEl = $('#labels');
const leadersEl = $('#leaders');
const hudEl = $('#hud');
let activeLabels = [];
let hudItems = [];

function buildOverlays() {
  const s = STEPS[state.step];
  labelsEl.innerHTML = '';
  leadersEl.innerHTML = '';
  activeLabels = (s.labels || []).map((lb) => {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = lb.text;
    el.hidden = true;
    labelsEl.appendChild(el);
    const ns = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'line');
    const ring = document.createElementNS(ns, 'circle');
    const dot = document.createElementNS(ns, 'circle');
    line.setAttribute('class', 'leader'); ring.setAttribute('class', 'ring'); dot.setAttribute('class', 'dot');
    ring.setAttribute('r', '9'); dot.setAttribute('r', '4.5');
    const grp = document.createElementNS(ns, 'g');
    grp.append(line, ring, dot);
    grp.style.display = 'none';
    leadersEl.appendChild(grp);
    return { ...lb, el, grp, line, ring, dot, on: false, w: 0, h: 0 };
  });
  hudEl.innerHTML = '';
  hudItems = (s.hud || []).map((h) => {
    const el = document.createElement('div');
    el.className = `hud-${h.kind}`;
    el.hidden = true;
    if (h.kind === 'legend') {
      el.innerHTML = `<p class="hud-title">Wire colours</p><ul>${[['red', '3V3'], ['black', 'GND'], ['yellow', 'SDA'],
        ['blue', 'SCL'], ['green', 'Signal'], ['grey', 'INT (optional)']]
        .map(([c, n]) => `<li><i style="background:var(--w-${c})"></i>${n}</li>`).join('')}</ul>`;
    } else if (h.kind === 'console') {
      el.innerHTML = '<p class="hud-title">MicroPython · Pico 2 W</p><pre></pre>';
    } else {
      el.innerHTML = h.html;
    }
    hudEl.appendChild(el);
    return { ...h, el, shown: -1 };
  });
}

const v3 = new THREE.Vector3();
function updateOverlays() {
  const t = state.t;
  const W = viewport.clientWidth, H = viewport.clientHeight;
  const placed = [];
  for (const lb of activeLabels) {
    const on = state.labels && t >= lb.t0 && t < lb.t1;
    if (on !== lb.on) {
      lb.on = on;
      lb.el.hidden = !on;
      lb.grp.style.display = on ? '' : 'none';
      if (on) { lb.w = lb.el.offsetWidth; lb.h = lb.el.offsetHeight; }
    }
    if (!on) continue;
    v3.set(lb.at[0], lb.at[1], lb.at[2]);
    if (lb.obj && P.objs[lb.obj]) P.objs[lb.obj].inner.localToWorld(v3);
    else world.localToWorld(v3);
    v3.project(camera);
    const behind = v3.z > 1;
    const ax = (v3.x * 0.5 + 0.5) * W, ay = (-v3.y * 0.5 + 0.5) * H;
    let dx = ax - W / 2, dy = ay - H / 2;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    if (len < 30) { dx = 0.7; dy = -0.7; }
    let lx = ax + dx * 74 - (dx < 0 ? lb.w : 0), ly = ay + dy * 52 - lb.h / 2;
    lx = Math.max(10, Math.min(W - lb.w - 10, lx));
    ly = Math.max(58, Math.min(H - lb.h - 34, ly));
    placed.push({ lb, ax, ay, lx, ly, behind });
  }
  // nudge overlapping callouts apart
  placed.sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < placed.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = placed[j], b = placed[i];
      const ox = Math.min(a.lx + a.lb.w, b.lx + b.lb.w) - Math.max(a.lx, b.lx);
      const oy = a.ly + a.lb.h + 6 - b.ly;
      if (ox > 0 && oy > 0) b.ly += oy;
    }
  }
  for (const { lb, ax, ay, lx, ly, behind } of placed) {
    lb.el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
    lb.el.classList.toggle('behind', behind);
    const cx = Math.max(lx, Math.min(lx + lb.w, ax)), cy = Math.max(ly, Math.min(ly + lb.h, ay));
    lb.line.setAttribute('x1', ax); lb.line.setAttribute('y1', ay);
    lb.line.setAttribute('x2', cx); lb.line.setAttribute('y2', cy);
    for (const c of [lb.ring, lb.dot]) { c.setAttribute('cx', ax); c.setAttribute('cy', ay); }
    lb.grp.style.display = behind ? 'none' : '';
  }
  for (const h of hudItems) {
    const on = t >= h.t0 && t < h.t1;
    h.el.hidden = !on;
    if (on && h.kind === 'console') {
      const lines = h.lines.filter((ln) => ln.t <= t);
      if (lines.length !== h.shown) {
        h.shown = lines.length;
        const shown = [...lines.filter((ln) => ln.pin), ...lines.filter((ln) => !ln.pin).slice(-5)];
        h.el.querySelector('pre').innerHTML = shown.map((ln) =>
          `<span class="${ln.cls || ''}">${ln.text}</span>${ln.note ? `<em>  # ${ln.note}</em>` : ''}`).join('\n');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// playback

const playBtn = $('#play');
const scrub = $('#scrub');
const timeEl = $('#time');
const stepNoEl = $('#step-no');
const captionEl = $('#caption');

function requestRender() { needsRender = true; }

function setPlaying(on) {
  state.playing = on;
  playBtn.querySelector('.material-symbols-outlined').textContent = on ? 'pause' : 'play_arrow';
  playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  requestRender();
}

function goStep(i, play) {
  state.step = i;
  state.t = 0;
  state.userCam = false;
  $('#reset-view').classList.remove('live');
  if (camReady) camFromCurrent();
  const s = STEPS[i];
  document.querySelectorAll('.step').forEach((li, k) => {
    li.classList.toggle('active', k === i);
    li.classList.toggle('done', k < i);
    li.querySelector('.step-body').hidden = k !== i;
    li.querySelector('.step-head').setAttribute('aria-expanded', String(k === i));
  });
  const active = $(`.step[data-i="${i}"]`);
  const box = $('.guide');
  if (box.scrollHeight > box.clientHeight + 4) {
    box.scrollTo({ top: active.offsetTop - box.offsetTop - 8, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  scrub.max = String(Math.round(s.dur * 1000));
  $('#ticks').innerHTML = s.items.map((it) => `<i style="left:${(it.t / s.dur) * 100}%"></i>`).join('');
  stepNoEl.textContent = `Step ${s.num} of ${STEPS[STEPS.length - 1].num}`;
  $('#prev').disabled = i === 0;
  $('#next').disabled = i === STEPS.length - 1;
  lastItem = -1;
  buildOverlays();
  try { if (location.hash !== `#step-${s.num}`) history.replaceState(null, '', `#step-${s.num}`); } catch { /* ignore */ }
  poseDirty = true;
  setPlaying(play);
}

function seek(t) {
  state.t = Math.max(0, Math.min(STEPS[state.step].dur, t));
  poseDirty = true;
  requestRender();
}

function updateTransport() {
  const s = STEPS[state.step];
  scrub.value = String(Math.round(state.t * 1000));
  scrub.style.setProperty('--fill', `${(state.t / s.dur) * 100}%`);
  timeEl.textContent = `${fmt(state.t)} / ${fmt(s.dur)}`;
  let cur = 0;
  s.items.forEach((it, j) => { if (state.t >= it.t) cur = j; });
  if (cur !== lastItem) {
    lastItem = cur;
    document.querySelectorAll(`.step[data-i="${state.step}"] .item`).forEach((b, j) => {
      b.classList.toggle('now', j === cur);
      b.classList.toggle('past', j < cur);
    });
    captionEl.innerHTML = `<span>${s.items[cur].html}</span>`;
  }
}

playBtn.addEventListener('click', () => {
  const s = STEPS[state.step];
  if (state.playing) { setPlaying(false); return; }
  if (state.t >= s.dur - 0.02) {
    goStep(state.step < STEPS.length - 1 ? state.step + 1 : 0, true);
    return;
  }
  setPlaying(true);
});
$('#prev').addEventListener('click', () => {
  if (state.t > 1.5) goStep(state.step, true);
  else goStep(Math.max(0, state.step - 1), true);
});
$('#next').addEventListener('click', () => goStep(Math.min(STEPS.length - 1, state.step + 1), true));
$('#replay').addEventListener('click', () => goStep(state.step, true));
scrub.addEventListener('input', () => { setPlaying(false); seek(+scrub.value / 1000); });
const speedBtn = $('#speed');
speedBtn.addEventListener('click', () => {
  state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length];
  speedBtn.querySelector('.v').textContent = `${state.speed}×`;
});
const toggle = (id, key, after) => {
  const b = $(id);
  const sync = () => { b.classList.toggle('on', state[key]); b.setAttribute('aria-pressed', String(state[key])); };
  b.addEventListener('click', () => { state[key] = !state[key]; sync(); after?.(); poseDirty = true; requestRender(); });
  sync();
};
toggle('#play-all', 'playAll');
toggle('#t-xray', 'xray');
toggle('#t-section', 'section');
toggle('#t-labels', 'labels');
toggle('#t-wires', 'wires');

window.addEventListener('keydown', (e) => {
  // the scrubber uses the arrow keys itself, and a focused button already handles Space
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); playBtn.click(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); $('#next').click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); $('#prev').click(); }
});
window.addEventListener('hashchange', () => {
  const m = /^#step-(\d+)$/.exec(location.hash);
  if (m && P && +m[1] !== state.step && +m[1] < STEPS.length) goStep(+m[1], true);
});

new ResizeObserver(() => {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const lb of activeLabels) if (lb.on) { lb.w = lb.el.offsetWidth; lb.h = lb.el.offsetHeight; }
  requestRender();
}).observe(viewport);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (state.playing) {
    const s = STEPS[state.step];
    state.t += dt * state.speed;
    if (state.t >= s.dur) {
      if (state.playAll && state.step < STEPS.length - 1) goStep(state.step + 1, true);
      else { state.t = s.dur; setPlaying(false); }
    }
    poseDirty = true;
  }
  let dirty = needsRender;
  needsRender = false;
  if (poseDirty) { applyAll(); updateTransport(); poseDirty = false; dirty = true; }
  if (state.userCam) { if (controls.update()) dirty = true; } else if (followCamera(dt)) dirty = true;
  if (dirty) {
    renderer.render(scene, camera);
    updateOverlays();
  }
}

// test hook: only with ?debug in the URL
if (new URLSearchParams(location.search).has('debug')) {
  window.sanad = { goStep, seek, setPlaying, state, STEPS, ready: () => !!P };
}
