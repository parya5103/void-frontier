/* ============================================================================
 * VOID FRONTIER — js/state.js
 * The simulation core: resource economy, upgrade / research / shipyard /
 * colonization rules, deterministic tick, save + restore.
 * Pure logic — no DOM, no Three.js. Emits events so UI and audio can react.
 * ==========================================================================*/

import {
  GAME, RESOURCES, BUILDINGS, RESEARCH, RESEARCH_INDEX,
  SHIPS, SHIP_INDEX, getPlanet, planetType, upgradeCost,
} from './data.js';

/* ---------------------------- tiny event bus ------------------------------ */
const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
function emit(evt, payload) {
  const set = listeners.get(evt);
  if (set) for (const fn of set) { try { fn(payload); } catch (e) { console.warn('[vf] listener', evt, e); } }
}

/* --------------------------- colony tech gating --------------------------- */
/* Minimum Colony Technology tier required, per planet archetype.              */
const MIN_COLONY_TIER = { verdant: 0, arid: 0, glacial: 0, volcanic: 0, ocean: 0, barren: 0, gas: 1, crystalline: 2 };

/* ------------------------------ default state ----------------------------- */
function newGame() {
  const now = Date.now();
  return {
    version: GAME.version,
    createdAt: now,
    updatedAt: now,
    lastSeen: now,
    res: { metal: 520, crystal: 260, energy: 180 },
    selectedSystem: 'helios',
    selectedPlanet: 'aurelia',
    colonies: {
      // home world starts lightly developed so the first click already earns
      aurelia: { mine: 1, power: 1, since: now },
    },
    research: { unlocked: {}, active: null }, // active = { id, endsAt }
    fleet: {
      fleet_helios: { ships: { vespid: 2 }, home: 'aurelia' },
    },
    queues: {},            // planetId -> { shipId, endsAt, costPaid }
    stats: { oreMined: 0, colonies: 1, shipsBuilt: 2, researchDone: 0, upgrades: 0 },
    settings: { sound: false },
    startedAt: now,
  };
}

let state = newGame();

/* ------------------------------ derived bonuses --------------------------- */
function researchYieldBonus() {
  const b = { metal: 0, crystal: 0, energy: 0 };
  for (const id of Object.keys(state.research.unlocked)) {
    const r = RESEARCH_INDEX[id];
    if (r && r.effect && r.effect.yield) {
      for (const k of Object.keys(r.effect.yield)) b[k] = (b[k] || 0) + r.effect.yield[k];
    }
  }
  return b;
}
function colonyTier() {
  let t = 0;
  for (const id of Object.keys(state.research.unlocked)) {
    const r = RESEARCH_INDEX[id];
    if (r && r.effect && r.effect.colony) t += r.effect.colony;
  }
  return t;
}
function buildSpeedBonus() {
  let s = 0;
  for (const id of Object.keys(state.research.unlocked)) {
    const r = RESEARCH_INDEX[id];
    if (r && r.effect && r.effect.buildSpeed) s += r.effect.buildSpeed;
  }
  return s;
}

export function getBonuses() {
  return {
    yield: researchYieldBonus(),
    colonyTier: colonyTier(),
    buildSpeed: buildSpeedBonus(),
  };
}

/* -------------------------------- production ------------------------------ */
/** Output per second for one colonized planet, before global research bonus. */
export function planetRate(planetId) {
  const col = state.colonies[planetId];
  if (!col) return { metal: 0, crystal: 0, energy: 0 };
  const ref = getPlanet(planetId);
  if (!ref) return { metal: 0, crystal: 0, energy: 0 };
  const t = planetType(ref.planet);
  const out = { metal: 0, crystal: 0, energy: 0 };
  for (const res of RESOURCES) {
    let v = t.yield[res.id] || 0;
    const mPer = BUILDINGS.mine.perLevel[res.id] || 0;
    const pPer = BUILDINGS.power.perLevel[res.id] || 0;
    v += mPer * (col.mine || 0);
    v += pPer * (col.power || 0);
    out[res.id] = v;
  }
  return out;
}

/** Sector-wide total rate including research bonus. */
export function sectorRate() {
  const bonus = researchYieldBonus();
  const total = { metal: 0, crystal: 0, energy: 0 };
  for (const pid of Object.keys(state.colonies)) {
    const r = planetRate(pid);
    total.metal += r.metal; total.crystal += r.crystal; total.energy += r.energy;
  }
  for (const k of Object.keys(total)) total[k] += bonus[k] || 0;
  return total;
}

/* --------------------------------- ticking -------------------------------- */
/* Absolute-time completions + resource accrual. Call with wall-clock delta.  */
export function tick(nowMs) {
  const now = nowMs || Date.now();
  const last = state.lastSeen || now;
  let dt = (now - last) / 1000;
  if (dt < 0) dt = 0;
  if (dt > 0) {
    const rate = sectorRate();
    for (const res of RESOURCES) {
      state.res[res.id] = Math.max(0, state.res[res.id] + rate[res.id] * dt);
    }
    state.stats.oreMined += (rate.metal + rate.crystal) * dt;
  }
  state.lastSeen = now;

  // research completion
  if (state.research.active && state.research.active.endsAt <= now) {
    const done = state.research.active.id;
    state.research.unlocked[done] = true;
    state.research.active = null;
    state.stats.researchDone++;
    emit('research:done', done);
  }
  // shipyard queues
  for (const pid of Object.keys(state.queues)) {
    const q = state.queues[pid];
    if (q && q.endsAt <= now) {
      const fid = q.fleetId || 'fleet_helios';
      if (!state.fleet[fid]) state.fleet[fid] = { ships: {}, home: pid };
      if (!state.fleet[fid].ships) state.fleet[fid].ships = {};
      state.fleet[fid].ships[q.shipId] = (state.fleet[fid].ships[q.shipId] || 0) + 1;
      state.stats.shipsBuilt++;
      delete state.queues[pid];
      emit('ship:done', { planetId: pid, shipId: q.shipId });
    }
  }
  state.updatedAt = now;
  emit('tick', { res: state.res, rate: sectorRate() });
}

/* ------------------------------ affordability ----------------------------- */
function canAfford(cost) {
  for (const [k, v] of Object.entries(cost)) if ((state.res[k] || 0) < v) return false;
  return true;
}
function pay(cost) {
  for (const [k, v] of Object.entries(cost)) state.res[k] = (state.res[k] || 0) - v;
}

/* --------------------------------- upgrades ------------------------------- */
export function buildingLevel(planetId, buildingId) {
  const col = state.colonies[planetId];
  return col ? (col[buildingId] || 0) : 0;
}
export function buildingCost(planetId, buildingId) {
  const lvl = buildingLevel(planetId, buildingId);
  const b = BUILDINGS[buildingId];
  if (lvl >= b.maxLevel) return null;
  return upgradeCost(buildingId, lvl);
}
export function upgrade(planetId, buildingId) {
  const col = state.colonies[planetId];
  if (!col) return { ok: false, msg: 'Planet is not colonized.' };
  const b = BUILDINGS[buildingId];
  if (!b) return { ok: false, msg: 'Unknown structure.' };
  const lvl = buildingLevel(planetId, buildingId);
  if (lvl >= b.maxLevel) return { ok: false, msg: b.name + ' is at maximum level.' };
  const cost = upgradeCost(buildingId, lvl);
  if (!canAfford(cost)) return { ok: false, msg: 'Insufficient resources for ' + b.name + ' L' + (lvl + 1) + '.' };
  pay(cost);
  col[buildingId] = lvl + 1;
  state.stats.upgrades++;
  state.updatedAt = Date.now();
  emit('res:changed', state.res);
  emit('colony:changed', planetId);
  return { ok: true, msg: b.name + ' upgraded to L' + (lvl + 1) + '.', cost };
}

/* --------------------------------- research ------------------------------- */
export function researchState(id) {
  if (state.research.unlocked[id]) return 'done';
  if (state.research.active && state.research.active.id === id) return 'active';
  const r = RESEARCH_INDEX[id];
  if (!r) return 'locked';
  for (const pre of r.requires) if (!state.research.unlocked[pre]) return 'locked';
  return 'available';
}
export function researchTime(id) {
  const r = RESEARCH_INDEX[id];
  if (!r) return 0;
  return Math.max(6, (r.tier || 1) * 12); // seconds
}
export function startResearch(id) {
  const r = RESEARCH_INDEX[id];
  if (!r) return { ok: false, msg: 'Unknown research.' };
  if (state.research.active) return { ok: false, msg: 'A research project is already running.' };
  const st = researchState(id);
  if (st === 'done') return { ok: false, msg: r.name + ' is already complete.' };
  if (st === 'locked') return { ok: false, msg: 'Prerequisites not met for ' + r.name + '.' };
  if (!canAfford(r.cost)) return { ok: false, msg: 'Insufficient resources for ' + r.name + '.' };
  pay(r.cost);
  const secs = researchTime(id);
  state.research.active = { id, endsAt: Date.now() + secs * 1000 };
  state.updatedAt = Date.now();
  emit('res:changed', state.res);
  emit('research:start', { id, seconds: secs });
  return { ok: true, msg: 'Research started: ' + r.name + ' (~' + secs + 's).', seconds: secs };
}

/* --------------------------------- shipyard ------------------------------- */
export function shipUnlocked(shipId) {
  const s = SHIP_INDEX[shipId];
  if (!s) return false;
  if (!s.unlock) return true;
  return !!state.research.unlocked[s.unlock];
}
export function shipCost(shipId) {
  const s = SHIP_INDEX[shipId];
  return s ? { ...s.cost } : {};
}
export function shipBuildTime(shipId) {
  const s = SHIP_INDEX[shipId];
  if (!s) return 0;
  return s.buildTime / (1 + buildSpeedBonus());
}
export function queueFor(planetId) { return state.queues[planetId] || null; }
export function buildShip(planetId, shipId, fleetId) {
  const s = SHIP_INDEX[shipId];
  if (!s) return { ok: false, msg: 'Unknown hull.' };
  if (!state.colonies[planetId]) return { ok: false, msg: 'Build a colony here first.' };
  if (!shipUnlocked(shipId)) return { ok: false, msg: s.name + ' requires prior research.' };
  if (state.queues[planetId]) return { ok: false, msg: 'This shipyard is already building a hull.' };
  const cost = shipCost(shipId);
  if (!canAfford(cost)) return { ok: false, msg: 'Insufficient resources for ' + s.name + '.' };
  pay(cost);
  const secs = shipBuildTime(shipId);
  state.queues[planetId] = { shipId, fleetId: fleetId || 'fleet_helios', endsAt: Date.now() + secs * 1000 };
  state.updatedAt = Date.now();
  emit('res:changed', state.res);
  emit('ship:start', { planetId, shipId, seconds: secs });
  return { ok: true, msg: s.name + ' laid down (~' + Math.round(secs) + 's).', seconds: secs };
}

/* ------------------------------- colonization ----------------------------- */
export function colonizeCheck(planetId) {
  const ref = getPlanet(planetId);
  if (!ref) return { ok: false, reason: 'Unknown world.' };
  if (state.colonies[planetId]) return { ok: false, reason: 'Already colonized.' };
  const t = planetType(ref.planet);
  const need = MIN_COLONY_TIER[t.id] || 0;
  const tier = colonyTier();
  if (need > tier) {
    return { ok: false, reason: 'Requires Colony Technology ' + need + ' (you have ' + tier + ').' };
  }
  const cost = colonizeCost(ref.planet);
  if (!canAfford(cost)) return { ok: false, reason: 'Insufficient resources to settle.' };
  return { ok: true, cost };
}
export function colonizeCost(planet) {
  const sz = planet.size || 1;
  return { metal: Math.round(180 * sz), crystal: Math.round(160 * sz), energy: 0 };
}
export function colonize(planetId) {
  const chk = colonizeCheck(planetId);
  if (!chk.ok) return { ok: false, msg: chk.reason };
  pay(chk.cost);
  state.colonies[planetId] = { mine: 0, power: 0, since: Date.now() };
  state.stats.colonies++;
  state.updatedAt = Date.now();
  emit('res:changed', state.res);
  emit('colony:founded', planetId);
  return { ok: true, msg: 'Colony established.', cost: chk.cost };
}

/* ----------------------------------- fleet -------------------------------- */
export function fleetShips(fleetId) {
  const f = state.fleet[fleetId];
  if (!f || !f.ships) return [];
  return Object.entries(f.ships)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ ship: SHIP_INDEX[id], count: n }))
    .filter(x => x.ship);
}
export function fleetStrength(fleetId) {
  let hull = 0, ships = 0;
  for (const { ship, count } of fleetShips(fleetId)) {
    hull += ship.stats.hull * count; ships += count;
  }
  // apply hull research flat bonus
  let hullBonus = 0;
  for (const id of Object.keys(state.research.unlocked)) {
    const r = RESEARCH_INDEX[id];
    if (r && r.effect && r.effect.hull) hullBonus += r.effect.hull;
  }
  return { hull: Math.round(hull * (1 + 0.15 * hullBonus)), ships };
}
export function totalShips() {
  let n = 0;
  for (const fid of Object.keys(state.fleet)) n += fleetStrength(fid).ships;
  return n;
}

/* ---------------------------------- access -------------------------------- */
export function getState() { return state; }
export function getRes() { return state.res; }
export function getSelected() { return { systemId: state.selectedSystem, planetId: state.selectedPlanet }; }
export function select(systemId, planetId) {
  state.selectedSystem = systemId || state.selectedSystem;
  state.selectedPlanet = planetId || state.selectedPlanet;
}
export function setSound(on) { state.settings.sound = !!on; }

/* ------------------------------- save / load ------------------------------ */
export function serialize() { state.updatedAt = state.lastSeen = Date.now(); return JSON.stringify(state); }

export function save(quiet) {
  try {
    localStorage.setItem(GAME.saveKey, serialize());
    if (!quiet) emit('save:ok', { at: state.updatedAt });
    return { ok: true };
  } catch (e) {
    emit('save:err', e);
    return { ok: false, msg: 'Could not write save: ' + e.message };
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(GAME.saveKey);
    if (!raw) return { ok: true, fresh: true };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.res) {
      return { ok: false, msg: 'Save file was malformed; starting a new game.' };
    }
    state = migrate(parsed);
    creditOffline();
    emit('load:ok', { offline: state._offline || null });
    return { ok: true, fresh: false };
  } catch (e) {
    return { ok: false, msg: 'Save could not be read: ' + e.message };
  }
}

function migrate(s) {
  const base = newGame();
  const merged = Object.assign(base, s);
  merged.res = Object.assign({ metal: 0, crystal: 0, energy: 0 }, s.res || {});
  merged.research = Object.assign({ unlocked: {}, active: null }, s.research || {});
  merged.colonies = s.colonies && typeof s.colonies === 'object' ? s.colonies : base.colonies;
  merged.fleet = s.fleet && typeof s.fleet === 'object' ? s.fleet : base.fleet;
  merged.queues = s.queues && typeof s.queues === 'object' ? s.queues : {};
  merged.stats = Object.assign(base.stats, s.stats || {});
  merged.settings = Object.assign({ sound: false }, s.settings || {});
  if (typeof merged.lastSeen !== 'number' || !isFinite(merged.lastSeen)) merged.lastSeen = Date.now();
  return merged;
}

/* Credit production earned while away (capped, anti-exploit). */
function creditOffline() {
  const now = Date.now();
  const away = Math.max(0, (now - (state.lastSeen || now)) / 1000);
  const credited = Math.min(away, GAME.offlineCapSeconds);
  if (credited < 1) return;
  const rate = sectorRate();
  const gained = { metal: 0, crystal: 0, energy: 0 };
  for (const res of RESOURCES) {
    gained[res.id] = rate[res.id] * credited;
    state.res[res.id] += gained[res.id];
  }
  state.lastSeen = now;
  state._offline = { seconds: Math.round(credited), gained };
}

export function reset() {
  try { localStorage.removeItem(GAME.saveKey); } catch (e) { /* ignore */ }
  state = newGame();
  state.lastSeen = Date.now();
  emit('reset', {});
}

export function exportSave() { return serialize(); }

/** Validate a raw JSON save string without applying it. */
export function validateSave(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return { ok: false, msg: 'Not a save object.' };
    if (!p.res || typeof p.res !== 'object') return { ok: false, msg: 'Missing resource block.' };
    if (!p.colonies || typeof p.colonies !== 'object') return { ok: false, msg: 'Missing colonies block.' };
    return { ok: true };
  } catch (e) { return { ok: false, msg: 'Invalid JSON: ' + e.message }; }
}

export function applyRaw(raw) {
  const v = validateSave(raw);
  if (!v.ok) return v;
  state = migrate(JSON.parse(raw));
  emit('load:ok', {});
  return { ok: true };
}

/* -------------------------------- new game -------------------------------- */
export { newGame };
export function stats() { return state.stats; }
