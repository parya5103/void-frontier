/* ============================================================================
 * VOID FRONTIER — js/data.js
 * Static content: resources, planet archetypes, star systems (all original
 * names), building definitions, research tree, ship classes.
 * Pure data + small pure helpers. No DOM, no Three.js.
 * ==========================================================================*/

export const GAME = {
  id: 'void-frontier',
  title: 'VOID FRONTIER',
  faction: 'HELIOS CONCORD',
  sector: 'SECTOR 07',
  milestone: 'MILESTONE 1 — LOCAL PROTOTYPE',
  version: '1.0.0-m1',
  saveKey: 'void-frontier:save:v1',
  soundKey: 'void-frontier:sound:v1',
  /** Max seconds credited to offline production on a restore (anti-exploit). */
  offlineCapSeconds: 4 * 3600,
  autosaveMs: 20000,
};

/* ------------------------------- RESOURCES -------------------------------- */
/* Order drives HUD order. `icon` keys map to inline SVGs in ui.js.            */
export const RESOURCES = [
  { id: 'metal',   name: 'Metal',   icon: 'metal',   color: '#8fa6c4' },
  { id: 'crystal', name: 'Crystal', icon: 'crystal', color: '#5fd0e6' },
  { id: 'energy',  name: 'Energy',  icon: 'energy',  color: '#ffcf5c' },
];

/* --------------------------- PLANET ARCHETYPES ---------------------------- */
/* Every world is a figment of this project. `yield` = baseline output per     */
/* second at level 0 before building multipliers. `hue` seeds the procedural   */
/* texture generator so a type always looks like itself, but no two worlds are */
/* pixel-identical (a per-planet `seed` perturbs it).                          */
export const PLANET_TYPES = {
  verdant: {
    id: 'verdant', label: 'Verdant World', tag: 'BIO',
    hue: 118, atmosphere: '#7ce0a0', surface: '#2f6b42', accent: '#c9e26b',
    baseColonizable: true,
    yield: { metal: 0.6, crystal: 0.3, energy: 0.4 },
    desc: 'Temperate biosphere. Balanced output; cheap to settle.',
  },
  arid: {
    id: 'arid', label: 'Arid World', tag: 'MIN',
    hue: 26, atmosphere: '#e6a463', surface: '#7a4a24', accent: '#f0d08a',
    baseColonizable: true,
    yield: { metal: 1.1, crystal: 0.5, energy: 0.3 },
    desc: 'Exposed ore shelves. Strong metal extraction.',
  },
  glacial: {
    id: 'glacial', label: 'Glacial World', tag: 'CRY',
    hue: 196, atmosphere: '#bfe9ff', surface: '#3f6f8f', accent: '#eaf7ff',
    baseColonizable: true,
    yield: { metal: 0.5, crystal: 1.2, energy: 0.3 },
    desc: 'Frozen lattice fields. Rich in crystal formations.',
  },
  volcanic: {
    id: 'volcanic', label: 'Volcanic World', tag: 'NRG',
    hue: 8, atmosphere: '#ff7a4d', surface: '#4a1c14', accent: '#ffb066',
    baseColonizable: true,
    yield: { metal: 0.9, crystal: 0.4, energy: 1.3 },
    desc: 'Geothermal fissures. Superb energy yield.',
  },
  ocean: {
    id: 'ocean', label: 'Ocean World', tag: 'HYD',
    hue: 212, atmosphere: '#6fb6ff', surface: '#123a63', accent: '#a8e0ff',
    baseColonizable: true,
    yield: { metal: 0.4, crystal: 0.7, energy: 0.9 },
    desc: 'Deep pressure mining. Efficient energy from currents.',
  },
  gas: {
    id: 'gas', label: 'Gas Giant', tag: 'GAS',
    hue: 42, atmosphere: '#d8b06a', surface: '#6b4a24', accent: '#f3dca0',
    baseColonizable: false,
    yield: { metal: 0.2, crystal: 0.2, energy: 1.6 },
    desc: 'No surface. Orbital power skimming only (needs Colony Tech 1).',
  },
  barren: {
    id: 'barren', label: 'Barren World', tag: 'BAR',
    hue: 220, atmosphere: '#9aa4b4', surface: '#3a4150', accent: '#c9d2e0',
    baseColonizable: true,
    yield: { metal: 0.8, crystal: 0.8, energy: 0.2 },
    desc: 'Dead rock, dense core. Modest but reliable on all counts.',
  },
  crystalline: {
    id: 'crystalline', label: 'Crystalline World', tag: 'PRM',
    hue: 286, atmosphere: '#c7a8ff', surface: '#3b2a5e', accent: '#e6d4ff',
    baseColonizable: false,
    yield: { metal: 0.3, crystal: 2.0, energy: 0.5 },
    desc: 'Pure lattice crust. Exceptional crystal; needs Colony Tech 2.',
  },
};

/* ------------------------------- STAR SYSTEMS ----------------------------- */
/* Original, hand-placed layout. Distances are AU-ish scene units.              */
export const SYSTEMS = [
  {
    id: 'helios', name: 'Helios', primary: '#ffd27a',
    x: 0, y: 0, z: 0,
    desc: 'Home star of the Concord. Your throneworld sits in its habitable ring.',
    planets: [
      { id: 'aurelia', name: 'Aurelia', type: 'verdant', size: 1.15, dist: 6.2, seed: 11,
        home: true, lore: 'The Concord cradle. Cities ring its equator.' },
      { id: 'cinder', name: 'Cinder', type: 'volcanic', size: 0.95, dist: 8.6, seed: 12,
        lore: 'Tidal-scorched inner world, still bleeding heat.' },
      { id: 'nimbus', name: 'Nimbus', type: 'gas', size: 1.7, dist: 12.4, seed: 13,
        lore: 'Banded leviathan; storm cells the size of moons.' },
    ],
  },
  {
    id: 'vesper', name: 'Vesper', primary: '#9fc6ff',
    x: -34, y: 4, z: -16,
    desc: 'A quiet blue-white star with an ice-belt fringe.',
    planets: [
      { id: 'rhyolite', name: 'Rhyolite', type: 'arid', size: 1.0, dist: 5.6, seed: 21,
        lore: 'Wind-carved mesas laced with magnetite seams.' },
      { id: 'frosthold', name: 'Frosthold', type: 'glacial', size: 1.05, dist: 9.4, seed: 22,
        lore: 'A single frozen ocean under twelve kilometres of shell.' },
    ],
  },
  {
    id: 'kaidos', name: 'Kaidos', primary: '#ff9d6b',
    x: 30, y: -6, z: -22,
    desc: 'An angry orange dwarf. Its worlds are young and loud.',
    planets: [
      { id: 'emberfall', name: 'Emberfall', type: 'volcanic', size: 1.25, dist: 5.2, seed: 31,
        lore: 'Lava seas visible from the edge of the system.' },
      { id: 'shard', name: 'Shard', type: 'crystalline', size: 0.9, dist: 8.2, seed: 32,
        lore: 'A shattered geode of a world — no atmosphere, pure lattice.' },
      { id: 'titanus', name: 'Titanus', type: 'gas', size: 1.9, dist: 13.0, seed: 33,
        lore: 'Colossal and slow; skimmable hydrogen for the bold.' },
    ],
  },
  {
    id: 'thalassa', name: 'Thalassa', primary: '#7ce8d8',
    x: -18, y: 7, z: -44,
    desc: 'A sparkling teal star awash in water and crystal.',
    planets: [
      { id: 'pelagos', name: 'Pelagos', type: 'ocean', size: 1.2, dist: 6.0, seed: 41,
        lore: 'Endless ocean; floating arcologies ride the currents.' },
      { id: 'geode', name: 'Geode', type: 'crystalline', size: 0.85, dist: 8.8, seed: 42,
        lore: 'Fracture lines glow faint violet along the terminator.' },
    ],
  },
  {
    id: 'obsidia', name: 'Obsidia', primary: '#b48cff',
    x: 22, y: 9, z: -56,
    desc: 'A dim violet ember on the frontier rim.',
    planets: [
      { id: 'basalt', name: 'Basalt', type: 'barren', size: 0.95, dist: 5.0, seed: 51,
        lore: 'Impact-shattered plains; excellent deep-core access.' },
      { id: 'verdigris', name: 'Verdigris', type: 'verdant', size: 1.1, dist: 8.0, seed: 52,
        lore: 'An improbable green world in a dying system.' },
      { id: 'pallor', name: 'Pallor', type: 'glacial', size: 1.0, dist: 11.2, seed: 53,
        lore: 'Pale, silent, and utterly still.' },
    ],
  },
  {
    id: 'solace', name: 'Solace', primary: '#ffe9a8',
    x: -44, y: -10, z: 18,
    desc: 'A gentle yellow star far from the trade lanes.',
    planets: [
      { id: 'haven', name: 'Haven', type: 'verdant', size: 1.18, dist: 6.4, seed: 61,
        lore: 'Second-best cradle in the sector. The Concord watches it.' },
      { id: 'dust', name: 'Dust', type: 'arid', size: 0.88, dist: 9.0, seed: 62,
        lore: 'Bone-dry dunes over staggering mineral wealth.' },
    ],
  },
];

/* Convenience index: planetId -> {planet, system} */
export const PLANET_INDEX = (() => {
  const idx = {};
  for (const sys of SYSTEMS) {
    for (const p of sys.planets) idx[p.id] = { planet: p, system: sys };
  }
  return idx;
})();

export function getPlanet(id) { return PLANET_INDEX[id] || null; }
export function planetType(planet) { return PLANET_TYPES[planet.type] || PLANET_TYPES.barren; }

/* ------------------------------- BUILDINGS -------------------------------- */
/* Two directly upgradeable structures ship in Milestone 1: MINE and POWER      */
/* PLANT. Cost/throughput scale geometrically so growth is felt but bounded.    */
export const BUILDINGS = {
  mine: {
    id: 'mine', name: 'Mine', icon: 'mine',
    desc: 'Extracts metal and crystal from the crust.',
    maxLevel: 25,
    baseCost: { metal: 60, crystal: 20 },
    costGrowth: 1.55,                 // cost = base * growth^level
    perLevel: { metal: 0.55, crystal: 0.26 }, // additive /s per level (before type yield)
    affects: ['metal', 'crystal'],
    unlocks: 'Higher metal & crystal yield',
  },
  power: {
    id: 'power', name: 'Power Plant', icon: 'power',
    desc: 'Generates energy to feed every other structure.',
    maxLevel: 25,
    baseCost: { metal: 80, crystal: 40 },
    costGrowth: 1.55,
    perLevel: { energy: 0.75 },
    affects: ['energy'],
    unlocks: 'Higher energy output; supports larger colonies',
  },
};

/* ----------------------------- RESEARCH TREE ------------------------------ */
/* `requires` may list multiple prereq ids. `effect` is applied in state.js.    */
export const RESEARCH = [
  {
    id: 'extraction_1', name: 'Deep Extraction I', tier: 1, icon: 'research',
    cost: { crystal: 120, metal: 60 }, time: 0, requires: [],
    desc: 'Refines ore routing.', effect: { yield: { metal: 0.12 } },
  },
  {
    id: 'power_grid_1', name: 'Grid Efficiency I', tier: 1, icon: 'power',
    cost: { crystal: 100, metal: 80 }, time: 0, requires: [],
    desc: 'Cuts transmission losses.', effect: { yield: { energy: 0.12 } },
  },
  {
    id: 'crystal_lattice', name: 'Crystal Lattice', tier: 2, icon: 'research',
    cost: { crystal: 220, metal: 90 }, time: 0, requires: ['extraction_1'],
    desc: 'Grows crystal in patterned matrices.', effect: { yield: { crystal: 0.18 } },
  },
  {
    id: 'colony_1', name: 'Colony Technology I', tier: 2, icon: 'colony',
    cost: { crystal: 260, metal: 180 }, time: 0, requires: [],
    desc: 'Sealed habitats for hostile worlds.', effect: { colony: 1 },
  },
  {
    id: 'colony_2', name: 'Colony Technology II', tier: 3, icon: 'colony',
    cost: { crystal: 520, metal: 320 }, time: 0, requires: ['colony_1'],
    desc: 'Lattice-adaptive habitats.', effect: { colony: 1 },
  },
  {
    id: 'ship_hulls_1', name: 'Reinforced Hulls', tier: 2, icon: 'ship',
    cost: { metal: 240, crystal: 140 }, time: 0, requires: [],
    desc: 'Stronger hull alloys for every hull class.', effect: { hull: 1 },
  },
  {
    id: 'drive_1', name: 'Ion Drive Tuning', tier: 3, icon: 'ship',
    cost: { crystal: 380, metal: 260 }, time: 0, requires: ['ship_hulls_1'],
    desc: 'Faster fleet transit and construction.', effect: { buildSpeed: 0.2, speed: 1 },
  },
];

export const RESEARCH_INDEX = RESEARCH.reduce((m, r) => (m[r.id] = r, m), {});

/* ------------------------------ SHIP CLASSES ------------------------------ */
/* Original silhouettes, drawn as SVG in ui.js from the `svg` key. Tier gates    */
/* unlock via ship_hulls_1 / drive_1.                                           */
export const SHIPS = [
  {
    id: 'vespid', name: 'Vespid Scout', role: 'Scout', svg: 'scout',
    cost: { metal: 120, crystal: 60 }, buildTime: 6, unlock: null,
    stats: { hull: 30, speed: 9, scan: 3 },
    desc: 'Fast, fragile, sees everything. Opens the frontier.',
  },
  {
    id: 'bulwark', name: 'Bulwark Frigate', role: 'Frigate', svg: 'frigate',
    cost: { metal: 260, crystal: 140 }, buildTime: 12, unlock: 'ship_hulls_1',
    stats: { hull: 120, speed: 5, scan: 1 },
    desc: 'Line hull for holding a lane. Cheap to replace, hard to kill.',
  },
  {
    id: 'lancer', name: 'Lancer Cruiser', role: 'Cruiser', svg: 'cruiser',
    cost: { metal: 620, crystal: 380 }, buildTime: 26, unlock: 'drive_1',
    stats: { hull: 260, speed: 6, scan: 2 },
    desc: 'Long-range strike hull. The Concord\'s answer to trouble.',
  },
];
export const SHIP_INDEX = SHIPS.reduce((m, s) => (m[s.id] = s, m), {});

/* ------------------------------ FLEET DESIGN ------------------------------ */
/* A fleet is identified by its flagship. Every hull is original.               */
export const FLEET_DESIGNS = [
  { id: 'fleet_helios', name: '1st Helios Vanguard', flagship: 'Lancer-class', accent: '#ffcf5c',
    motto: 'Hold the lane.' },
  { id: 'fleet_rangers', name: 'Outer Rangers', flagship: 'Vespid-class', accent: '#5fd0e6',
    motto: 'We are already there.' },
];

/* --------------------------------- HELPERS -------------------------------- */
export function formatNum(n) {
  if (n === Infinity) return '\u221e';
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (a >= 100) return Math.round(n).toString();
  return n.toFixed(a < 10 ? 1 : 0);
}

export function formatRate(r) {
  return (r >= 0 ? '+' : '') + formatNum(r) + '/s';
}

/** Geometric build cost for a structure at a given current level. */
export function upgradeCost(buildingId, level) {
  const b = BUILDINGS[buildingId];
  if (!b) return { metal: 0, crystal: 0, energy: 0 };
  const mult = Math.pow(b.costGrowth, level);
  const out = {};
  for (const [k, v] of Object.entries(b.baseCost)) out[k] = Math.round(v * mult);
  return out;
}
