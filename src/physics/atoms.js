// Tabla periodica reducida (Z = 1..20) y utilidades de configuracion
// electronica. Es el punto de partida de los atomos POLIELECTRONICOS: de aqui
// salen las capas ocupadas, la carga nuclear y las reglas de Slater.

export const ELEMENTS = [
  // sym, nombre, masa (u), radio covalente (A), color CPK
  { Z: 1,  sym: 'H',  name: 'hidrógeno', mass: 1.008,  rcov: 0.31, color: '#ffffff' },
  { Z: 2,  sym: 'He', name: 'helio',     mass: 4.0026, rcov: 0.28, color: '#d9ffff' },
  { Z: 3,  sym: 'Li', name: 'litio',     mass: 6.94,   rcov: 1.28, color: '#cc80ff' },
  { Z: 4,  sym: 'Be', name: 'berilio',   mass: 9.0122, rcov: 0.96, color: '#c2ff00' },
  { Z: 5,  sym: 'B',  name: 'boro',      mass: 10.81,  rcov: 0.84, color: '#ffb5b5' },
  { Z: 6,  sym: 'C',  name: 'carbono',   mass: 12.011, rcov: 0.76, color: '#909090' },
  { Z: 7,  sym: 'N',  name: 'nitrógeno', mass: 14.007, rcov: 0.71, color: '#3050f8' },
  { Z: 8,  sym: 'O',  name: 'oxígeno',   mass: 15.999, rcov: 0.66, color: '#ff2020' },
  { Z: 9,  sym: 'F',  name: 'flúor',     mass: 18.998, rcov: 0.57, color: '#90e050' },
  { Z: 10, sym: 'Ne', name: 'neón',      mass: 20.180, rcov: 0.58, color: '#b3e3f5' },
  { Z: 11, sym: 'Na', name: 'sodio',     mass: 22.990, rcov: 1.66, color: '#ab5cf2' },
  { Z: 12, sym: 'Mg', name: 'magnesio',  mass: 24.305, rcov: 1.41, color: '#8aff00' },
  { Z: 13, sym: 'Al', name: 'aluminio',  mass: 26.982, rcov: 1.21, color: '#bfa6a6' },
  { Z: 14, sym: 'Si', name: 'silicio',   mass: 28.085, rcov: 1.11, color: '#f0c8a0' },
  { Z: 15, sym: 'P',  name: 'fósforo',   mass: 30.974, rcov: 1.07, color: '#ff8000' },
  { Z: 16, sym: 'S',  name: 'azufre',    mass: 32.06,  rcov: 1.05, color: '#ffff30' },
  { Z: 17, sym: 'Cl', name: 'cloro',     mass: 35.45,  rcov: 1.02, color: '#1ff01f' },
  { Z: 18, sym: 'Ar', name: 'argón',     mass: 39.95,  rcov: 1.06, color: '#80d1e3' },
  { Z: 19, sym: 'K',  name: 'potasio',   mass: 39.098, rcov: 2.03, color: '#8f40d4' },
  { Z: 20, sym: 'Ca', name: 'calcio',    mass: 40.078, rcov: 1.76, color: '#3dff00' },
];

export const elementByZ = (Z) => ELEMENTS.find((e) => e.Z === Z);
export const elementBySym = (sym) => ELEMENTS.find((e) => e.sym === sym);

// Energias Hartree-Fock NUMERICAS (limite de base infinita) de los atomos
// neutros, en hartree. Sirven de referencia para ver cuanto captura la base
// elegida: E_SCF(base) >= E_HF(limite) >= E_exacta  (teorema variacional).
export const HF_LIMIT = {
  H: -0.5, He: -2.861680, Li: -7.432727, Be: -14.573023, B: -24.529061,
  C: -37.688619, N: -54.400934, O: -74.809398, F: -99.409349, Ne: -128.547098,
  Na: -161.858911, Mg: -199.614636, Al: -241.876707, Si: -288.854362,
  P: -340.718781, S: -397.504896, Cl: -459.482072, Ar: -526.817513,
};

// Orden de llenado (aufbau) suficiente hasta Z = 20.
const AUFBAU = [
  { n: 1, l: 0 }, { n: 2, l: 0 }, { n: 2, l: 1 }, { n: 3, l: 0 },
  { n: 3, l: 1 }, { n: 4, l: 0 }, { n: 3, l: 2 }, { n: 4, l: 1 },
];

export const SUBSHELL = ['s', 'p', 'd', 'f'];
export const capacity = (l) => 2 * (2 * l + 1);

// Configuracion electronica por aufbau para N electrones.
// Devuelve [{ n, l, occ }] en orden de llenado.
export function configFor(nelec) {
  const cfg = [];
  let left = nelec;
  for (const sh of AUFBAU) {
    if (left <= 0) break;
    const occ = Math.min(left, capacity(sh.l));
    cfg.push({ n: sh.n, l: sh.l, occ });
    left -= occ;
  }
  if (left > 0) throw new Error('Demasiados electrones para la tabla incluida (Z <= 20).');
  return cfg;
}

// Texto de la configuracion: "1s² 2s² 2p⁴".
const SUPER = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', 10: '¹⁰' };
export function configText(cfg) {
  return cfg.map((s) => `${s.n}${SUBSHELL[s.l]}${SUPER[s.occ] ?? `^${s.occ}`}`).join(' ');
}

// Multiplicidad de espin del estado fundamental segun la regla de Hund:
// la ultima subcapa parcialmente llena maximiza el numero de espines paralelos.
export function hundMultiplicity(cfg) {
  let unpaired = 0;
  for (const sh of cfg) {
    const cap = capacity(sh.l);
    if (sh.occ === cap) continue;
    unpaired = sh.occ <= cap / 2 ? sh.occ : cap - sh.occ;
  }
  return unpaired + 1;
}

// Termino atomico basico (2S+1)L para configuraciones s/p simples, obtenido
// de las reglas de Hund (maximo S, luego maximo L compatible).
export function hundTerm(cfg) {
  const open = cfg.find((s) => s.occ > 0 && s.occ < capacity(s.l));
  if (!open) return { S: 0, L: 0, mult: 1, label: '¹S' };
  const cap = capacity(open.l);
  const k = open.occ <= cap / 2 ? open.occ : cap - open.occ;   // "huecos" o electrones
  const S = k / 2;
  // L maximo compatible con espines paralelos: suma de los m_l mas altos.
  let L = 0;
  const ml = [];
  for (let m = open.l; m >= -open.l; m--) ml.push(m);
  for (let i = 0; i < k; i++) L += ml[i];
  L = Math.abs(L);
  const LET = ['S', 'P', 'D', 'F', 'G'];
  const mult = 2 * S + 1;
  const MULTSUP = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷' };
  return { S, L, mult, label: `${MULTSUP[mult] ?? mult}${LET[L] ?? L}` };
}

// ---------------------------------------------------------------------------
// REGLAS DE SLATER para la carga nuclear efectiva.
//   Z_ef = Z - sigma
// Apantallamiento sigma sobre un electron de la subcapa (n, l):
//   * 1s: 0.30 por el otro electron 1s.
//   * (ns, np): 0.35 por cada electron del MISMO grupo, 0.85 por cada uno de
//     n-1, y 1.00 por cada uno de capas mas internas.
//   * (nd, nf): 0.35 dentro del grupo y 1.00 por TODO lo demas (los d/f apenas
//     penetran).
// El exponente del orbital de Slater es zeta = Z_ef / n*, con n* efectivo.
// ---------------------------------------------------------------------------
const NSTAR = { 1: 1, 2: 2, 3: 3, 4: 3.7, 5: 4.0, 6: 4.2 };

export function slaterScreening(cfg, n, l) {
  let s = 0;
  for (const sh of cfg) {
    const sameGroup = sh.n === n && ((l <= 1 && sh.l <= 1) || (l >= 2 && sh.l === l));
    let count = sh.occ;
    // El electron considerado no se apantalla a si mismo: se descuenta UNA vez,
    // y solo de su propia subcapa (el grupo (ns,np) puede tener dos subcapas).
    if (sh.n === n && sh.l === l) count -= 1;
    if (count <= 0) continue;
    if (sameGroup) {
      s += count * (n === 1 ? 0.30 : 0.35);
    } else if (l >= 2) {
      // Para d y f, todo lo que no sea su grupo apantalla por completo.
      if (sh.n < n || (sh.n === n && sh.l < l)) s += sh.occ * 1.0;
    } else if (sh.n === n - 1) {
      s += sh.occ * 0.85;
    } else if (sh.n < n - 1) {
      s += sh.occ * 1.0;
    }
  }
  return s;
}

export function slaterZeta(Z, cfg, n, l) {
  const zef = Z - slaterScreening(cfg, n, l);
  return Math.max(zef, 0.3) / (NSTAR[n] || n);
}

export function slaterZeff(Z, cfg, n, l) {
  return Z - slaterScreening(cfg, n, l);
}
