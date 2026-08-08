// Genera los DATOS de las figuras y tablas de la guia (docs/guia.pdf) usando el
// mismo motor que la app: nada de numeros escritos a mano.
//
//   node scripts/guia-datos.mjs [salida.json]
//
// El resultado se consume desde scripts/guia-pdf.py.

import { writeFileSync } from 'node:fs';
import { radial, radialDistribution, psiCartesian } from '../src/physics/hydrogen.js';
import {
  elementBySym, HF_LIMIT, configFor, configText, slaterZeta, slaterZeff,
  slaterScreening, SUBSHELL,
} from '../src/physics/atoms.js';
import { fitRadialGaussians, slaterRadial } from '../src/physics/basis.js';
import { computeSystem } from '../src/physics/qchem.js';
import { buildMolecule, MOLECULES, bondList, boxHalfSize } from '../src/physics/molecules.js';
import { topology, baderBasins } from '../src/physics/qtaim.js';
import { DensityAnalyzer } from '../src/physics/density.js';
import { optimizeGlobalZeta, scanBond } from '../src/physics/variational.js';

const out = {};
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const BASE = { kind: 'sto', nG: 3, quality: 'dz' };
const sysOf = (key, basisOpts = BASE) => {
  const m = buildMolecule(key);
  return { m, r: computeSystem({ atoms: m.atoms, charge: m.charge, mult: m.mult, basisOpts }) };
};

// ---------------------------------------------------------------------------
// 1. Hidrogeno: parte radial y distribucion radial.
// ---------------------------------------------------------------------------
log('hidrogeno: R_nl(r) y r^2 R^2');
{
  const rs = Array.from({ length: 400 }, (_, i) => (i * 24) / 399);
  const orbs = [[1, 0], [2, 0], [2, 1], [3, 0], [3, 2]];
  out.hidrogeno = {
    r: rs,
    curvas: orbs.map(([n, l]) => ({
      n, l,
      label: `${n}${'spdf'[l]}`,
      R: rs.map((r) => radial(n, l, r)),
      D: rs.map((r) => radialDistribution(n, l, r)),
    })),
  };
}

// ---------------------------------------------------------------------------
// 1b. Leyenda de color: el mismo orbital 2p_z visto de las cuatro maneras que
//     ofrece la app (signo, densidad, nube muestreada y contornos).
// ---------------------------------------------------------------------------
log('leyenda: cortes del 2p_z');
{
  const N = 220, L = 12;
  const psi = [], rho = [];
  for (let j = 0; j < N; j++) {
    const z = -L + (2 * L * j) / (N - 1);
    const fp = [], fr = [];
    for (let i = 0; i < N; i++) {
      const x = -L + (2 * L * i) / (N - 1);
      const v = psiCartesian(2, 1, 0, x, 0, z);   // 2p_z en el plano xz
      fp.push(v); fr.push(v * v);
    }
    psi.push(fp); rho.push(fr);
  }
  // Nube de puntos por muestreo de rechazo, igual que hace la app.
  const max2 = Math.max(...rho.map((f) => Math.max(...f)));
  const nube = [];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  while (nube.length < 2600) {
    const x = (rnd() * 2 - 1) * L, z = (rnd() * 2 - 1) * L;
    const v = psiCartesian(2, 1, 0, x, 0, z);
    if (rnd() < (v * v) / max2) nube.push([x, z, v >= 0 ? 1 : -1]);
  }
  out.leyenda = { N, L, psi, rho, nube };
}

// ---------------------------------------------------------------------------
// 2. Ajuste STO-nG: por que hacen falta varias gaussianas (la cuspide).
// ---------------------------------------------------------------------------
log('base: ajuste STO-nG del 1s');
{
  const rs = Array.from({ length: 300 }, (_, i) => (i * 4) / 299);
  const exacta = rs.map((r) => Math.exp(-r));
  const ajustes = [1, 2, 3, 6].map((nG) => {
    const fit = fitRadialGaussians(slaterRadial(1, 1), 0, nG, 1, `guia-${nG}`, 12);
    const y = rs.map((r) => {
      let s = 0;
      for (let k = 0; k < fit.exps.length; k++) s += fit.coefs[k] * Math.exp(-fit.exps[k] * r * r);
      return s;
    });
    return { nG, y, exps: Array.from(fit.exps), coefs: Array.from(fit.coefs), quality: fit.quality };
  });
  out.stong = { r: rs, exacta, ajustes };
}

// ---------------------------------------------------------------------------
// 2b. Reglas de Slater: apantallamiento subcapa a subcapa (ejemplos resueltos).
// ---------------------------------------------------------------------------
log('reglas de Slater: ejemplos resueltos');
{
  const NSTAR = { 1: 1, 2: 2, 3: 3, 4: 3.7 };
  out.slater = ['He', 'C', 'O', 'Si', 'Cl', 'Ca'].map((sym) => {
    const el = elementBySym(sym);
    const cfg = configFor(el.Z);
    return {
      sym, Z: el.Z, cfg: configText(cfg),
      capas: cfg.map((sh) => ({
        label: `${sh.n}${SUBSHELL[sh.l]}`,
        n: sh.n, occ: sh.occ,
        sigma: slaterScreening(cfg, sh.n, sh.l),
        zeff: slaterZeff(el.Z, cfg, sh.n, sh.l),
        nstar: NSTAR[sh.n] || sh.n,
        zeta: slaterZeta(el.Z, cfg, sh.n, sh.l),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// 2c. Desglose de la energia Hartree-Fock y escalera de la correlacion.
// ---------------------------------------------------------------------------
log('desglose energetico y correlacion');
{
  // Energias exactas no relativistas (Born-Oppenheimer), de la bibliografia.
  const EXACTA = { He: -2.903724, Be: -14.667356, Ne: -128.9376 };
  const partes = [];
  for (const sym of ['He', 'Be', 'Ne']) {
    const el = elementBySym(sym);
    const sys = { atoms: [{ Z: el.Z, sym, pos: [0, 0, 0] }], charge: 0 };
    const sz = computeSystem({ ...sys, basisOpts: { kind: 'sto', nG: 3, quality: 'sz' } });
    const dz = computeSystem({ ...sys, basisOpts: { kind: 'sto', nG: 4, quality: 'dz' } });
    const et = computeSystem({ ...sys, basisOpts: { kind: 'gauss', quality: 'dz' } });
    partes.push({
      sym, Z: el.Z,
      sz: sz.Etot, dz4: dz.Etot, et: et.Etot,
      hf: HF_LIMIT[sym], exacta: EXACTA[sym],
      correlacion: EXACTA[sym] - HF_LIMIT[sym],
      // desglose del mejor calculo: T + V_ne + V_ee
      Ekin: et.Ekin, Ene: et.Ene, Eee: et.Eee, virial: et.virial,
    });
  }
  out.correlacion = partes;

  const agua = sysOf('H2O', { kind: 'sto', nG: 4, quality: 'dz' }).r;
  out.desglose = {
    mol: 'H₂O', Ekin: agua.Ekin, Ene: agua.Ene, Eee: agua.Eee,
    Enuc: agua.Enuc, Etot: agua.Etot, virial: agua.virial, nelec: agua.nelec,
  };
}

// ---------------------------------------------------------------------------
// 3. Teorema variacional en el helio: E(zeta).
// ---------------------------------------------------------------------------
log('helio: curva variacional E(zeta)');
{
  const He = elementBySym('He');
  const sys = {
    atoms: [{ Z: He.Z, sym: 'He', pos: [0, 0, 0] }],
    charge: 0, mult: 1,
    basisOpts: { kind: 'sto', nG: 6, quality: 'sz' },
  };
  const zSlater = slaterZeta(2, configFor(2), 1, 0);   // 1.70 por las reglas de Slater
  const res = optimizeGlobalZeta(sys, { lo: 0.6, hi: 1.5, points: 24 });
  out.helio = {
    zetaSlater: zSlater,
    curva: res.curve.map((p) => ({ zeta: p.scale * zSlater, E: p.E })),
    mejor: { zeta: res.best.scale * zSlater, E: res.best.E },
    exacto: -2.903724, hf: HF_LIMIT.He ?? -2.8617, teorico: 27 / 16,
  };
}

// ---------------------------------------------------------------------------
// 4. Convergencia del SCF (con DIIS) en H2O.
// ---------------------------------------------------------------------------
log('SCF: convergencia en H2O');
{
  const { r } = sysOf('H2O');
  out.scf = {
    mol: 'H₂O',
    history: (r.scf.history || []).map((h) => ({ iter: h.iter, E: h.E + r.Enuc, err: h.err })),
    Etot: r.Etot, iteraciones: r.iterations, metodo: r.method,
  };
}

// ---------------------------------------------------------------------------
// 5. Curva de energia potencial E(R).
// ---------------------------------------------------------------------------
log('curvas E(R) de H2 y N2');
{
  out.er = [];
  for (const key of ['H2', 'N2']) {
    const s = scanBond(key, BASE, { points: 18 });
    out.er.push({
      key, points: s.points, Req: s.Req, Emin: s.Emin, De: s.De, Rexp: s.Rexp,
    });
  }
}

// ---------------------------------------------------------------------------
// 6. Niveles de orbitales moleculares de H2O y N2.
// ---------------------------------------------------------------------------
log('niveles de orbitales moleculares');
{
  out.niveles = [];
  for (const key of ['N2', 'H2O']) {
    const { r } = sysOf(key);
    const occ = r.scf.occ || r.scf.occA;
    out.niveles.push({
      key,
      eps: Array.from(r.scf.eps).slice(0, 12),
      occ: Array.from(occ).slice(0, 12),
      homo: r.scf.homo,
      comp: r.orbitals.slice(0, 12).map((o) => o.comp.map((c) => c.label).join(' + ')),
    });
  }
}

// ---------------------------------------------------------------------------
// 7. Perfil de rho y del laplaciano a lo largo del enlace: covalente vs ionico.
// ---------------------------------------------------------------------------
log('perfiles de densidad a lo largo del enlace');
{
  out.perfiles = [];
  for (const key of ['N2', 'LiF']) {
    const { m, r } = sysOf(key);
    const da = new DensityAnalyzer(r.basis, r.scf.P);
    const A = m.atoms[0].pos, B = m.atoms[1].pos;
    const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const pts = [];
    for (let i = 0; i <= 220; i++) {
      const t = -0.15 + (1.3 * i) / 220;
      const p = [0, 1, 2].map((k) => A[k] + t * (B[k] - A[k]));
      const f = da.full(p[0], p[1], p[2]);
      pts.push({ s: t * d, rho: f.rho, lap: f.lap, elf: f.elf });
    }
    const topo = topology(r.basis, r.scf.P, m.atoms);
    const bcp = topo.cps.find((c) => c.type === 'BCP');
    out.perfiles.push({
      key, d, syms: m.atoms.map((a) => a.sym), pts,
      bcp: bcp ? {
        s: Math.hypot(bcp.p[0] - A[0], bcp.p[1] - A[1], bcp.p[2] - A[2]),
        rho: bcp.rho, lap: bcp.lap, eps: bcp.ellipticity, H: bcp.H,
      } : null,
    });
  }
}

// ---------------------------------------------------------------------------
// 8. Mapas 2D: rho, laplaciano y ELF en el plano molecular, con topologia.
// ---------------------------------------------------------------------------
log('mapas 2D del plano molecular');
{
  out.mapas = [];
  for (const [key, plano] of [['H2O', 'xz'], ['C2H4', 'xy']]) {
    const { m, r } = sysOf(key);
    const da = new DensityAnalyzer(r.basis, r.scf.P);
    const L = boxHalfSize(m.atoms, 3.2);
    const N = 160;
    const rho = [], lap = [], elf = [];
    const axes = plano === 'xz' ? [0, 2] : [0, 1];
    for (let j = 0; j < N; j++) {
      const rowR = [], rowL = [], rowE = [];
      const v = -L + (2 * L * j) / (N - 1);
      for (let i = 0; i < N; i++) {
        const u = -L + (2 * L * i) / (N - 1);
        const p = [0, 0, 0];
        p[axes[0]] = u; p[axes[1]] = v;
        const f = da.full(p[0], p[1], p[2]);
        rowR.push(f.rho); rowL.push(f.lap); rowE.push(f.elf);
      }
      rho.push(rowR); lap.push(rowL); elf.push(rowE);
    }
    const topo = topology(r.basis, r.scf.P, m.atoms);
    out.mapas.push({
      key, plano, L, N, rho, lap, elf,
      atoms: m.atoms.map((a) => ({ sym: a.sym, u: a.pos[axes[0]], v: a.pos[axes[1]] })),
      cps: topo.cps.map((c) => ({ type: c.type, u: c.p[axes[0]], v: c.p[axes[1]], rho: c.rho, lap: c.lap })),
      paths: topo.paths.map((p) => p.points.map((q) => [q[axes[0]], q[axes[1]]])),
      poincare: topo.poincare, counts: topo.counts,
    });
  }
}

// ---------------------------------------------------------------------------
// 9. Validacion: atomos, moleculas, topologia y cargas de Bader.
// ---------------------------------------------------------------------------
log('validacion: atomos');
{
  const filas = [];
  for (const sym of ['H', 'He', 'Li', 'Be', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Ar']) {
    const el = elementBySym(sym);
    const sys = { atoms: [{ Z: el.Z, sym, pos: [0, 0, 0] }], charge: 0 };
    const fila = { sym, Z: el.Z, cfg: configText(configFor(el.Z)), hf: HF_LIMIT[sym] ?? null };
    for (const [name, opts] of [['sz', { kind: 'sto', nG: 3, quality: 'sz' }],
                                ['dz', { kind: 'sto', nG: 3, quality: 'dz' }],
                                ['dz4', { kind: 'sto', nG: 4, quality: 'dz' }]]) {
      const r = computeSystem({ ...sys, basisOpts: opts });
      fila[name] = r.Etot;
      fila[`${name}_m`] = r.method;
    }
    filas.push(fila);
  }
  out.atomos = filas;
}

log('validacion: moleculas y topologia');
{
  const filas = [];
  for (const def of MOLECULES) {
    if (def.key === 'C6H6') continue;             // demasiado lento para el informe
    const m = buildMolecule(def.key);
    const fila = { key: def.key, name: def.name, nat: m.atoms.length, enlaces: bondList(m.atoms, def).length };
    for (const [name, opts] of [['sz', { kind: 'sto', nG: 3, quality: 'sz' }],
                                ['dz4', { kind: 'sto', nG: 4, quality: 'dz' }]]) {
      const r = computeSystem({ atoms: m.atoms, charge: m.charge, mult: m.mult, basisOpts: opts });
      const t = topology(r.basis, r.scf.P, m.atoms);
      fila[name] = { E: r.Etot, nbf: r.nbf, metodo: r.method, iter: r.iterations, poincare: t.poincare, counts: t.counts };
    }
    filas.push(fila);
    log(`   ${def.key}`);
  }
  out.moleculas = filas;
}

log('validacion: cargas de Bader');
{
  const filas = [];
  for (const key of ['LiF', 'H2O', 'CO', 'CH4', 'N2']) {
    const { m, r } = sysOf(key, { kind: 'sto', nG: 4, quality: 'dz' });
    const b = baderBasins(r.basis, r.scf.P, m.atoms, { N: 80, H: boxHalfSize(m.atoms, 4), nelec: m.nelec });
    filas.push({
      key,
      atomos: m.atoms.map((a, i) => ({ sym: a.sym, bader: b.charges[i], mulliken: r.charges[i] })),
      suma: b.charges.reduce((a, c) => a + c, 0),
    });
    log(`   ${key}`);
  }
  out.bader = filas;
}

const file = process.argv[2] || 'docs/guia-datos.json';
writeFileSync(file, JSON.stringify(out));
log(`escrito ${file}`);
