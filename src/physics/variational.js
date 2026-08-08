// TEOREMA VARIACIONAL aplicado a la base.
//
//   E[Psi_prueba] = <Psi|H|Psi> / <Psi|Psi>  >=  E_0
//
// Cualquier parametro de la funcion de prueba se puede optimizar sin conocer la
// solucion exacta: basta bajar la energia. Aqui optimizamos los EXPONENTES de
// los orbitales de Slater (un factor global, o uno por subcapa), que es el
// ejemplo clasico —el mismo con el que se obtiene zeta = 27/16 en el helio—.

import { computeSystem } from './qchem.js';
import { goldenSection, nelderMead } from './optimize.js';
import { configFor, SUBSHELL } from './atoms.js';
import { buildMolecule } from './molecules.js';

const energyOf = (system, basisOpts) => {
  const r = computeSystem({ ...system, basisOpts });
  return r.Etot;
};

// ---------------------------------------------------------------------------
// Un solo parametro: factor global kappa sobre todos los zeta.
// Devuelve la curva E(kappa) (para dibujarla) y el minimo afinado.
// ---------------------------------------------------------------------------
export function optimizeGlobalZeta(system, opts = {}) {
  const lo = opts.lo ?? 0.70;
  const hi = opts.hi ?? 1.60;
  const nPts = opts.points ?? 10;
  const base = system.basisOpts || {};
  const curve = [];
  let evals = 0;

  const E = (k) => {
    evals++;
    return energyOf(system, { ...base, zetaScale: k });
  };

  for (let i = 0; i < nPts; i++) {
    const k = lo + ((hi - lo) * i) / (nPts - 1);
    curve.push({ scale: k, E: E(k) });
  }

  // Afinamos alrededor del mejor punto del barrido.
  let bi = 0;
  curve.forEach((p, i) => { if (p.E < curve[bi].E) bi = i; });
  const a = curve[Math.max(0, bi - 1)].scale;
  const b = curve[Math.min(curve.length - 1, bi + 1)].scale;
  const res = goldenSection(E, a, b, opts.tol ?? 2e-3, 25);

  const E0 = energyOf(system, { ...base, zetaScale: 1 });
  return {
    curve, best: { scale: res.x, E: res.f }, E0, gain: E0 - res.f, evals: evals + res.evals,
  };
}

// ---------------------------------------------------------------------------
// Un factor por subcapa (1s, 2s, 2p, ...): optimizacion multiparametrica.
// Solo tiene sentido para atomos o moleculas pequenas: cada evaluacion es un
// SCF completo.
// ---------------------------------------------------------------------------
export function optimizeShellZetas(system, opts = {}) {
  const base = system.basisOpts || {};
  const nelec = system.atoms.reduce((s, a) => s + a.Z, 0) - (system.charge || 0);
  const cfg = configFor(Math.max(nelec, 1));
  const keys = cfg.map((s) => `${s.n}${SUBSHELL[s.l]}`);
  let evals = 0;

  const objective = (logs) => {
    const byShell = {};
    keys.forEach((k, i) => { byShell[k] = Math.exp(logs[i]); });
    for (const v of Object.values(byShell)) if (v < 0.4 || v > 2.5) return 1e6;
    evals++;
    return energyOf(system, { ...base, zetaScaleByShell: byShell });
  };

  const E0 = energyOf(system, base);
  const res = nelderMead(objective, keys.map(() => 0), {
    step: 0.12, tol: 1e-8, maxIter: opts.maxIter ?? 120,
  });
  const factors = {};
  keys.forEach((k, i) => { factors[k] = Math.exp(res.x[i]); });
  return { factors, E: res.f, E0, gain: E0 - res.f, keys, evals };
}

// ---------------------------------------------------------------------------
// Curva de energia potencial E(R) de una molecula diatomica: el resultado mas
// visual del enlace quimico (minimo = distancia de equilibrio, profundidad =
// energia de disociacion en la aproximacion Hartree-Fock).
// ---------------------------------------------------------------------------
export function scanBond(molKey, basisOpts, opts = {}) {
  const bm = buildMolecule;
  const m0 = bm(molKey);
  const r0 = m0.def.bond;
  if (!r0) throw new Error('La curva E(R) solo aplica a moleculas diatomicas.');
  const lo = opts.lo ?? Math.max(0.4, r0 * 0.55);
  const hi = opts.hi ?? r0 * 2.6;
  const n = opts.points ?? 22;

  const pts = [];
  for (let i = 0; i < n; i++) {
    const R = lo + ((hi - lo) * i) / (n - 1);
    const m = bm(molKey, R);
    const r = computeSystem({ atoms: m.atoms, charge: m.charge, mult: m.mult, basisOpts });
    pts.push({ R, E: r.Etot });
    if (opts.onPoint) opts.onPoint((i + 1) / n, R, r.Etot);
  }

  // Minimo por parabola sobre los tres puntos mas bajos.
  let bi = 0;
  pts.forEach((p, i) => { if (p.E < pts[bi].E) bi = i; });
  let Req = pts[bi].R;
  let Emin = pts[bi].E;
  if (bi > 0 && bi < pts.length - 1) {
    const [x1, x2, x3] = [pts[bi - 1].R, pts[bi].R, pts[bi + 1].R];
    const [y1, y2, y3] = [pts[bi - 1].E, pts[bi].E, pts[bi + 1].E];
    const d = (x1 - x2) * (x1 - x3) * (x2 - x3);
    if (Math.abs(d) > 1e-12) {
      const A = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / d;
      const B = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / d;
      if (A > 0) {
        Req = -B / (2 * A);
        const C = (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) / d;
        Emin = A * Req * Req + B * Req + C;
      }
    }
  }
  const Efar = pts[pts.length - 1].E;
  return { points: pts, Req, Emin, De: Efar - Emin, Rexp: r0 };
}
