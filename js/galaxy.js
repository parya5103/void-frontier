/* ============================================================================
 * VOID FRONTIER — js/galaxy.js
 * Interactive 3D galaxy built on the vendored three.js r160 core.
 *  - starfield backdrop + one star per system + orbiting original worlds
 *  - procedural canvas textures (no imported art, no external assets)
 *  - custom pointer orbit/zoom controls (mouse + touch), no OrbitControls dep
 *  - raycast picking, smooth camera fly-to, screen-space labels
 * Everything here is original to this project.
 * ==========================================================================*/

import * as THREE from './vendor/three.module.min.js';
import { SYSTEMS, PLANET_TYPES, planetType, getPlanet } from './data.js';

const ORBIT_SCALE = 0.52;   // orbit distances are compressed for a compact system view
const PLANET_BASE_R = 0.62; // planet mesh radius = PLANET_BASE_R * size
const STAR_R = 1.5;
const CAM_OVERVIEW = 96;
const CAM_SYSTEM = 15;
const CAM_PLANET = 6.2;

export class GalaxyView {
  constructor(canvas, labelsEl) {
    this.canvas = canvas;
    this.labelsEl = labelsEl || null;
    this.onSelectPlanet = null;
    this.onSelectSystem = null;
    this.onFocusChange = null;

    this._raf = null;
    this._clock = null;
    this._disposed = false;

    this.pickables = [];          // meshes with userData {kind, systemId, planetId}
    this.planetMeshes = new Map(); // planetId -> mesh
    this.systemNodes = new Map();  // systemId -> group
    this.labelNodes = [];          // {el, obj, kind}

    this.target = new THREE.Vector3(0, 0, 0);
    this.targetGoal = new THREE.Vector3(0, 0, 0);
    this.spherical = { radius: CAM_OVERVIEW, theta: 0.7, phi: 1.05 };
    this.goal = { radius: CAM_OVERVIEW, theta: 0.7, phi: 1.05 };

    this.focus = { systemId: null, planetId: null };
    this.labelsVisible = true;

    // WebGL context-loss recovery state
    this.contextLost = false;
    this._ctxBound = false;
    this._contextTimer = null;
    this.onContextLost = null;
    this.onContextRestored = null;

    // The canvas element outlives renderer rebuilds, so bind context-loss
    // events (and the retry button) exactly once here.
    this._bindContextEventsOnce();
    const retry = document.getElementById('gfx-retry');
    if (retry) retry.addEventListener('click', () => this.recover());
  }

  /* ------------------------------------------------------------------ init */
  init() {
    const c = this.canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x05070f, 1);
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 4000);

    // lighting — one cool key, one warm rim, faint ambient
    this.scene.add(new THREE.AmbientLight(0x4a5a78, 0.55));
    const key = new THREE.DirectionalLight(0xbcd2ff, 1.15); key.position.set(28, 40, 30); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb066, 0.5); rim.position.set(-40, -18, -32); this.scene.add(rim);

    this._buildStarfield();
    this._buildSystems();
    this._resize();
    this._bindInput();

    this._clock = new THREE.Clock();
    this._loop();
    return this;
  }

  _buildStarfield() {
    const N = 2600;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = 320 + Math.random() * 900;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.55;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const t = Math.random();
      c.setHSL(0.55 + (Math.random() - 0.5) * 0.18, 0.5, 0.55 + t * 0.4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    this.starfield = new THREE.Points(g, m);
    this.scene.add(this.starfield);
  }

  _buildSystems() {
    for (const sys of SYSTEMS) {
      const node = new THREE.Group();
      node.position.set(sys.x, sys.y, sys.z);

      // star
      const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(sys.primary) });
      const star = new THREE.Mesh(new THREE.SphereGeometry(STAR_R, 32, 24), starMat);
      star.userData = { kind: 'star', systemId: sys.id };
      node.add(star);
      this.pickables.push(star);

      // star glow sprite
      const glowTex = makeGlowTexture(sys.primary);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
      glow.scale.setScalar(STAR_R * 9);
      node.add(glow);

      const light = new THREE.PointLight(new THREE.Color(sys.primary), 2.2, 60, 2);
      node.add(light);

      // planets
      for (const p of sys.planets) {
        const t = planetType(p);
        const orbitR = p.dist * ORBIT_SCALE;
        const r = PLANET_BASE_R * (p.size || 1);

        const tex = makePlanetTexture(t, p.seed || 1);
        const mat = new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.92, metalness: t.id === 'crystalline' ? 0.35 : 0.06,
          emissive: new THREE.Color(t.accent).multiplyScalar(t.id === 'volcanic' ? 0.22 : 0.06),
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 36), mat);
        mesh.userData = { kind: 'planet', systemId: sys.id, planetId: p.id, orbitR, angle: (p.seed % 360) * (Math.PI / 180), spin: 0.06 + (p.seed % 7) * 0.01, r };
        mesh.position.set(Math.cos(mesh.userData.angle) * orbitR, 0, Math.sin(mesh.userData.angle) * orbitR);

        // atmosphere shell
        const atmo = new THREE.Mesh(
          new THREE.SphereGeometry(r * 1.09, 40, 30),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(t.atmosphere), transparent: true, opacity: 0.14, side: THREE.BackSide, depthWrite: false })
        );
        mesh.add(atmo);

        // ring for crystalline worlds (procedural, original)
        if (t.id === 'crystalline') {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(r * 1.5, r * 2.15, 64),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(t.accent), transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
          );
          ring.rotation.x = Math.PI / 2.4;
          mesh.add(ring);
        }

        node.add(mesh);
        this.pickables.push(mesh);
        this.planetMeshes.set(p.id, mesh);

        // orbit line
        const pts = [];
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR));
        }
        const og = new THREE.BufferGeometry().setFromPoints(pts);
        const ol = new THREE.Line(og, new THREE.LineBasicMaterial({ color: 0x35507a, transparent: true, opacity: 0.32 }));
        node.add(ol);
      }

      this.scene.add(node);
      this.systemNodes.set(sys.id, node);
    }
  }

  /* --------------------------------------------------------------- labels */
  _buildLabels() {
    if (!this.labelsEl) return;
    this.labelsEl.innerHTML = '';
    this.labelNodes = [];
    for (const sys of SYSTEMS) {
      const el = document.createElement('div');
      el.className = 'lbl lbl-sys';
      el.textContent = sys.name;
      el.dataset.system = sys.id;
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => { e.stopPropagation(); if (this.onSelectSystem) this.onSelectSystem(sys.id); });
      this.labelsEl.appendChild(el);
      this.labelNodes.push({ el, obj: this.systemNodes.get(sys.id), kind: 'sys', systemId: sys.id });
    }
    for (const sys of SYSTEMS) {
      for (const p of sys.planets) {
        const el = document.createElement('div');
        el.className = 'lbl lbl-planet';
        el.textContent = p.name;
        el.dataset.planet = p.id;
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => { e.stopPropagation(); if (this.onSelectPlanet) this.onSelectPlanet(sys.id, p.id); });
        this.labelsEl.appendChild(el);
        this.labelNodes.push({ el, obj: this.planetMeshes.get(p.id), kind: 'planet', systemId: sys.id, planetId: p.id });
      }
    }
  }

  _updateLabels() {
    if (!this.labelsEl || !this.labelsVisible) return;
    const w = this._w || 1, h = this._h || 1;
    const v = new THREE.Vector3();
    for (const ln of this.labelNodes) {
      if (!ln.obj) continue;
      // visibility rules: system labels always (unless overlapping overview is too far)
      const dist = this.camera.position.distanceTo(ln.obj.getWorldPosition(v));
      let show = true;
      if (ln.kind === 'sys') show = true;
      else show = (this.focus.systemId === ln.systemId) && dist < CAM_SYSTEM * 2.6;
      if (!show) { ln.el.style.display = 'none'; continue; }
      this.camera.getWorldDirection(_tmpDir);
      ln.obj.getWorldPosition(v);
      const toObj = _tmpV.copy(v).sub(this.camera.position);
      const behind = toObj.dot(_tmpDir) < 0;
      v.project(this.camera);
      if (behind || v.z > 1) { ln.el.style.display = 'none'; continue; }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      ln.el.style.display = 'block';
      ln.el.style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      ln.el.classList.toggle('is-sel', ln.kind === 'planet' && ln.planetId === this.focus.planetId);
      const fade = Math.max(0.25, Math.min(1, 1 - dist / 90));
      ln.el.style.opacity = ln.kind === 'sys' ? fade.toFixed(2) : Math.min(1, fade + 0.35).toFixed(2);
    }
  }

  /* ---------------------------------------------------------------- focus */
  focusSystem(systemId, immediate) {
    const node = this.systemNodes.get(systemId);
    if (!node) return;
    this.focus.systemId = systemId;
    this.focus.planetId = null;
    this.targetGoal.copy(node.position);
    this.goal.radius = CAM_SYSTEM;
    this.goal.phi = 1.02; this.goal.theta = 0.7;
    if (immediate) { this.target.copy(this.targetGoal); this.spherical.radius = this.goal.radius; this.spherical.phi = this.goal.phi; this.spherical.theta = this.goal.theta; }
    if (this.onFocusChange) this.onFocusChange(this.focus);
  }

  focusPlanet(systemId, planetId, immediate) {
    const mesh = this.planetMeshes.get(planetId);
    if (!mesh) return;
    this.focus.systemId = systemId;
    this.focus.planetId = planetId;
    const wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
    this.targetGoal.copy(wp);
    this.goal.radius = CAM_PLANET;
    this.goal.phi = 1.16; this.goal.theta = 0.85;
    if (immediate) { this.target.copy(this.targetGoal); this.spherical.radius = this.goal.radius; this.spherical.phi = this.goal.phi; this.spherical.theta = this.goal.theta; }
    if (this.onFocusChange) this.onFocusChange(this.focus);
  }

  overview(immediate) {
    this.focus.systemId = null; this.focus.planetId = null;
    this.targetGoal.set(0, 0, 0);
    this.goal.radius = CAM_OVERVIEW;
    this.goal.phi = 1.05; this.goal.theta = 0.7;
    if (immediate) { this.target.copy(this.targetGoal); this.spherical.radius = this.goal.radius; }
    if (this.onFocusChange) this.onFocusChange(this.focus);
  }

  setSelected(systemId, planetId) {
    if (planetId) this.focusPlanet(systemId, planetId, false);
    else if (systemId) this.focusSystem(systemId, false);
  }

  /** Called every frame so a moving planet stays centred when focused. */
  _trackFocused() {
    if (!this.focus.planetId) return;
    const mesh = this.planetMeshes.get(this.focus.planetId);
    if (!mesh) return;
    const wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
    this.targetGoal.copy(wp);
  }

  /* ---------------------------------------------------------------- input */
  _bindInput() {
    const c = this.canvas;
    let dragging = false, moved = 0, lx = 0, ly = 0;
    let pinchDist = 0;
    const pointers = new Map();

    const onDown = (e) => {
      // Guarded: setPointerCapture throws NotFoundError when the pointer is no
      // longer active (seen on multi-touch and some WebViews); an uncaught
      // throw here would abort the handler before the pointer is tracked,
      // which breaks pinch-zoom on those devices.
      try { if (c.setPointerCapture) c.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; }
      if (pointers.size === 2) { dragging = false; pinchDist = this._pinch(pointers); }
    };
    const onMove = (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const d = this._pinch(pointers);
        if (pinchDist) { this.goal.radius = clamp(this.goal.radius * (pinchDist / d), 3.2, 420); }
        pinchDist = d; return;
      }
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      this.goal.theta -= dx * 0.005;
      this.goal.phi = clamp(this.goal.phi - dy * 0.005, 0.18, Math.PI - 0.18);
    };
    const onUp = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (dragging && moved < 6) this._pick(e.clientX, e.clientY);
      dragging = false;
    };
    const onWheel = (e) => {
      e.preventDefault();
      this.goal.radius = clamp(this.goal.radius * (1 + Math.sign(e.deltaY) * 0.09), 3.2, 420);
    };

    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('wheel', onWheel, { passive: false });
    // double-tap / double-click to zoom out to overview
    const onDbl = () => this.overview(false);
    c.addEventListener('dblclick', onDbl);

    this._unbindInput = () => {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointercancel', onUp);
      c.removeEventListener('wheel', onWheel);
      c.removeEventListener('dblclick', onDbl);
    };
  }

  _pinch(pointers) {
    const arr = [...pointers.values()];
    return Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) || 1;
  }

  _pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    if (!this._ray) this._ray = new THREE.Raycaster();
    this._ray.setFromCamera(ndc, this.camera);
    const hits = this._ray.intersectObjects(this.pickables, false);
    if (!hits.length) return;
    const o = hits[0].object.userData;
    if (o.kind === 'planet') { if (this.onSelectPlanet) this.onSelectPlanet(o.systemId, o.planetId); }
    else if (o.kind === 'star') { if (this.onSelectSystem) this.onSelectSystem(o.systemId); }
  }

  /* ----------------------------------------------------------------- loop */
  _loop() {
    if (this._disposed || this.contextLost) return;
    this._raf = requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const t = this._clock.elapsedTime;

    // orbital + spin animation
    for (const mesh of this.planetMeshes.values()) {
      const u = mesh.userData;
      u.angle += (0.12 / Math.sqrt(u.orbitR)) * dt;
      mesh.position.set(Math.cos(u.angle) * u.orbitR, 0, Math.sin(u.angle) * u.orbitR);
      mesh.rotation.y += u.spin * dt;
    }
    if (this.starfield) this.starfield.rotation.y += dt * 0.004;

    // smooth camera
    this._trackFocused();
    this.target.lerp(this.targetGoal, 1 - Math.pow(0.0016, dt));
    this.spherical.radius += (this.goal.radius - this.spherical.radius) * (1 - Math.pow(0.002, dt));
    this.spherical.theta += (this.goal.theta - this.spherical.theta) * (1 - Math.pow(0.002, dt));
    this.spherical.phi += (this.goal.phi - this.spherical.phi) * (1 - Math.pow(0.002, dt));

    const r = this.spherical.radius, phi = this.spherical.phi, theta = this.spherical.theta;
    this.camera.position.set(
      this.target.x + r * Math.sin(phi) * Math.sin(theta),
      this.target.y + r * Math.cos(phi),
      this.target.z + r * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.lookAt(this.target);

    this.renderer.render(this.scene, this.camera);
    this._labelTick = (this._labelTick || 0) + 1;
    if (this._labelTick % 2 === 0) this._updateLabels();
  }

  /* --------------------------------------------------------------- resize */
  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, rect.height || this.canvas.clientHeight || window.innerHeight);
    this._w = w; this._h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  resize() { this._resize(); }

  /* ----------------------------------------------- WebGL context recovery */
  _bindContextEventsOnce() {
    if (this._ctxBound || !this.canvas) return;
    this._ctxBound = true;
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this._onContextLost();
    }, false);
    this.canvas.addEventListener('webglcontextrestored', () => this._onContextRestored(), false);
  }

  _pauseLoop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  _onContextLost() {
    if (this.contextLost) return;
    this.contextLost = true;
    this._pauseLoop();
    this._setNotice('restoring', 'Restoring graphics\u2026');
    clearTimeout(this._contextTimer);
    this._contextTimer = setTimeout(() => {
      if (this.contextLost) {
        this._setNotice('failed', 'Automatic restoration timed out. Your progress is safe \u2014 retry graphics to resume.');
      }
    }, 4000);
    if (this.onContextLost) this.onContextLost();
  }

  _onContextRestored() {
    clearTimeout(this._contextTimer);
    try {
      this._rebuildScene();
      this._hideNotice();
      if (this.onContextRestored) this.onContextRestored();
    } catch (e) {
      console.error('[void-frontier] context restored but rebuild failed', e);
      this._setNotice('failed', 'Graphics restoration failed. Use Retry graphics.');
    }
  }

  /** Manual retry: replace the canvas with a fresh one and rebuild in place. */
  recover() {
    try {
      this._replaceCanvas();
      this._rebuildScene();
      this._hideNotice();
      if (this.onContextRestored) this.onContextRestored();
    } catch (e) {
      console.error('[void-frontier] recover failed', e);
      this._setNotice('failed', 'Graphics could not be restored. Please reload the page.');
    }
  }

  _replaceCanvas() {
    const old = this.canvas;
    const neu = document.createElement('canvas');
    neu.id = old.id || 'gl';
    neu.className = old.className || '';
    neu.style.cssText = old.style.cssText;
    if (old.hasAttribute('aria-hidden')) neu.setAttribute('aria-hidden', old.getAttribute('aria-hidden'));
    if (old.parentNode) old.parentNode.replaceChild(neu, old);
    this.canvas = neu;
    this._ctxBound = false;
    this._bindContextEventsOnce();
  }

  /* Rebuild every WebGL resource invalidated by a context loss. state.js is
     untouched, so resources / research / shipyard / fleet / save data all
     survive the loss-restore cycle with no reset or double count. */
  _rebuildScene() {
    this._disposed = true;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._unbindInput) { this._unbindInput(); this._unbindInput = null; }
    if (this.labelsEl) this.labelsEl.innerHTML = '';

    // Drop the invalidated scene graph (GPU resources are already gone when
    // the context was lost; these references will be garbage-collected).
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.starfield = null;
    this.pickables = [];
    this.planetMeshes = new Map();
    this.systemNodes = new Map();
    this.labelNodes = [];

    this._disposed = false;
    this.contextLost = false;
    this.init();
    this._buildLabels();

    // Snap the camera back to the previously focused world (or overview).
    if (this.focus.planetId) this.focusPlanet(this.focus.systemId, this.focus.planetId, true);
    else if (this.focus.systemId) this.focusSystem(this.focus.systemId, true);
    else this.overview(true);
  }

  _noticeEl() { return document.getElementById('gfx-notice'); }

  _setNotice(mode, sub) {
    const el = this._noticeEl();
    if (!el) return;
    el.hidden = false;
    const title = document.getElementById('gfx-title');
    const subEl = document.getElementById('gfx-sub');
    const retry = document.getElementById('gfx-retry');
    if (title) title.textContent = mode === 'failed' ? 'Graphics could not be restored' : 'Graphics context lost';
    if (subEl) subEl.textContent = sub || 'Restoring\u2026';
    if (retry) retry.hidden = mode !== 'failed';
  }

  _hideNotice() { const el = this._noticeEl(); if (el) el.hidden = true; }

  dispose() {
    this._disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._unbindInput) this._unbindInput();
    if (this.labelsEl) this.labelsEl.innerHTML = '';
    this.scene && this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
  }
}

/* ============================ texture synthesis ============================ */
const _tmpDir = new THREE.Vector3();
const _tmpV = new THREE.Vector3();
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeGlowTexture(hex) {
  const s = 128;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, hexToRgba(hex, 0.95));
  g.addColorStop(0.35, hexToRgba(hex, 0.35));
  g.addColorStop(1, hexToRgba(hex, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Original per-planet surface: seeded value-noise, banding, polar caps. */
function makePlanetTexture(type, seed) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rng = mulberry32(seed * 2654435761 >>> 0);

  // base body colour from the archetype
  const base = new THREE.Color(type.surface);
  const accent = new THREE.Color(type.accent);
  const atmo = new THREE.Color(type.atmosphere);
  ctx.fillStyle = '#' + base.getHexString();
  ctx.fillRect(0, 0, W, H);

  const banded = (type.id === 'gas' || type.id === 'ocean' || type.id === 'verdant');
  const bands = 6 + Math.floor(rng() * 8);

  // value-noise blobs
  const blobs = 90 + Math.floor(rng() * 70);
  for (let i = 0; i < blobs; i++) {
    const x = rng() * W, y = rng() * H;
    const rr = 6 + rng() * (banded ? 46 : 30);
    const mixv = rng();
    const col = base.clone().lerp(accent, 0.25 + mixv * 0.65).offsetHSL((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.12, (rng() - 0.5) * 0.14);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, hexToRgba('#' + col.getHexString(), 0.55));
    g.addColorStop(1, hexToRgba('#' + col.getHexString(), 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }

  // horizontal bands (gas giants / oceans / verdant cloud lanes)
  if (banded) {
    for (let b = 0; b < bands; b++) {
      const y = (b / bands) * H + (rng() - 0.5) * 8;
      const hgt = 6 + rng() * 22;
      const col = base.clone().lerp(accent, 0.2 + rng() * 0.6).offsetHSL(0, 0, (rng() - 0.5) * 0.12);
      ctx.fillStyle = hexToRgba('#' + col.getHexString(), 0.22 + rng() * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + Math.sin((x / W) * Math.PI * 2 * (1 + rng() * 2) + b) * 4);
      for (let x = W; x >= 0; x -= 16) ctx.lineTo(x, y + hgt + Math.cos((x / W) * Math.PI * 2 + b) * 4);
      ctx.closePath(); ctx.fill();
    }
  }

  // polar caps unless volcanic/gas
  if (type.id !== 'volcanic' && type.id !== 'gas') {
    for (const [py, dir] of [[0, 1], [H, -1]]) {
      const capH = 16 + rng() * 26;
      const g = ctx.createLinearGradient(0, py, 0, py + dir * capH);
      g.addColorStop(0, hexToRgba('#' + atmo.getHexString(), 0.85));
      g.addColorStop(1, hexToRgba('#' + atmo.getHexString(), 0));
      ctx.fillStyle = g; ctx.fillRect(0, Math.min(py, py + dir * capH), W, capH);
    }
  }

  // volcanic fissures
  if (type.id === 'volcanic') {
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = hexToRgba('#' + accent.getHexString(), 0.5 + rng() * 0.4);
      ctx.lineWidth = 0.8 + rng() * 2.2;
      ctx.beginPath();
      let x = rng() * W, y = rng() * H;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (rng() - 0.5) * 70; y += (rng() - 0.5) * 50; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

export { PLANET_TYPES, ORBIT_SCALE };
