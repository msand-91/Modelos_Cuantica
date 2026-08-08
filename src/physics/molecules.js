// Catalogo de moleculas con geometrias EXPERIMENTALES (distancias en angstrom,
// angulos en grados). Las coordenadas se generan con constructores geometricos
// para no equivocarse escribiendo cartesianas a mano.
//
// Cada entrada declara ademas la carga y la multiplicidad del estado
// fundamental, que es lo que necesita el SCF.

import { elementBySym } from './atoms.js';

export const ANG_TO_BOHR = 1.8897259886;
const D2R = Math.PI / 180;

// --- Constructores geometricos ---------------------------------------------
const at = (sym, x, y, z) => ({ sym, x, y, z });

// A-B a lo largo de z.
const diatomic = (A, B, r) => [at(A, 0, 0, 0), at(B, 0, 0, r)];

// B-A-B lineal (A en el centro).
const linearAB2 = (A, B, r) => [at(A, 0, 0, 0), at(B, 0, 0, r), at(B, 0, 0, -r)];

// A-B-C lineal.
const linearABC = (A, B, C, r1, r2) => [at(A, 0, 0, 0), at(B, 0, 0, r1), at(C, 0, 0, r1 + r2)];

// AB2 angular (agua): eje C2 sobre z, molecula en el plano xz.
function bentAB2(A, B, r, angle) {
  const h = (angle * D2R) / 2;
  return [
    at(A, 0, 0, 0),
    at(B, r * Math.sin(h), 0, r * Math.cos(h)),
    at(B, -r * Math.sin(h), 0, r * Math.cos(h)),
  ];
}

// AB3 plana trigonal (BH3) en el plano xy.
function planarAB3(A, B, r) {
  const out = [at(A, 0, 0, 0)];
  for (let i = 0; i < 3; i++) {
    const a = (i * 120) * D2R;
    out.push(at(B, r * Math.cos(a), r * Math.sin(a), 0));
  }
  return out;
}

// AB3 piramidal (NH3): angulo B-A-B dado.
function pyramidalAB3(A, B, r, angle) {
  // cos(angle) = ... resolvemos el angulo polar theta desde el eje C3.
  const c = Math.cos(angle * D2R);
  // Para tres enlaces equivalentes: cos(angle) = (3 cos^2(t) - 1) / 2 con t el
  // angulo de cada enlace respecto al eje C3 -> despejamos sin/cos.
  const cosT = Math.sqrt((2 * c + 1) / 3);
  const sinT = Math.sqrt(1 - cosT * cosT);
  const out = [at(A, 0, 0, 0)];
  for (let i = 0; i < 3; i++) {
    const p = (i * 120) * D2R;
    out.push(at(B, r * sinT * Math.cos(p), r * sinT * Math.sin(p), r * cosT));
  }
  return out;
}

// AB4 tetraedrica (CH4).
function tetrahedralAB4(A, B, r) {
  const k = r / Math.sqrt(3);
  return [
    at(A, 0, 0, 0),
    at(B, k, k, k), at(B, -k, -k, k), at(B, -k, k, -k), at(B, k, -k, -k),
  ];
}

// Etileno: C=C sobre z, hidrogenos en el plano xz.
function ethylene(rCC, rCH, angHCH) {
  const half = rCC / 2;
  const a = (angHCH * D2R) / 2;
  const out = [at('C', 0, 0, half), at('C', 0, 0, -half)];
  for (const s of [1, -1]) {
    out.push(at('H', s * rCH * Math.sin(a), 0, half + rCH * Math.cos(a)));
    out.push(at('H', s * rCH * Math.sin(a), 0, -half - rCH * Math.cos(a)));
  }
  return out;
}

// Formaldehido H2C=O (plano xz).
function formaldehyde(rCO, rCH, angHCH) {
  const a = (angHCH * D2R) / 2;
  return [
    at('C', 0, 0, 0), at('O', 0, 0, rCO),
    at('H', rCH * Math.sin(a), 0, -rCH * Math.cos(a)),
    at('H', -rCH * Math.sin(a), 0, -rCH * Math.cos(a)),
  ];
}

// Anillo plano de n atomos de radio R (plano xy), con sustituyentes radiales.
function ring(symRing, n, R, symSub, Rsub) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    out.push(at(symRing, R * Math.cos(a), R * Math.sin(a), 0));
  }
  if (symSub) {
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      out.push(at(symSub, Rsub * Math.cos(a), Rsub * Math.sin(a), 0));
    }
  }
  return out;
}

// Triangulo equilatero (H3+).
function triangle(sym, side) {
  const R = side / Math.sqrt(3);
  return [0, 1, 2].map((i) => {
    const a = (i * 120) * D2R;
    return at(sym, R * Math.cos(a), R * Math.sin(a), 0);
  });
}

// ---------------------------------------------------------------------------
// Catalogo. `bond` es la distancia ajustable (solo diatomicas) para la curva
// de energia potencial E(R).
// ---------------------------------------------------------------------------
export const MOLECULES = [
  { key: 'H2',    name: 'H₂ — hidrógeno',        charge: 0, mult: 1, bond: 0.741, build: (r) => diatomic('H', 'H', r) },
  { key: 'HeH+',  name: 'HeH⁺ — hidruro de helio', charge: 1, mult: 1, bond: 0.774, bonds: [[0, 1]], build: (r) => diatomic('He', 'H', r) },
  { key: 'LiH',   name: 'LiH — hidruro de litio', charge: 0, mult: 1, bond: 1.595, build: (r) => diatomic('Li', 'H', r) },
  { key: 'Li2',   name: 'Li₂ — dilitio',          charge: 0, mult: 1, bond: 2.673, build: (r) => diatomic('Li', 'Li', r) },
  { key: 'HF',    name: 'HF — fluoruro de hidrógeno', charge: 0, mult: 1, bond: 0.917, build: (r) => diatomic('F', 'H', r) },
  { key: 'HCl',   name: 'HCl — cloruro de hidrógeno', charge: 0, mult: 1, bond: 1.275, build: (r) => diatomic('Cl', 'H', r) },
  { key: 'N2',    name: 'N₂ — nitrógeno',         charge: 0, mult: 1, bond: 1.098, build: (r) => diatomic('N', 'N', r) },
  { key: 'O2',    name: 'O₂ — oxígeno (triplete)', charge: 0, mult: 3, bond: 1.208, build: (r) => diatomic('O', 'O', r) },
  { key: 'F2',    name: 'F₂ — flúor',             charge: 0, mult: 1, bond: 1.412, build: (r) => diatomic('F', 'F', r) },
  { key: 'CO',    name: 'CO — monóxido de carbono', charge: 0, mult: 1, bond: 1.128, build: (r) => diatomic('C', 'O', r) },
  { key: 'LiF',   name: 'LiF — fluoruro de litio (iónico)', charge: 0, mult: 1, bond: 1.564, build: (r) => diatomic('Li', 'F', r) },
  { key: 'H2+',   name: 'H₂⁺ — ion molecular (1 e⁻)', charge: 1, mult: 2, bond: 1.057, bonds: [[0, 1]], build: (r) => diatomic('H', 'H', r) },
  { key: 'H3+',   name: 'H₃⁺ — triangular (enlace 3c-2e)', charge: 1, mult: 1, bonds: [[0, 1], [1, 2], [0, 2]], build: () => triangle('H', 0.87) },
  { key: 'H2O',   name: 'H₂O — agua',             charge: 0, mult: 1, build: () => bentAB2('O', 'H', 0.958, 104.5) },
  { key: 'OH-',   name: 'OH⁻ — hidróxido (anión)', charge: -1, mult: 1, build: () => diatomic('O', 'H', 0.964) },
  { key: 'H3O+',  name: 'H₃O⁺ — hidronio (catión)', charge: 1, mult: 1, build: () => pyramidalAB3('O', 'H', 0.976, 111.3) },
  { key: 'NH3',   name: 'NH₃ — amoníaco',         charge: 0, mult: 1, build: () => pyramidalAB3('N', 'H', 1.012, 106.7) },
  { key: 'NH4+',  name: 'NH₄⁺ — amonio (catión)', charge: 1, mult: 1, build: () => tetrahedralAB4('N', 'H', 1.021) },
  { key: 'CH4',   name: 'CH₄ — metano',           charge: 0, mult: 1, build: () => tetrahedralAB4('C', 'H', 1.087) },
  { key: 'BH3',   name: 'BH₃ — borano (plano)',   charge: 0, mult: 1, build: () => planarAB3('B', 'H', 1.19) },
  { key: 'BeH2',  name: 'BeH₂ — lineal',          charge: 0, mult: 1, build: () => linearAB2('Be', 'H', 1.334) },
  { key: 'CO2',   name: 'CO₂ — dióxido de carbono', charge: 0, mult: 1, build: () => linearAB2('C', 'O', 1.160) },
  { key: 'HCN',   name: 'HCN — cianuro de hidrógeno', charge: 0, mult: 1, build: () => linearABC('H', 'C', 'N', 1.064, 1.156) },
  { key: 'O3',    name: 'O₃ — ozono',             charge: 0, mult: 1, build: () => bentAB2('O', 'O', 1.278, 116.8) },
  { key: 'H2CO',  name: 'H₂CO — formaldehído',    charge: 0, mult: 1, build: () => formaldehyde(1.203, 1.111, 116.5) },
  { key: 'C2H2',  name: 'C₂H₂ — acetileno',       charge: 0, mult: 1, build: () => [at('C', 0, 0, 0.6015), at('C', 0, 0, -0.6015), at('H', 0, 0, 1.6625), at('H', 0, 0, -1.6625)] },
  { key: 'C2H4',  name: 'C₂H₄ — etileno',         charge: 0, mult: 1, build: () => ethylene(1.339, 1.087, 117.4) },
  { key: 'C6H6',  name: 'C₆H₆ — benceno (lento)', charge: 0, mult: 1, build: () => ring('C', 6, 1.397, 'H', 2.484) },
];

export const moleculeByKey = (key) => MOLECULES.find((m) => m.key === key) || MOLECULES[0];

// ---------------------------------------------------------------------------
// Construye el sistema listo para el calculo: posiciones en BOHR, centradas en
// el centroide nuclear (asi la rejilla cubica de la visualizacion lo encuadra).
// ---------------------------------------------------------------------------
export function buildMolecule(key, bondOverride = null) {
  const def = moleculeByKey(key);
  const raw = def.build(bondOverride ?? def.bond);
  let cx = 0, cy = 0, cz = 0;
  for (const a of raw) { cx += a.x; cy += a.y; cz += a.z; }
  cx /= raw.length; cy /= raw.length; cz /= raw.length;

  const atoms = raw.map((a) => {
    const el = elementBySym(a.sym);
    if (!el) throw new Error(`Elemento no soportado: ${a.sym}`);
    return {
      sym: a.sym, Z: el.Z, color: el.color, rcov: el.rcov,
      pos: [(a.x - cx) * ANG_TO_BOHR, (a.y - cy) * ANG_TO_BOHR, (a.z - cz) * ANG_TO_BOHR],
    };
  });

  const nelec = atoms.reduce((s, a) => s + a.Z, 0) - def.charge;
  return { def, atoms, nelec, charge: def.charge, mult: def.mult };
}

// Enlaces "de dibujo": pares cuya distancia es menor que 1.25 veces la suma de
// radios covalentes. Solo afecta a la representacion (barras), no al calculo.
//
// El criterio de radios covalentes esta pensado para enlaces de PAR de
// electrones y se queda corto en las especies deficientes en electrones, cuyos
// enlaces son mucho mas largos: H2+ (un solo electron, 1.06 A) y H3+ (enlace de
// tres centros y dos electrones, 0.87 A) se quedaban dibujados como atomos
// sueltos aunque el analisis QTAIM SI encuentra sus caminos de enlace. Para esos
// casos el catalogo declara los enlaces a mano (`bonds`).
export function bondList(atoms, def = null) {
  const dOf = (i, j) => {
    const dx = atoms[i].pos[0] - atoms[j].pos[0];
    const dy = atoms[i].pos[1] - atoms[j].pos[1];
    const dz = atoms[i].pos[2] - atoms[j].pos[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) / ANG_TO_BOHR;
  };
  if (def && def.bonds) {
    return def.bonds
      .filter(([i, j]) => i < atoms.length && j < atoms.length)
      .map(([i, j]) => ({ i, j, d: dOf(i, j) }));
  }
  const out = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = dOf(i, j);
      const lim = 1.25 * (atoms[i].rcov + atoms[j].rcov);
      if (d < lim) out.push({ i, j, d });
    }
  }
  return out;
}

// Extension espacial: semilado de la caja de muestreo (bohr).
export function boxHalfSize(atoms, margin = 5.5) {
  let m = 0;
  for (const a of atoms) {
    m = Math.max(m, Math.abs(a.pos[0]), Math.abs(a.pos[1]), Math.abs(a.pos[2]));
  }
  return m + margin;
}
