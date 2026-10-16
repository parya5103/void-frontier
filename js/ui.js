/* ============================================================================
 * VOID FRONTIER — js/ui.js
 * All DOM/UX: HUD resource counters, system chips, planet card, command
 * panels (world / research / shipyard / fleet / help), original SVG ship
 * designs, toasts. Renders from state; owns no simulation logic.
 * ==========================================================================*/

import {
  GAME, RESOURCES, SYSTEMS, PLANET_TYPES, planetType, getPlanet,
  BUILDINGS, RESEARCH, RESEARCH_INDEX, SHIPS, SHIP_INDEX, FLEET_DESIGNS,
  formatNum, formatRate, upgradeCost,
} from './data.js';
import * as S from './state.js';

/* --------------------------- original SVG icon set ------------------------ */
const ICONS = {
  metal: '<svg viewBox="0 0 16 16"><path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 5 11 8 8 11 5 8Z" fill="currentColor"/></svg>',
  crystal: '<svg viewBox="0 0 16 16"><path d="M8 1.2 12.4 6 8 14.8 3.6 6Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.2V14.8M3.6 6h8.8" stroke="currentColor" stroke-width=".9" opacity=".8"/></svg>',
  energy: '<svg viewBox="0 0 16 16"><path d="M9.4 1 3.6 9h3.1L6 15l5.9-8.3H8.7Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  world: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.2 8.6c4 1.4 9.6 1.2 13.4-1M4 13c3.4-1.6 8.6-1.5 12 .6M10 3v14" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
  research: '<svg viewBox="0 0 20 20"><path d="M8 3h4M9 3v5L5 15.2A1.6 1.6 0 0 0 6.4 18h7.2A1.6 1.6 0 0 0 15 15.2L11 8V3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="10" cy="14" r="1.1" fill="currentColor"/></svg>',
  shipyard: '<svg viewBox="0 0 20 20"><path d="M10 2.5 15 9v7.5H5V9Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 16.5v-4h4v4M6.5 9h7" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>',
  fleet: '<svg viewBox="0 0 20 20"><path d="M10 2 12.4 8.6 19 10l-6.6 1.4L10 18l-2.4-6.6L1 10l6.6-1.4Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/></svg>',
  map: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="10" r="2" fill="currentColor"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3" stroke="currentColor" stroke-width="1.1"/></svg>',
  mine: '<svg viewBox="0 0 20 20"><path d="M3 16 9 4l6 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 12h7" stroke="currentColor" stroke-width="1.2"/><path d="M4 16h13" stroke="currentColor" stroke-width="1.2"/></svg>',
  power: '<svg viewBox="0 0 20 20"><path d="M11.6 2 5 11h4l-1.2 7L15 9h-4Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  colony: '<svg viewBox="0 0 20 20"><path d="M4 17V8l6-4 6 4v9Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.4 17v-4.4h3.2V17" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>',
  research2: '<svg viewBox="0 0 20 20"><path d="M8 3h4M9 3v5L5 15.2A1.6 1.6 0 0 0 6.4 18h7.2A1.6 1.6 0 0 0 15 15.2L11 8V3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
};

/* -------------------- ORIGINAL SHIP SILHOUETTES (SVG) --------------------- */
/* Each hull class is a hand-authored original design, drawn top-down.        */
const SHIP_SVG = {
  scout: `<svg viewBox="0 0 120 120" class="ship-svg">
      <defs><linearGradient id="g-scout" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9fe6ff"/><stop offset="1" stop-color="#2b6d8f"/></linearGradient></defs>
      <path d="M60 12 74 58 60 70 46 58Z" fill="url(#g-scout)" stroke="#bfefff" stroke-width="2" stroke-linejoin="round"/>
      <path d="M60 70 72 104 60 92 48 104Z" fill="#1c4a63" stroke="#5fc9e8" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M46 58 30 76 44 66M74 58 90 76 76 66" fill="none" stroke="#6fd6f2" stroke-width="2" stroke-linecap="round"/>
      <circle cx="60" cy="48" r="4.4" fill="#e9fbff"/>
    </svg>`,
  frigate: `<svg viewBox="0 0 120 120" class="ship-svg">
      <defs><linearGradient id="g-frig" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d8e6f5"/><stop offset="1" stop-color="#4a6180"/></linearGradient></defs>
      <path d="M60 14 84 44 78 84 60 96 42 84 36 44Z" fill="url(#g-frig)" stroke="#eaf2ff" stroke-width="2" stroke-linejoin="round"/>
      <rect x="48" y="46" width="24" height="22" rx="3" fill="#22303f" stroke="#9fb6d2" stroke-width="1.4"/>
      <path d="M36 44H22v10l14 4M84 44h14v10l-14 4" fill="#31445c" stroke="#c2d4ea" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="60" cy="57" r="3.4" fill="#ffcf5c"/>
      <path d="M50 96h20" stroke="#9fb6d2" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  cruiser: `<svg viewBox="0 0 120 120" class="ship-svg">
      <defs><linearGradient id="g-cru" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe7a8"/><stop offset="1" stop-color="#8a6a2a"/></linearGradient></defs>
      <path d="M60 8 82 40 76 92 60 104 44 92 38 40Z" fill="url(#g-cru)" stroke="#fff3cd" stroke-width="2" stroke-linejoin="round"/>
      <path d="M38 40 22 56l6 16 12-10M82 40l16 16-6 16-12-10" fill="#5c4720" stroke="#ffe7a8" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M50 42h20l-4 40h-12Z" fill="#2a2210" stroke="#ffd873" stroke-width="1.4"/>
      <circle cx="60" cy="58" r="5" fill="#fff6d8"/>
      <path d="M54 100h12M57 104h6" stroke="#ffd873" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
};

/* =============================== UI class ================================= */
export class UI {
  constructor(controller) {
    this.c = controller;      // main.js controller: select*, overview, panel, sound, save, reset
    this.el = {};
    this.panel = null;
    this._toastSeq = 0;
  }

  init() {
    const q = (id) => document.getElementById(id);
    this.el = {
      systems: q('systems'),
      card: q('planet-card'),
      pcType: q('pc-type'), pcName: q('pc-name'), pcSys: q('pc-sys'),
      pcStatus: q('pc-status'), pcStats: q('pc-stats'), pcBody: q('pc-body'), pcActions: q('pc-actions'),
      sheet: q('sheet'), sheetTitle: q('sheet-title'),
      panels: {
        planet: q('panel-planet'), research: q('panel-research'),
        shipyard: q('panel-shipyard'), fleet: q('panel-fleet'), help: q('panel-help'),
      },
      toasts: q('toasts'),
      soundBtn: q('btn-sound'),
      dock: q('dock'),
    };

    this._injectDockIcons();
    this._buildSystems();
    this._wireGlobalActions();

    // subscribe to state so UI never polls
    S.on('tick', () => { this.refreshHud(); this._refreshOpenPanel(); this.refreshCardStatus(); });
    S.on('res:changed', () => this.refreshHud());
    S.on('colony:changed', () => { this.refreshHud(); this._refreshOpenPanel(); this.refreshCard(); this._buildSystems(); });
    S.on('colony:founded', (pid) => { this.refreshHud(); this._buildSystems(); this.refreshCard(); this._refreshOpenPanel(); });
    S.on('research:start', () => { this._refreshOpenPanel(); });
    S.on('research:done', () => { this._buildSystems(); this._refreshOpenPanel(); this.refreshCard(); this.toast('Research complete.', 'ok'); });
    S.on('ship:start', () => this._refreshOpenPanel());
    S.on('ship:done', () => { this._refreshOpenPanel(); });
    S.on('save:err', (e) => this.toast('Save failed: ' + (e && e.message ? e.message : 'unknown'), 'err'));
  }

  /* --------------------------------------------------------------- icons */
  _injectDockIcons() {
    const order = [
      ['planet', 'world'], ['research', 'research'], ['shipyard', 'shipyard'],
      ['fleet', 'fleet'], ['map', 'map'],
    ];
    const btns = this.el.dock ? [...this.el.dock.querySelectorAll('.dock-btn')] : [];
    btns.forEach((b, i) => {
      const key = order[i] ? order[i][1] : 'world';
      const holder = b.querySelector('i');
      if (holder) holder.innerHTML = ICONS[key] || ICONS.world;
    });
  }

  _buildSystems() {
    if (!this.el.systems) return;
    const sel = S.getSelected();
    this.el.systems.innerHTML = SYSTEMS.map((sys) => {
      const owned = sys.planets.some(p => S.getState().colonies[p.id]);
      return `<button class="chip${sel.systemId === sys.id ? ' is-sel' : ''}${owned ? ' is-owned' : ''}"
        data-chip-system="${sys.id}" role="tab" aria-selected="${sel.systemId === sys.id}">
        <span class="dot" style="background:${sys.primary}"></span>${sys.name}
        <em>${sys.planets.length}</em></button>`;
    }).join('');
  }

  /* -------------------------------------------------------------- HUD */
  refreshHud() {
    const res = S.getRes();
    const rate = S.sectorRate();
    for (const r of RESOURCES) {
      const v = document.getElementById('val-' + r.id);
      const rt = document.getElementById('rate-' + r.id);
      if (v) v.textContent = formatNum(res[r.id]);
      if (rt) rt.textContent = formatRate(rate[r.id]);
    }
    const colEl = document.getElementById('val-colonies');
    if (colEl) colEl.textContent = String(Object.keys(S.getState().colonies).length);
  }

  /* ---------------------------------------------------------- planet card */
  refreshCard() {
    const { systemId, planetId } = S.getSelected();
    const ref = getPlanet(planetId);
    if (!ref || !this.el.card) { if (this.el.card) this.el.card.hidden = true; return; }
    const { planet, system } = ref;
    const t = planetType(planet);
    const col = S.getState().colonies[planetId];
    const st = planet.home ? 'HOME WORLD' : (col ? 'COLONIZED' : 'UNCLAIMED');

    this.el.card.hidden = false;
    this.el.pcType.textContent = t.label.toUpperCase();
    this.el.pcType.style.borderColor = t.accent;
    this.el.pcName.textContent = planet.name;
    this.el.pcSys.textContent = system.name + ' SYSTEM \u00b7 ' + (planet.tag || '');
    const status = this.el.pcStatus;
    status.textContent = st;
    status.className = 'pc-status ' + (col ? 'ok' : 'warn');

    const rate = S.planetRate(planetId);
    this.el.pcStats.innerHTML = RESOURCES.map(r =>
      `<div class="pc-stat"><i class="ic-${r.id}">${ICONS[r.id]}</i>
        <span class="k">${r.name}</span>
        <b>${formatRate(rate[r.id] || 0)}</b></div>`
    ).join('') + `<div class="pc-stat"><i class="ic-crystal">${ICONS.crystal}</i><span class="k">Tier</span><b>${col ? 'Settled' : (planetType(planet).baseColonizable ? 'Settleable' : 'Hostile')}</b></div>`;

    this.el.pcBody.innerHTML = `<p class="lore">${planet.lore || t.desc}</p>`;

    const acts = [];
    if (!col) {
      const chk = S.colonizeCheck(planetId);
      const cost = chk.cost || S.colonizeCost(planet);
      acts.push(`<button class="btn primary" data-act="colonize" data-planet="${planetId}" ${chk.ok ? '' : 'disabled'}>
        Colonize <span class="cost">${cost.metal}M / ${cost.crystal}C</span></button>`);
      if (!chk.ok) acts.push(`<span class="hint">${chk.reason}</span>`);
    } else {
      acts.push(`<button class="btn primary" data-act="open-world" data-panel="planet">Manage World</button>`);
    }
    acts.push(`<button class="btn ghost" data-act="center" data-planet="${planetId}">Center</button>`);
    this.el.pcActions.innerHTML = acts.join('');
  }

  refreshCardStatus() { /* rate cells refresh on tick via panel; card is cheap */
    if (this.el.card && !this.el.card.hidden) this.refreshCard();
  }

  /* ------------------------------------------------------------- panels */
  openPanel(name) {
    if (!this.el.panels[name]) return;
    this.panel = name;
    this.el.sheet.classList.add('open');
    this.el.sheet.setAttribute('aria-hidden', 'false');
    const titles = { planet: 'WORLD', research: 'RESEARCH', shipyard: 'SHIPYARD', fleet: 'FLEET', help: 'COMMAND LOG' };
    this.el.sheetTitle.textContent = titles[name] || name.toUpperCase();
    for (const k of Object.keys(this.el.panels)) {
      this.el.panels[k].classList.toggle('active', k === name);
    }
    this._renderPanel(name);
    // reflect selection in dock
    if (this.el.dock) for (const b of this.el.dock.querySelectorAll('.dock-btn')) {
      b.classList.toggle('is-sel', b.dataset.panel === name);
    }
  }

  closePanel() {
    this.panel = null;
    this.el.sheet.classList.remove('open');
    this.el.sheet.setAttribute('aria-hidden', 'true');
    if (this.el.dock) for (const b of this.el.dock.querySelectorAll('.dock-btn')) b.classList.remove('is-sel');
  }

  togglePanel(name) { if (this.panel === name) this.closePanel(); else this.openPanel(name); }

  _refreshOpenPanel() { if (this.panel) this._renderPanel(this.panel); }

  _renderPanel(name) {
    const p = this.el.panels[name];
    if (!p) return;
    if (name === 'planet') p.innerHTML = this._worldHtml();
    else if (name === 'research') p.innerHTML = this._researchHtml();
    else if (name === 'shipyard') p.innerHTML = this._shipyardHtml();
    else if (name === 'fleet') p.innerHTML = this._fleetHtml();
    else if (name === 'help') p.innerHTML = this._helpHtml();
  }

  /* ----- world panel: mine / power upgrades ----- */
  _worldHtml() {
    const { planetId } = S.getSelected();
    const ref = getPlanet(planetId);
    if (!ref) return `<p class="muted">Select a world from the galaxy.</p>`;
    const col = S.getState().colonies[planetId];
    if (!col) {
      const chk = S.colonizeCheck(planetId);
      const cost = chk.cost || S.colonizeCost(ref.planet);
      return `<div class="p-head"><h3>${ref.planet.name}</h3><span class="p-sub">${ref.system.name} \u00b7 ${planetType(ref.planet).label}</span></div>
        <p class="muted">Not yet colonized.</p>
        <button class="btn primary" data-act="colonize" data-planet="${planetId}" ${chk.ok ? '' : 'disabled'}>
          Colonize <span class="cost">${cost.metal}M / ${cost.crystal}C</span></button>
        ${chk.ok ? '' : `<span class="hint">${chk.reason}</span>`}`;
    }
    const rows = Object.values(BUILDINGS).map((b) => {
      const lvl = S.buildingLevel(planetId, b.id);
      const cost = S.buildingCost(planetId, b.id);
      const next = cost ? `<span class="cost">${cost.metal}M / ${cost.crystal}C</span>` : '';
      const maxed = !cost;
      return `<div class="row">
        <div class="row-ic">${ICONS[b.icon] || ICONS.mine}</div>
        <div class="row-main"><b>${b.name}</b><span class="row-sub">Lv ${lvl} / ${b.maxLevel} \u00b7 ${b.unlocks}</span></div>
        <button class="btn sm ${maxed ? 'ghost' : 'primary'}" data-act="upgrade" data-building="${b.id}" ${maxed ? 'disabled' : ''}>
          ${maxed ? 'MAX' : 'Upgrade'} ${next}</button>
      </div>`;
    }).join('');
    const rate = S.planetRate(planetId);
    const rateLine = RESOURCES.map(r => `${ICONS[r.id]} ${formatRate(rate[r.id] || 0)}`).join(' &nbsp; ');
    return `<div class="p-head"><h3>${ref.planet.name}</h3><span class="p-sub">${ref.system.name} \u00b7 ${planetType(ref.planet).label}</span></div>
      <div class="rate-line">${rateLine}</div>
      <div class="rows">${rows}</div>
      <p class="muted sm">Upgrades apply instantly and raise this world's output.</p>`;
  }

  /* ----- research panel ----- */
  _researchHtml() {
    const st = S.getState();
    const act = st.research.active;
    const actLine = act ? (() => {
      const r = RESEARCH_INDEX[act.id];
      const total = S.researchTime(act.id) * 1000;
      const left = Math.max(0, act.endsAt - Date.now());
      const pct = Math.max(0, Math.min(100, 100 - (left / total) * 100));
      return `<div class="progress"><div class="pg-head"><b>${r.name}</b><span>${Math.ceil(left / 1000)}s left</span></div>
        <div class="pg-bar"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
    })() : `<p class="muted sm">No active project. Choose one below.</p>`;

    const rows = RESEARCH.map((r) => {
      const s = S.researchState(r.id);
      const cost = Object.entries(r.cost).map(([k, v]) => v + k[0].toUpperCase()).join(' ');
      const label = s === 'done' ? 'Complete' : s === 'active' ? 'Running' : s === 'locked' ? 'Locked' : 'Start';
      const dis = s === 'done' || s === 'active' || s === 'locked' || !!act;
      const reqs = r.requires.length ? `<span class="row-sub">needs ${r.requires.map(x => RESEARCH_INDEX[x].name).join(', ')}</span>` : '';
      return `<div class="row">
        <div class="row-ic">${ICONS[r.icon] || ICONS.research}</div>
        <div class="row-main"><b>${r.name}</b><span class="row-sub">Tier ${r.tier} \u00b7 ${r.desc}</span>${reqs}</div>
        <button class="btn sm ${s === 'available' ? 'primary' : 'ghost'}" data-act="research" data-research="${r.id}" ${dis ? 'disabled' : ''}>
          ${label} <span class="cost">${s === 'done' ? '' : cost}</span></button>
      </div>`;
    }).join('');
    return `<div class="p-head"><h3>Research</h3><span class="p-sub">${Object.keys(st.research.unlocked).length}/${RESEARCH.length} complete</span></div>
      ${actLine}<div class="rows">${rows}</div>`;
  }

  /* ----- shipyard panel ----- */
  _shipyardHtml() {
    const { planetId } = S.getSelected();
    const ref = getPlanet(planetId);
    const col = ref && S.getState().colonies[planetId];
    if (!col) return `<div class="p-head"><h3>Shipyard</h3></div><p class="muted">Select a colonized world to build hulls there.</p>`;
    const q = S.queueFor(planetId);
    const qLine = q ? (() => {
      const s = SHIP_INDEX[q.shipId];
      const total = S.shipBuildTime(q.shipId) * 1000;
      const left = Math.max(0, q.endsAt - Date.now());
      const pct = Math.max(0, Math.min(100, 100 - (left / total) * 100));
      return `<div class="progress"><div class="pg-head"><b>${s.name}</b><span>${Math.ceil(left / 1000)}s</span></div>
        <div class="pg-bar"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
    })() : '';
    const rows = SHIPS.map((s) => {
      const unlocked = S.shipUnlocked(s.id);
      const cost = Object.entries(s.cost).map(([k, v]) => v + k[0].toUpperCase()).join(' ');
      const dis = !unlocked || !!q;
      return `<div class="row ship-row">
        <div class="row-ic ship-ic">${SHIP_SVG[s.svg] || ''}</div>
        <div class="row-main"><b>${s.name}</b><span class="row-sub">${s.role} \u00b7 hull ${s.stats.hull} \u00b7 spd ${s.stats.speed}</span>
          <span class="row-sub">${unlocked ? s.desc : 'Locked — requires ' + (RESEARCH_INDEX[s.unlock] ? RESEARCH_INDEX[s.unlock].name : s.unlock)}</span></div>
        <button class="btn sm ${unlocked ? 'primary' : 'ghost'}" data-act="build" data-ship="${s.id}" ${dis ? 'disabled' : ''}>
          Build <span class="cost">${cost}</span></button>
      </div>`;
    }).join('');
    return `<div class="p-head"><h3>Shipyard</h3><span class="p-sub">${ref.planet.name} \u00b7 ${ref.system.name}</span></div>
      ${qLine}<div class="rows">${rows}</div>
      <p class="muted sm">Completed hulls join the <b>1st Helios Vanguard</b> fleet.</p>`;
  }

  /* ----- fleet panel with original ship designs ----- */
  _fleetHtml() {
    const st = S.getState();
    const fleets = Object.keys(st.fleet);
    if (!fleets.length) return `<div class="p-head"><h3>Fleet</h3></div><p class="muted">No fleets in service yet.</p>`;
    return fleets.map((fid, i) => {
      const design = FLEET_DESIGNS[i % FLEET_DESIGNS.length];
      const ships = S.fleetShips(fid);
      const str = S.fleetStrength(fid);
      const cards = ships.length ? ships.map(({ ship, count }) => `
        <div class="ship-card">
          <div class="ship-art">${SHIP_SVG[ship.svg] || ''}</div>
          <div class="ship-meta"><b>${ship.name}</b><span>${ship.role}</span>
            <span class="count">\u00d7${count}</span></div>
        </div>`).join('') : `<p class="muted sm">No hulls assigned.</p>`;
      return `<div class="fleet-block">
        <div class="p-head"><h3>${design.name}</h3><span class="p-sub">${str.ships} hulls \u00b7 strength ${formatNum(str.hull)}</span></div>
        <p class="motto" style="--accent:${design.accent}">"${design.motto}"</p>
        <div class="ship-grid">${cards}</div>
      </div>`;
    }).join('');
  }

  /* ----- help / command log ----- */
  _helpHtml() {
    const st = S.getState();
    const rate = S.sectorRate();
    const totalRate = Object.values(rate).reduce((a, b) => a + b, 0);
    return `<div class="p-head"><h3>Command Log</h3><span class="p-sub">${GAME.milestone}</span></div>
      <div class="kv"><span>Colonies</span><b>${Object.keys(st.colonies).length}</b></div>
      <div class="kv"><span>Hulls in service</span><b>${S.totalShips()}</b></div>
      <div class="kv"><span>Research complete</span><b>${Object.keys(st.research.unlocked).length}/${RESEARCH.length}</b></div>
      <div class="kv"><span>Total output</span><b>${formatRate(totalRate)}</b></div>
      <div class="kv"><span>Ore mined</span><b>${formatNum(Math.round(st.stats.oreMined))}</b></div>
      <div class="p-head sep"><h3>Controls</h3></div>
      <ul class="help">
        <li><b>Drag</b> orbit \u00b7 <b>Wheel / pinch</b> zoom \u00b7 <b>Double-click</b> overview</li>
        <li><b>Click a planet</b> to select it and fly the camera in</li>
        <li><b>Colonize</b> a world, then <b>upgrade Mine</b> / <b>Power Plant</b> to grow output</li>
        <li><b>Research</b> unlocks hostile worlds (Colony Tech) and new hulls</li>
        <li><b>Shipyard</b> builds hulls; <b>Fleet</b> shows your designs</li>
        <li>Progress saves locally; use <b>Save</b> or export a save file below</li>
      </ul>
      <div class="p-head sep"><h3>Save Data</h3></div>
      <div class="btn-row">
        <button class="btn sm" data-act="save">Save now</button>
        <button class="btn sm ghost" data-act="export">Export</button>
        <button class="btn sm ghost" data-act="import">Import</button>
        <button class="btn sm danger" data-act="reset">New game</button>
      </div>
      <p class="muted sm">Sound starts OFF. Enable it with the speaker button, top-right.</p>
      <p class="muted sm">VOID FRONTIER \u00b7 all artwork generated in-browser \u00b7 v${GAME.version}</p>`;
  }

  /* -------------------------------------------------------------- toasts */
  toast(msg, kind) {
    if (!this.el.toasts) return;
    const id = 't' + (++this._toastSeq);
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.id = id;
    el.textContent = msg;
    this.el.toasts.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
    if (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  updateSoundButton(on) {
    const b = this.el.soundBtn;
    if (!b) return;
    b.classList.toggle('is-on', !!on);
    b.setAttribute('aria-pressed', String(!!on));
    b.title = on ? 'Sound on' : 'Sound off';
  }

  setLoading(pct, msg) {
    const fill = document.getElementById('ov-fill');
    const m = document.getElementById('ov-msg');
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (m && msg) m.textContent = msg;
  }

  hideOverlay() {
    const ov = document.getElementById('overlay');
    if (ov) { ov.classList.remove('show'); setTimeout(() => { ov.style.display = 'none'; }, 500); }
  }

  fatal(msg, detail) {
    const ov = document.getElementById('overlay');
    const err = document.getElementById('ov-err');
    if (ov) { ov.classList.add('show'); ov.style.display = ''; }
    const m = document.getElementById('ov-msg');
    if (m) m.textContent = msg || 'Something went wrong.';
    if (err) { err.hidden = false; err.textContent = detail || ''; }
  }

  /* ----------------------------------------------------- global delegation */
  _wireGlobalActions() {
    const onClick = (e) => {
      const chip = e.target.closest('[data-chip-system]');
      if (chip) { this.c.selectSystem(chip.dataset.chipSystem); return; }

      const target = e.target.closest('[data-action],[data-act]');
      if (!target) return;

      // top-level actions
      const action = target.dataset.action;
      if (action === 'toggle-sound') { this.c.toggleSound(); return; }
      if (action === 'save') { this.c.saveGame(); return; }
      if (action === 'close-sheet') { this.closePanel(); return; }
      if (action === 'map') { this.c.overview(); this.closePanel(); return; }
      if (action === 'panel') { this.togglePanel(target.dataset.panel); return; }

      // in-panel / card actions
      const act = target.dataset.act;
      if (!act) return;
      if (act === 'center') { this.c.selectPlanet(null, target.dataset.planet); return; }
      if (act === 'open-world') { this.openPanel('planet'); return; }
      if (act === 'colonize') {
        const r = S.colonize(target.dataset.planet);
        this.toast(r.msg, r.ok ? 'ok' : 'err');
        if (r.ok) this.c.selectPlanet(null, target.dataset.planet);
        return;
      }
      if (act === 'upgrade') {
        const { planetId } = S.getSelected();
        const r = S.upgrade(planetId, target.dataset.building);
        this.toast(r.msg, r.ok ? 'ok' : 'err');
        return;
      }
      if (act === 'research') {
        const r = S.startResearch(target.dataset.research);
        this.toast(r.msg, r.ok ? 'ok' : 'err');
        return;
      }
      if (act === 'build') {
        const { planetId } = S.getSelected();
        const r = S.buildShip(planetId, target.dataset.ship, 'fleet_helios');
        this.toast(r.msg, r.ok ? 'ok' : 'err');
        return;
      }
      if (act === 'save') { this.c.saveGame(); return; }
      if (act === 'export') { this.c.exportSave(); return; }
      if (act === 'import') { this.c.importSave(); return; }
      if (act === 'reset') { this.c.resetGame(); return; }
    };
    document.addEventListener('click', onClick);
    this._onClick = onClick;
  }
}
