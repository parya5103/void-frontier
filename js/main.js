/* ============================================================================
 * VOID FRONTIER — js/main.js
 * Bootstrap + controller. Staged loading overlay, module wiring, absolute-time
 * simulation loop, autosave, and global error surfacing. This module owns the
 * single local "agent" loop — there are no workers, servers or paid services.
 * ==========================================================================*/

import { GAME, SYSTEMS, getPlanet } from './data.js';
import * as S from './state.js';
import { GalaxyView } from './galaxy.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';

class Controller {
  constructor() {
    this.ui = null;
    this.galaxy = null;
    this.audio = null;
    this.booted = false;
  }

  async boot() {
    const ui = this.ui = new UI(this);
    ui.init();
    const step = (p, m) => ui.setLoading(p, m);

    // Surface any later runtime error without a blank screen.
    window.addEventListener('error', (e) => {
      if (this.booted) ui.toast('Runtime error: ' + (e.message || 'unknown'), 'err');
      else ui.fatal('Startup failed.', e.message || String(e.error || ''));
    });
    window.addEventListener('unhandledrejection', (e) => {
      const msg = e.reason && e.reason.message ? e.reason.message : String(e.reason);
      if (this.booted) ui.toast('Error: ' + msg, 'err');
    });

    try {
      step(12, 'Reading local save\u2026');
      const loaded = S.load();
      if (!loaded.ok && loaded.msg) {
        ui.toast(loaded.msg, 'warn');
      }

      step(38, 'Generating galaxy\u2026');
      const canvas = document.getElementById('gl');
      const labelsEl = document.getElementById('labels');
      this.galaxy = new GalaxyView(canvas, labelsEl);
      if (!this._webglOk()) throw new Error('WebGL is not available in this browser.');
      this.galaxy.init();
      this.galaxy._buildLabels();
      this.galaxy.onSelectPlanet = (sid, pid) => this.selectPlanet(sid, pid);
      this.galaxy.onSelectSystem = (sid) => this.selectSystem(sid);
      // WebGL context-loss recovery: persist save defensively on loss, and
      // surface a confirmation when the 3D scene comes back.
      this.galaxy.onContextLost = () => { try { S.save(true); } catch (e) { /* non-fatal */ } };
      this.galaxy.onContextRestored = () => ui.toast('Graphics restored.', 'ok');

      step(72, 'Linking systems\u2026');
      this.audio = new Audio().init();
      ui.updateSoundButton(false);

      step(90, 'Spinning up simulation\u2026');
      const sel = S.getSelected();
      const sys = SYSTEMS.find(s => s.id === sel.systemId) || SYSTEMS[0];
      const pl = getPlanet(sel.planetId) || { system: sys, planet: sys.planets[0] };
      S.select(sys.id, pl.planet.id);
      this.galaxy.focusPlanet(sys.id, pl.planet.id, false);
      ui.refreshHud();
      ui.refreshCard();
      ui._buildSystems();

      // offline credit notice
      const st = S.getState();
      if (st._offline && st._offline.seconds > 30) {
        const g = st._offline.gained;
        ui.toast('Welcome back \u2014 earned while away: ' + Math.round(g.metal) + ' metal, ' + Math.round(g.crystal) + ' crystal, ' + Math.round(g.energy) + ' energy.', 'ok');
      }

      step(100, 'Ready.');
      setTimeout(() => ui.hideOverlay(), 320);

      this._startLoops();
      this._bindWindow();
      this.booted = true;
      // tell the classic boot watchdog we made it (prevents a false timeout)
      if (typeof window.__VF_BOOT_OK__ === 'function') window.__VF_BOOT_OK__();

      // gesture-gated: if the user had previously enabled sound, re-arm on the
      // first interaction (browsers block audio until a gesture anyway).
      if (this.audio.readPref()) {
        const arm = () => {
          this.audio.setEnabled(true).then((ok) => this.ui.updateSoundButton(ok));
          window.removeEventListener('pointerdown', arm); window.removeEventListener('keydown', arm);
        };
        window.addEventListener('pointerdown', arm, { once: true });
        window.addEventListener('keydown', arm, { once: true });
      }
    } catch (err) {
      console.error('[void-frontier] boot failed', err);
      ui.fatal('VOID FRONTIER could not start.', (err && err.message ? err.message : String(err)));
    }
  }

  _webglOk() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------ loop + io */
  _startLoops() {
    // 4 Hz economy tick — absolute-time based, so throttled tabs stay correct.
    this._tickTimer = setInterval(() => S.tick(Date.now()), 250);
    S.tick(Date.now());
    // autosave
    this._saveTimer = setInterval(() => S.save(true), GAME.autosaveMs);
  }

  _bindWindow() {
    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => this.galaxy && this.galaxy.resize(), 120);
    });
    window.addEventListener('orientationchange', () => setTimeout(() => this.galaxy && this.galaxy.resize(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) S.save(true);
      else S.tick(Date.now());
    });
    window.addEventListener('beforeunload', () => S.save(true));
  }

  /* ---------------------------------------------------- controller actions */
  selectSystem(systemId) {
    const sys = SYSTEMS.find(s => s.id === systemId);
    if (!sys) return;
    const planet = sys.planets[0];
    S.select(sys.id, planet.id);
    this.galaxy.focusSystem(sys.id, false);
    this.ui._buildSystems();
    this.ui.refreshCard();
    this.audio.select();
  }

  selectPlanet(systemId, planetId) {
    const ref = getPlanet(planetId);
    if (!ref) return;
    S.select(ref.system.id, ref.planet.id);
    this.galaxy.focusPlanet(ref.system.id, ref.planet.id, false);
    this.ui._buildSystems();
    this.ui.refreshCard();
    // if a panel is open, keep it in sync with the new world
    if (this.ui.panel === 'planet' || this.ui.panel === 'shipyard') this.ui._refreshOpenPanel();
    this.audio.select();
  }

  overview() {
    this.galaxy.overview(false);
    this.ui._buildSystems();
    this.audio.click();
  }

  async toggleSound() {
    const on = !this.audio.enabled;
    const ok = await this.audio.setEnabled(on);
    this.ui.updateSoundButton(ok);
    this.ui.toast(ok ? 'Sound enabled.' : 'Sound muted.', 'ok');
  }

  saveGame() {
    const r = S.save(false);
    if (r.ok) { this.ui.toast('Progress saved.', 'ok'); this.audio.confirm(); }
    else this.ui.toast(r.msg || 'Save failed.', 'err');
  }

  exportSave() {
    try {
      const blob = new Blob([S.exportSave()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'void-frontier-save.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.ui.toast('Save exported.', 'ok');
    } catch (e) { this.ui.toast('Export failed.', 'err'); }
  }

  importSave() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const r = S.applyRaw(String(rd.result));
        if (!r.ok) { this.ui.toast('Import failed: ' + r.msg, 'err'); return; }
        this.ui.toast('Save imported.', 'ok');
        const sel = S.getSelected();
        this.galaxy.focusPlanet(sel.systemId, sel.planetId, false);
        this.ui._buildSystems(); this.ui.refreshHud(); this.ui.refreshCard(); this.ui._refreshOpenPanel();
      };
      rd.onerror = () => this.ui.toast('Could not read that file.', 'err');
      rd.readAsText(f);
    });
    inp.click();
  }

  resetGame() {
    if (!window.confirm('Start a new game? This erases your current progress.')) return;
    S.reset();
    const sel = S.getSelected();
    this.galaxy.focusPlanet(sel.systemId, sel.planetId, false);
    this.ui._buildSystems(); this.ui.refreshHud(); this.ui.refreshCard(); this.ui.openPanel('planet');
    this.ui.toast('New game started.', 'ok');
  }
}

/* audio hooks: react to simulation events when sound is on */
function wireAudio(controller) {
  const a = controller.audio;
  if (!a) return;
  S.on('research:done', () => a.complete());
  S.on('ship:done', () => a.complete());
  S.on('research:start', () => a.upgrade());
  S.on('ship:start', () => a.upgrade());
}

/* ------------------------------------------------------------------ start */
const app = new Controller();
window.__VOID_FRONTIER__ = app; // handy for debugging / QA
wireAudioEarly(app);
app.boot();

function wireAudioEarly(c) {
  // The Audio instance is created during boot, so defer the hookup via a
  // short poll rather than assuming it already exists.
  const hook = setInterval(() => {
    if (c.audio) { clearInterval(hook); wireAudio(c); }
  }, 60);
  setTimeout(() => clearInterval(hook), 8000);
}
