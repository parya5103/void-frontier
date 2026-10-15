/* ============================================================================
 * VOID FRONTIER — js/audio.js
 * All sound is synthesised in-browser with the Web Audio API — no audio files.
 * Strictly OFF until the user enables it (never starts from page load).
 * The choice is persisted under GAME.soundKey and honoured on the next visit.
 * ==========================================================================*/

import { GAME } from './data.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.ambientNodes = null;
    this._pref = false;
  }

  /** Read the stored preference (absent => muted/off). */
  readPref() {
    try { this._pref = localStorage.getItem(GAME.soundKey) === 'true'; }
    catch (e) { this._pref = false; }
    return this._pref;
  }

  _persist(on) {
    try { localStorage.setItem(GAME.soundKey, String(!!on)); } catch (e) { /* ignore */ }
  }

  _ensureCtx() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Must be called from a real user gesture. Returns the resulting state. */
  async setEnabled(on) {
    this.enabled = !!on;
    this._persist(on);
    if (!on) { this._stopAmbient(); this._fadeMaster(0.0001); return false; }
    const ctx = this._ensureCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignore */ } }
    this._fadeMaster(0.5);
    this._startAmbient();
    return true;
  }

  toggle() { return this.setEnabled(!this.enabled); }

  init() {
    this.readPref();
    this.enabled = false; // never auto-start; first enable happens on a click
    return this;
  }

  _fadeMaster(to, secs) {
    if (!this.master || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.linearRampToValueAtTime(to, t + (secs || 0.4));
  }

  /* ------------------------------------------------------------- one-shots */
  _beep(freq, dur, type, gain, slideTo) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.14, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  click() { this._beep(520, 0.06, 'triangle', 0.07, 640); }
  select() { this._beep(340, 0.14, 'sine', 0.09, 520); }
  upgrade() { this._beep(420, 0.12, 'triangle', 0.12, 680); setTimeout(() => this._beep(680, 0.16, 'sine', 0.1, 900), 90); }
  confirm() { this._beep(560, 0.1, 'sine', 0.1, 760); setTimeout(() => this._beep(820, 0.18, 'sine', 0.08, 1040), 100); }
  error() { this._beep(180, 0.22, 'sawtooth', 0.09, 110); }
  complete() { [660, 880, 1170].forEach((f, i) => setTimeout(() => this._beep(f, 0.22, 'sine', 0.09), i * 110)); }

  /* -------------------------------------------------------------- ambient */
  _startAmbient() {
    if (!this.enabled || !this.ctx || this.ambientNodes) return;
    const ctx = this.ctx;
    // two detuned low drones + slow filtered noise -> a calm space bed
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(this.master);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5; o2.detune.value = 6;
    const og = ctx.createGain(); og.gain.value = 0.5;
    o1.connect(og); o2.connect(og); og.connect(g);

    // filtered noise layer
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.25;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.06;
    noise.connect(lp); lp.connect(ng); ng.connect(g);

    // slow LFO on the filter for movement
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = 120;
    lfo.connect(lfoG); lfoG.connect(lp.frequency);

    o1.start(); o2.start(); noise.start(); lfo.start();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 1.6);
    this.ambientNodes = { g, o1, o2, noise, lfo };
  }

  _stopAmbient() {
    const n = this.ambientNodes;
    if (!n || !this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      n.g.gain.cancelScheduledValues(t);
      n.g.gain.setValueAtTime(n.g.gain.value, t);
      n.g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      setTimeout(() => {
        try { n.o1.stop(); n.o2.stop(); n.noise.stop(); n.lfo.stop(); } catch (e) { /* already stopped */ }
      }, 600);
    } catch (e) { /* ignore */ }
    this.ambientNodes = null;
  }
}
