// Punto de entrada de la quimica cuantica: de un sistema (nucleos + electrones
// + base) a la funcion de onda completa.
//
// El resultado es UN DETERMINANTE DE SLATER:
//
//        | phi_1(1) alpha(1)   phi_1(2) alpha(2)  ... |
//   Psi = 1/sqrt(N!) det | phi_1(1) beta(1)   ...            |
//        | ...                                        |
//
// construido con los orbitales que minimizan <Psi|H|Psi> (Hartree-Fock). De el
// salen la energia, la densidad electronica, las cargas atomicas y los orbitales
// que se dibujan en 3D.

import { buildBasis } from './basis.js';
import { normalizeBasis, buildIntegrals, nuclearRepulsion, evalBF } from './gto.js';
import { runSCF } from './scf.js';
import { configFor, configText, hundMultiplicity, elementByZ, SUBSHELL } from './atoms.js';

// ---------------------------------------------------------------------------
// Calculo completo de un sistema.
//   system = { atoms: [{Z, sym, pos(bohr)}], charge, mult, basisOpts, forceUHF }
// ---------------------------------------------------------------------------
export function computeSystem(system, onProgress) {
  const { atoms, charge = 0, basisOpts = {} } = system;
  const nelec = atoms.reduce((s, a) => s + a.Z, 0) - charge;
  if (nelec < 1) throw new Error('El sistema se ha quedado sin electrones.');

  const mult = system.mult ?? hundMultiplicity(configFor(nelec));
  const { basis, meta } = buildBasis(atoms, basisOpts);
  normalizeBasis(basis);
  if (onProgress) onProgress({ stage: 'base', frac: 0.05, n: basis.length });

  const nuclei = atoms.map((a) => ({ Z: a.Z, pos: a.pos }));
  const ints = buildIntegrals(basis, nuclei, (f) => {
    if (onProgress) onProgress({ stage: 'integrales', frac: 0.05 + 0.75 * f, n: basis.length });
  });
  if (onProgress) onProgress({ stage: 'scf', frac: 0.85, n: basis.length });

  // Una base con funciones casi identicas (p.ej. difusas muy juntas) hace que
  // S sea casi singular y el SCF se dispare. Si la energia sale fisicamente
  // imposible, repetimos descartando mas combinaciones lineales.
  const floor = -5 * atoms.reduce((s, a) => s + a.Z * a.Z * a.Z, 0) - 10;
  let scf = null;
  for (const thresh of [undefined, 1e-4, 1e-3, 1e-2]) {
    scf = runSCF(ints, nelec, mult, { forceUHF: system.forceUHF, orthoThresh: thresh });
    if (isFinite(scf.E) && scf.E > floor) break;
  }
  const Enuc = nuclearRepulsion(nuclei);
  const Etot = scf.E + Enuc;

  const pop = mullikenCharges(atoms, meta, ints.S, scf);
  const orbitals = describeOrbitals(meta, ints.S, scf);

  if (onProgress) onProgress({ stage: 'listo', frac: 1, n: basis.length });

  return {
    atoms, basis, meta, nelec, charge, mult,
    S: ints.S,
    scf, Enuc, Etot, Eelec: scf.E,
    Ekin: scf.Ekin, Ene: scf.Ene, Eee: scf.Eee,
    virial: -(scf.Ene + Enuc + scf.Eee) / scf.Ekin,
    charges: pop.charges, gross: pop.gross, spinPop: pop.spinPop,
    orbitals, nbf: basis.length,
    method: scf.method, converged: scf.converged, iterations: scf.iterations,
  };
}

// ---------------------------------------------------------------------------
// Analisis de poblacion de Mulliken:  q_A = Z_A - sum_{u in A} (P S)_uu
// ---------------------------------------------------------------------------
function mullikenCharges(atoms, meta, S, scf) {
  const n = meta.length;
  const P = scf.P;
  const gross = new Float64Array(n);
  for (let u = 0; u < n; u++) {
    let s = 0;
    for (let v = 0; v < n; v++) s += P[u][v] * S[v][u];
    gross[u] = s;
  }
  const charges = atoms.map((a) => a.Z);
  for (let u = 0; u < n; u++) charges[meta[u].atom] -= gross[u];

  // Densidad de espin por atomo (solo UHF).
  let spinPop = null;
  if (scf.Pa && scf.Pb) {
    spinPop = atoms.map(() => 0);
    for (let u = 0; u < n; u++) {
      let s = 0;
      for (let v = 0; v < n; v++) s += (scf.Pa[u][v] - scf.Pb[u][v]) * S[v][u];
      spinPop[meta[u].atom] += s;
    }
  }
  return { charges, gross, spinPop };
}

// ---------------------------------------------------------------------------
// Descripcion de cada orbital molecular: energia, ocupacion y composicion
// (que orbitales atomicos aportan y en que proporcion).
// ---------------------------------------------------------------------------
function orbitalComposition(meta, S, C, k) {
  const n = meta.length;
  const contrib = new Float64Array(n);
  let total = 0;
  for (let u = 0; u < n; u++) {
    let s = 0;
    for (let v = 0; v < n; v++) s += C[u][k] * C[v][k] * S[u][v];
    contrib[u] = s;
    total += s;
  }
  const items = [];
  for (let u = 0; u < n; u++) {
    if (Math.abs(contrib[u]) < 0.08 * Math.abs(total || 1)) continue;
    items.push({ label: `${meta[u].sym} ${meta[u].label}`, w: contrib[u] / (total || 1) });
  }
  items.sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  return items.slice(0, 3);
}

function describeOrbitals(meta, S, scf) {
  const out = [];
  const push = (C, eps, occ, spin, nmo) => {
    for (let k = 0; k < nmo; k++) {
      out.push({
        index: k, spin, e: eps[k], occ: occ[k],
        comp: occ[k] > 0 || k < nmo ? orbitalComposition(meta, S, C, k) : [],
      });
    }
  };
  if (scf.method === 'RHF') {
    push(scf.C, scf.eps, scf.occ, 'both', scf.eps.length);
  } else {
    push(scf.Ca, scf.epsA, scf.occA, 'alpha', scf.epsA.length);
    push(scf.Cb, scf.epsB, scf.occB, 'beta', scf.epsB.length);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Evaluadores: funciones f(x,y,z) en coordenadas FISICAS (bohr).
// ---------------------------------------------------------------------------

// Orbital molecular k (de la matriz de coeficientes dada).
export function moEvaluator(basis, C, k) {
  const n = basis.length;
  const cs = new Float64Array(n);
  for (let u = 0; u < n; u++) cs[u] = C[u][k];
  return (x, y, z) => {
    let s = 0;
    for (let u = 0; u < n; u++) {
      const c = cs[u];
      if (c === 0) continue;
      s += c * evalBF(basis[u], x, y, z);
    }
    return s;
  };
}

// Densidad electronica total  rho(r) = sum_uv P_uv chi_u chi_v
export function densityEvaluator(basis, P) {
  const n = basis.length;
  const vals = new Float64Array(n);
  return (x, y, z) => {
    for (let u = 0; u < n; u++) vals[u] = evalBF(basis[u], x, y, z);
    let s = 0;
    for (let u = 0; u < n; u++) {
      const vu = vals[u];
      if (vu === 0) continue;
      s += P[u][u] * vu * vu;
      for (let v = 0; v < u; v++) s += 2 * P[u][v] * vu * vals[v];
    }
    return s;
  };
}

// Densidad de espin  rho_alpha - rho_beta.
export function spinDensityEvaluator(basis, Pa, Pb) {
  const n = basis.length;
  const D = [];
  for (let u = 0; u < n; u++) {
    D.push(new Float64Array(n));
    for (let v = 0; v < n; v++) D[u][v] = Pa[u][v] - Pb[u][v];
  }
  return densityEvaluator(basis, D);
}

// ---------------------------------------------------------------------------
// Texto del determinante de Slater: lista de espin-orbitales ocupados.
// ---------------------------------------------------------------------------
export function determinantInfo(result) {
  const { scf } = result;
  const rows = [];
  if (scf.method === 'RHF') {
    for (let i = 0; i < scf.nocc; i++) {
      rows.push({ mo: i, spin: 'α', e: scf.eps[i] });
      rows.push({ mo: i, spin: 'β', e: scf.eps[i] });
    }
  } else {
    for (let i = 0; i < scf.nalpha; i++) rows.push({ mo: i, spin: 'α', e: scf.epsA[i] });
    for (let i = 0; i < scf.nbeta; i++) rows.push({ mo: i, spin: 'β', e: scf.epsB[i] });
  }
  return {
    n: rows.length,
    rows,
    norm: `1/√${rows.length}!`,
    text: rows.map((r) => `φ${r.mo + 1}${r.spin}`).join(' '),
  };
}

// Configuracion electronica "de libro" para un atomo aislado.
export function atomConfigInfo(Z, charge) {
  const nelec = Z - charge;
  const cfg = configFor(nelec);
  const el = elementByZ(Z);
  return {
    el, nelec, cfg, text: configText(cfg), mult: hundMultiplicity(cfg),
  };
}

// Etiqueta corta de una subcapa.
export const shellLabel = (n, l) => `${n}${SUBSHELL[l]}`;
